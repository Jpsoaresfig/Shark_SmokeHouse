import { NextResponse, type NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  planExpiry, isBirthdayMonth, birthdayBonusFor, POINTS_VALIDITY_DAYS,
  type PointGrant,
} from "@/lib/loyalty/levels";
import { createSystemAlert, logCronExecution, logSystemError, recordMonitoredRequest } from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";

export const runtime = "nodejs";
// Sem cache: é uma rotina de manutenção disparada por cron.
export const dynamic = "force-dynamic";

/**
 * Rotina de manutenção do Clube Shark (Task 3.7), executada por cron (Vercel):
 *   1. EXPIRAÇÃO — debita pontos gerados há mais de 180 dias (validade da regra).
 *   2. ANIVERSÁRIO — credita o bônus mensal dos níveis Predatory (+200) e
 *      Megalodon (+500) no mês de aniversário do cliente (uma vez por período).
 *
 * Roda no servidor (Admin SDK) — bypassa as regras do Firestore. Protegida por
 * CRON_SECRET: o Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`.
 *
 * Agendamento (vercel.json):
 *   { "crons": [{ "path": "/api/cron/loyalty-maintenance", "schedule": "0 6 * * *" }] }
 */
export async function POST(request: NextRequest) {
  return run(request);
}
// Vercel Cron dispara via GET; aceitamos ambos.
export async function GET(request: NextRequest) {
  return run(request);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sem CRON_SECRET a rota só fica aberta em desenvolvimento local; em produção
  // a ausência do segredo é recusada (antes qualquer um podia disparar a
  // expiração/bônus de aniversário pela URL pública).
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  void recordMonitoredRequest("cron-loyalty-maintenance");

  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const expired = await expirePoints(new Date());
    const birthdays = await creditBirthdayBonuses(new Date());
    void logCronExecution({
      job: "loyalty-maintenance",
      status: "success",
      startedAt,
      requestId,
      processed: expired.usersExpired + birthdays.usersBirthday,
    });
    return NextResponse.json({ ok: true, ...expired, ...birthdays });
  } catch (err) {
    console.error("Cron loyalty-maintenance falhou:", err);
    void logCronExecution({
      job: "loyalty-maintenance",
      status: "failed",
      startedAt,
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    void logSystemError({
      type: "cron",
      message: "Cron loyalty-maintenance falhou",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/cron/loyalty-maintenance",
      method: "POST",
      statusCode: 500,
      requestId,
    });
    void createSystemAlert({
      key: "cron:loyalty-maintenance",
      type: "cron_failed",
      severity: "critical",
      message: "Rotina de manutenção do Clube Shark falhou",
      metadata: { requestId },
    });
    return NextResponse.json({ error: "falha na manutenção" }, { status: 500 });
  }
}

/** 1) Expira lotes de pontos com mais de 180 dias, sem deixar saldo negativo. */
async function expirePoints(now: Date): Promise<{ usersExpired: number; pointsExpired: number }> {
  const db = getAdminDb();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - POINTS_VALIDITY_DAYS);

  // Clientes com algum lote positivo gerado antes do corte e ainda não expirado.
  const snap = await db
    .collection("loyaltyTransactions")
    .where("createdAt", "<=", Timestamp.fromDate(cutoff))
    .get();

  const candidates = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.points !== "number" || data.points <= 0) continue;
    if (data.expired === true) continue;
    if (typeof data.userId === "string" && data.userId) candidates.add(data.userId);
  }

  let usersExpired = 0;
  let pointsExpired = 0;

  for (const userId of candidates) {
    const userRef = db.collection("users").doc(userId);
    const ledgerQuery = db.collection("loyaltyTransactions").where("userId", "==", userId);

    // Transação por cliente: saldo e ledger lidos e debitados atomicamente (um
    // resgate concorrente ou uma execução duplicada do cron não expira 2x nem
    // deixa o saldo negativo).
    const expiredNow = await db.runTransaction(async (tx) => {
      const [userSnap, ledgerSnap] = [await tx.get(userRef), await tx.get(ledgerQuery)];
      const balance = (userSnap.data()?.loyaltyPoints as number) ?? 0;

      // FIFO: todos os lotes positivos (inclusive já expirados) + tudo o que já
      // foi debitado. Os débitos consomem primeiro os lotes mais antigos — só o
      // que sobrou deles expira (antes expirava pontos novos de quem já tinha
      // gasto os antigos).
      const grants: PointGrant[] = [];
      const pendingIds = new Set<string>();
      let consumed = 0;
      for (const d of ledgerSnap.docs) {
        const data = d.data();
        if (typeof data.points !== "number" || !Number.isFinite(data.points)) continue;
        if (data.points < 0) {
          consumed += -data.points;
          continue;
        }
        if (data.points === 0) continue;
        const createdAt = (data.createdAt as Timestamp | undefined)?.toDate?.().toISOString();
        if (!createdAt) continue;
        grants.push({ id: d.id, points: data.points, createdAt });
        if (data.expired !== true) pendingIds.add(d.id);
      }

      const plan = planExpiry(grants, balance, now, consumed);
      const toMark = plan.markExpiredIds.filter((id) => pendingIds.has(id));
      if (toMark.length === 0) return 0;

      // Marca os lotes vencidos para não reprocessar no próximo dia.
      for (const id of toMark) {
        tx.update(db.collection("loyaltyTransactions").doc(id), { expired: true });
      }
      if (plan.totalExpire > 0 && userSnap.exists) {
        tx.update(userRef, {
          loyaltyPoints: FieldValue.increment(-plan.totalExpire),
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.set(db.collection("loyaltyTransactions").doc(), {
          userId,
          type: "expired",
          points: -plan.totalExpire,
          reason: "Pontos expirados (180 dias)",
          createdAt: FieldValue.serverTimestamp(),
          // Já contabilizado — não deve ser reprocessado como lote a expirar.
          expired: true,
        });
        return plan.totalExpire;
      }
      return 0;
    });

    if (expiredNow > 0) {
      usersExpired += 1;
      pointsExpired += expiredNow;
    }
  }

  return { usersExpired, pointsExpired };
}

/** 2) Credita o bônus de aniversário (Predatory/Megalodon), 1x por período. */
async function creditBirthdayBonuses(now: Date): Promise<{ usersBirthday: number; pointsBirthday: number }> {
  const db = getAdminDb();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const snap = await db.collection("users").get();
  let usersBirthday = 0;
  let pointsBirthday = 0;

  for (const d of snap.docs) {
    const u = d.data();
    if (u.role && u.role !== "customer") continue;
    if (!isBirthdayMonth(u.birthDate as string | undefined, now)) continue;
    if (u.lastBirthdayBonusPeriod === period) continue; // já creditado neste mês
    if (birthdayBonusFor((u.loyaltyPoints as number) ?? 0) <= 0) continue;

    // Transação: relê o perfil e só credita se o período ainda não foi pago —
    // duas execuções simultâneas do cron (retry do Vercel, disparo manual) não
    // creditam o bônus 2x.
    // O id do lançamento é por ANO: mesmo que o cliente edite birthDate ou
    // lastBirthdayBonusPeriod no próprio perfil, o bônus sai 1x por ano.
    const ledgerRef = db.collection("loyaltyTransactions").doc(`birthday-${d.id}-${now.getFullYear()}`);
    const credited = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(d.ref);
      const already = await tx.get(ledgerRef);
      const fu = fresh.data();
      if (!fu || fu.lastBirthdayBonusPeriod === period || already.exists) return 0;
      const bonus = birthdayBonusFor((fu.loyaltyPoints as number) ?? 0);
      if (bonus <= 0) return 0;
      tx.update(d.ref, {
        loyaltyPoints: FieldValue.increment(bonus),
        lastBirthdayBonusPeriod: period,
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(ledgerRef, {
        userId: d.id,
        type: "bonus",
        points: bonus,
        reason: "Bônus de aniversário",
        createdAt: FieldValue.serverTimestamp(),
      });
      return bonus;
    });
    if (credited <= 0) continue;
    usersBirthday += 1;
    pointsBirthday += credited;
  }

  return { usersBirthday, pointsBirthday };
}
