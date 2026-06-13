import { NextResponse, type NextRequest } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  planExpiry, isBirthdayMonth, birthdayBonusFor, POINTS_VALIDITY_DAYS,
  type PointGrant,
} from "@/lib/loyalty/levels";

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
  if (!secret) return true; // sem segredo configurado, não bloqueia (dev/local)
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const now = new Date();
  try {
    const expired = await expirePoints(now);
    const birthdays = await creditBirthdayBonuses(now);
    return NextResponse.json({ ok: true, ...expired, ...birthdays });
  } catch (err) {
    console.error("Cron loyalty-maintenance falhou:", err);
    return NextResponse.json({ error: "falha na manutenção" }, { status: 500 });
  }
}

/** 1) Expira lotes de pontos com mais de 180 dias, sem deixar saldo negativo. */
async function expirePoints(now: Date): Promise<{ usersExpired: number; pointsExpired: number }> {
  const db = getAdminDb();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - POINTS_VALIDITY_DAYS);

  // Lotes positivos gerados antes do corte e ainda não expirados.
  const snap = await db
    .collection("loyaltyTransactions")
    .where("createdAt", "<=", Timestamp.fromDate(cutoff))
    .get();

  const grantsByUser = new Map<string, PointGrant[]>();
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.points !== "number" || data.points <= 0) continue;
    if (data.expired === true) continue;
    const createdAt = (data.createdAt as Timestamp | undefined)?.toDate?.().toISOString();
    if (!createdAt) continue;
    const list = grantsByUser.get(data.userId) ?? [];
    list.push({ id: d.id, points: data.points, createdAt });
    grantsByUser.set(data.userId, list);
  }

  let usersExpired = 0;
  let pointsExpired = 0;

  for (const [userId, grants] of grantsByUser) {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await userRef.get();
    const balance = (userSnap.data()?.loyaltyPoints as number) ?? 0;
    const plan = planExpiry(grants, balance, now);
    if (plan.markExpiredIds.length === 0) continue;

    const batch = db.batch();
    // Marca todos os lotes vencidos para não reprocessar no próximo dia.
    for (const id of plan.markExpiredIds) {
      batch.update(db.collection("loyaltyTransactions").doc(id), { expired: true });
    }
    if (plan.totalExpire > 0) {
      batch.update(userRef, {
        loyaltyPoints: FieldValue.increment(-plan.totalExpire),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.set(db.collection("loyaltyTransactions").doc(), {
        userId,
        type: "expired",
        points: -plan.totalExpire,
        reason: "Pontos expirados (180 dias)",
        createdAt: FieldValue.serverTimestamp(),
        // Já contabilizado — não deve ser reprocessado como lote a expirar.
        expired: true,
      });
      usersExpired += 1;
      pointsExpired += plan.totalExpire;
    }
    await batch.commit();
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
    const bonus = birthdayBonusFor((u.loyaltyPoints as number) ?? 0);
    if (bonus <= 0) continue;

    const batch = db.batch();
    batch.update(d.ref, {
      loyaltyPoints: FieldValue.increment(bonus),
      lastBirthdayBonusPeriod: period,
      updatedAt: FieldValue.serverTimestamp(),
    });
    batch.set(db.collection("loyaltyTransactions").doc(), {
      userId: d.id,
      type: "bonus",
      points: bonus,
      reason: "Bônus de aniversário",
      createdAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    usersBirthday += 1;
    pointsBirthday += bonus;
  }

  return { usersBirthday, pointsBirthday };
}
