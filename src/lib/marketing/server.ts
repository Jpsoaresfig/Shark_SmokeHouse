/**
 * Processador de marketing NO SERVIDOR (Admin SDK) — usado pelo cron diário
 * único (/api/cron/marketing). Lê as coleções de operação em lotes (paginação),
 * roda segmentação + planejamento puros e persiste os resultados de forma
 * idempotente (doc id da execução = dedupKey).
 *
 * NUNCA importe em componentes de cliente. Tudo o que o módulo precisa roda
 * nesta única rotina diária.
 */
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { storeParts } from "@/lib/bi/periods";
import { buildContacts, type ContactInput } from "@/lib/marketing/segmentation";
import {
  planAutomations,
  planCampaign,
  type PlannerContext,
} from "@/lib/marketing/planner";
import { defaultTemplates } from "@/lib/marketing/templates";
import {
  automationCouponCode,
  automationUserKey,
  campaignCouponCode,
} from "@/lib/marketing/ids";
import type {
  MarketingAutomation,
  MarketingCampaign,
  MarketingCartSession,
  MarketingEvent,
  MarketingExecution,
  MarketingSegment,
  MarketingSettings,
  MarketingTemplate,
} from "@/types/marketing";
import type {
  Coupon,
  LoyaltyTransaction,
  Order,
  Product,
  Sale,
  UserProfile,
} from "@/types";

const PAGE_SIZE = 500;

/* ── Leitura paginada (Firestore) ─────────────────────────── */

/** Lê todos os docs de uma coleção em páginas (startAfter no doc id). */
async function fetchAllDocs(db: Firestore, name: string): Promise<Record<string, unknown>[]> {
  const col = db.collection(name);
  const out: Record<string, unknown>[] = [];
  let lastId: string | undefined;
  for (;;) {
    let query = col.orderBy("__name__").limit(PAGE_SIZE);
    if (lastId) query = query.startAfter(lastId);
    const snap = await query.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      out.push({ ...d.data(), _docId: d.id });
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.docs.length < PAGE_SIZE) break;
  }
  return out;
}

/** Normaliza um valor de data (Timestamp do Admin → ISO). */
function isoOf(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  const maybe = v as { toDate?: () => Date };
  if (typeof maybe.toDate === "function") {
    const d = maybe.toDate();
    return Number.isFinite(d.getTime()) ? d.toISOString() : "";
  }
  return String(v);
}

function uidOf(d: Record<string, unknown>): string {
  return String(d.uid ?? d._docId ?? "");
}

/** Monta as coleções de operação para a segmentação (com paginação). */
async function readOperationData(db: Firestore): Promise<ContactInput> {
  const [userDocs, orderDocs, saleDocs, productDocs, txDocs] = await Promise.all([
    fetchAllDocs(db, "users"),
    fetchAllDocs(db, "orders"),
    fetchAllDocs(db, "sales"),
    fetchAllDocs(db, "products"),
    fetchAllDocs(db, "loyaltyTransactions"),
  ]);

  const users: UserProfile[] = userDocs.map((d) => ({
    uid: uidOf(d),
    email: String(d.email ?? ""),
    displayName: String(d.displayName ?? ""),
    role: d.role as UserProfile["role"],
    phone: d.phone ? String(d.phone) : undefined,
    cpf: d.cpf ? String(d.cpf) : undefined,
    birthDate: d.birthDate ? String(d.birthDate) : undefined,
    loyaltyPoints: typeof d.loyaltyPoints === "number" ? d.loyaltyPoints : 0,
    referredBy: d.referredBy ? String(d.referredBy) : undefined,
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  }));

  const orders: Order[] = orderDocs.map((d) => ({
    ...(d as unknown as Order),
    id: String(d._docId ?? ""),
    customerId: String(d.customerId ?? ""),
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  }));

  const sales: Sale[] = saleDocs.map((d) => ({
    ...(d as unknown as Sale),
    id: String(d._docId ?? ""),
    customerId: d.customerId ? String(d.customerId) : undefined,
    createdAt: isoOf(d.createdAt),
  }));

  const products: Product[] = productDocs.map((d) => ({
    ...(d as unknown as Product),
    id: String(d._docId ?? ""),
    category: String(d.category ?? ""),
  }));

  const loyaltyTransactions: LoyaltyTransaction[] = txDocs.map((d) => ({
    ...(d as unknown as LoyaltyTransaction),
    id: String(d._docId ?? ""),
    userId: String(d.userId ?? ""),
    createdAt: isoOf(d.createdAt),
  }));

  return { users, orders, sales, products, loyaltyTransactions };
}

/* ── Leituras do próprio módulo ───────────────────────────── */

interface MarketingReadModel {
  segments: MarketingSegment[];
  campaigns: MarketingCampaign[];
  automations: MarketingAutomation[];
  executions: MarketingExecution[];
  events: MarketingEvent[];
  sessions: MarketingCartSession[];
  settings: MarketingSettings;
}

async function readMarketingData(db: Firestore): Promise<MarketingReadModel> {
  const [segmentDocs, campaignDocs, autoDocs, executionDocs, eventDocs, sessionDocs, settingsSnap] =
    await Promise.all([
      fetchAllDocs(db, "marketingSegments"),
      fetchAllDocs(db, "marketingCampaigns"),
      fetchAllDocs(db, "marketingAutomations"),
      fetchAllDocs(db, "marketingExecutions"),
      fetchAllDocs(db, "marketingEvents"),
      fetchAllDocs(db, "marketingCartSessions"),
      db.collection("marketingSettings").doc("defaults").get(),
    ]);

  const segments: MarketingSegment[] = segmentDocs.map((d) => ({
    ...(d as unknown as MarketingSegment),
    id: String(d._docId ?? ""),
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  }));

  const campaigns: MarketingCampaign[] = campaignDocs.map((d) => ({
    ...(d as unknown as MarketingCampaign),
    id: String(d._docId ?? ""),
    scheduledFor: isoOf(d.scheduledFor),
    sentAt: d.sentAt ? isoOf(d.sentAt) : undefined,
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  }));

  const automations: MarketingAutomation[] = autoDocs.map((d) => ({
    ...(d as unknown as MarketingAutomation),
    id: String(d._docId ?? ""),
    createdAt: isoOf(d.createdAt),
    updatedAt: isoOf(d.updatedAt),
  }));

  const executions: MarketingExecution[] = executionDocs.map((d) => ({
    ...(d as unknown as MarketingExecution),
    id: String(d._docId ?? ""),
    createdAt: isoOf(d.createdAt),
  }));

  const events: MarketingEvent[] = eventDocs.map((d) => ({
    ...(d as unknown as MarketingEvent),
    id: String(d._docId ?? ""),
    createdAt: isoOf(d.createdAt),
  }));

  const sessions: MarketingCartSession[] = sessionDocs.map((d) => ({
    ...(d as unknown as MarketingCartSession),
    userId: String(d.userId ?? ""),
    updatedAt: isoOf(d.updatedAt),
  }));

  const data = settingsSnap.exists ? (settingsSnap.data() ?? {}) : {};
  const settings: MarketingSettings = {
    active: data.active !== false,
    maxPerDay: typeof data.maxPerDay === "number" ? data.maxPerDay : 2,
    windowHours: typeof data.windowHours === "number" ? data.windowHours : 24,
    minDaysBetweenAuto: typeof data.minDaysBetweenAuto === "number" ? data.minDaysBetweenAuto : 7,
    bigSpenderThreshold: typeof data.bigSpenderThreshold === "number" ? data.bigSpenderThreshold : 400,
    maxAudiencePerCampaign: typeof data.maxAudiencePerCampaign === "number" ? data.maxAudiencePerCampaign : 200,
    updatedAt: isoOf(data.updatedAt),
  };

  return { segments, campaigns, automations, executions, events, sessions, settings };
}

/** Monta o contexto do planejador a partir das execuções persistidas. */
function buildPlannerContext(
  executions: MarketingExecution[],
  settings: MarketingSettings,
  dayKey: string,
): PlannerContext {
  const existing = new Set<string>();
  const sentAutoUser = new Set<string>();
  const recentByUser = new Map<string, number>();
  const lastAutoAtByUser = new Map<string, number>();
  const now = Date.now();
  const cutoff = now - settings.windowHours * 3600_000;

  for (const e of executions) {
    if (e.id) existing.add(e.id);
    if (
      e.automationId &&
      (e.automationEvent === "welcome" || e.automationEvent === "first_purchase")
    ) {
      sentAutoUser.add(automationUserKey(e.automationId, e.userId));
    }
    if (e.status === "skipped_spam" || e.status === "cancelled" || e.status === "error") continue;
    const t = new Date(e.createdAt).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= cutoff) {
      recentByUser.set(e.userId, (recentByUser.get(e.userId) ?? 0) + 1);
    }
    if (e.automationId) {
      const last = lastAutoAtByUser.get(e.userId);
      if (last == null || t > last) lastAutoAtByUser.set(e.userId, t);
    }
  }

  return {
    existing,
    sentAutoUser,
    recentByUser,
    lastAutoAtByUser,
    minDaysBetweenAuto: settings.minDaysBetweenAuto,
    maxPerDay: settings.maxPerDay,
    windowHours: settings.windowHours,
    dayKey,
  };
}

/* ── Cupons ───────────────────────────────────────────────── */

/** Data local da loja (America/Fortaleza) como "YYYY-MM-DD". */
function storeDateStr(now: Date, offsetDays: number): string {
  const p = storeParts(new Date(now.getTime() + offsetDays * 86400000));
  return p.iso;
}

function couponDoc(db: Firestore, code: string) {
  return db.collection("coupons").doc(code);
}

/** Cria um cupom (código já normalizado) — idempotente via doc id = código. */
async function ensureCoupon(
  db: Firestore,
  input: {
    code: string;
    type: Coupon["type"];
    value: number;
    minOrder?: number;
    expiresInDays: number;
    usageLimitPerCpf?: number;
    campaignId?: string;
    automationId?: string;
    now: Date;
  },
): Promise<string> {
  const ref = couponDoc(db, input.code);
  const snap = await ref.get();
  if (snap.exists) return input.code;

  await ref.set({
    code: input.code,
    type: input.type,
    value: input.value,
    ...(input.minOrder != null ? { minOrder: input.minOrder } : {}),
    expiresAt: storeDateStr(input.now, input.expiresInDays),
    ...(input.usageLimitPerCpf != null ? { usageLimitPerCpf: input.usageLimitPerCpf } : {}),
    active: true,
    source: "marketing",
    ...(input.campaignId ? { marketingCampaignId: input.campaignId } : {}),
    ...(input.automationId ? { marketingAutomationId: input.automationId } : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return input.code;
}

/** Garante o cupom de uma automação (um por automação+dia, determinístico). */
async function ensureAutomationCoupon(
  db: Firestore,
  auto: MarketingAutomation,
  dayKey: string,
  now: Date,
): Promise<string | undefined> {
  if (!auto.coupon) return undefined;
  const code = automationCouponCode(auto.event, dayKey);
  return ensureCoupon(db, {
    code,
    type: auto.coupon.type,
    value: auto.coupon.value,
    ...(auto.coupon.minOrder != null ? { minOrder: auto.coupon.minOrder } : {}),
    expiresInDays: auto.coupon.expiresInDays,
    ...(auto.coupon.usageLimitPerCpf != null ? { usageLimitPerCpf: auto.coupon.usageLimitPerCpf } : {}),
    automationId: auto.id,
    now,
  });
}

/* ── Persistência idempotente ─────────────────────────────── */

/** Persiste uma execução com doc id = dedupKey (nunca duplica). */
async function persistExecution(db: Firestore, msg: {
  dedupKey: string;
  userId: string;
  channel: string;
  title: string;
  message: string;
  link?: string;
  couponCode?: string;
  campaignId?: string;
  automationId?: string;
  automationEvent?: string;
  status: MarketingExecution["status"];
  reason?: string;
}): Promise<void> {
  const docData: MarketingExecution = {
    id: msg.dedupKey,
    userId: msg.userId,
    channel: "app",
    title: msg.title,
    message: msg.message,
    ...(msg.link ? { link: msg.link } : {}),
    ...(msg.couponCode ? { couponCode: msg.couponCode } : {}),
    ...(msg.campaignId ? { campaignId: msg.campaignId } : {}),
    ...(msg.automationId ? { automationId: msg.automationId } : {}),
    ...(msg.automationEvent ? { automationEvent: msg.automationEvent as MarketingExecution["automationEvent"] } : {}),
    dedupKey: msg.dedupKey,
    status: msg.status,
    ...(msg.reason ? { reason: msg.reason } : {}),
    createdAt: new Date().toISOString(),
  };
  await db.collection("marketingExecutions").doc(msg.dedupKey).set(docData, { merge: true });
}

async function createNotification(db: Firestore, msg: {
  userId: string;
  title: string;
  message: string;
  link?: string;
  campaignId?: string;
  automationId?: string;
}): Promise<void> {
  await db.collection("notifications").add({
    userId: msg.userId,
    category: "promo",
    title: msg.title,
    body: msg.message,
    ...(msg.link ? { link: msg.link } : {}),
    ...(msg.campaignId ? { marketingCampaignId: msg.campaignId } : {}),
    ...(msg.automationId ? { marketingAutomationId: msg.automationId } : {}),
    read: false,
    createdAt: new Date().toISOString(),
  });
}

async function registerEvent(db: Firestore, input: Omit<MarketingEvent, "id" | "createdAt">): Promise<void> {
  await db.collection("marketingEvents").add({
    ...input,
    createdAt: new Date().toISOString(),
  });
}

/** Anexa um evento de auditoria à campanha (rastro de quem/quando/o quê). */
async function appendCampaignAudit(
  db: Firestore,
  campaignId: string,
  entry: { action: string; by: string; note?: string },
): Promise<void> {
  await db.collection("marketingCampaigns").doc(campaignId).update({
    audit: FieldValue.arrayUnion({
      action: entry.action,
      by: entry.by,
      at: new Date().toISOString(),
      ...(entry.note ? { note: entry.note } : {}),
    }),
  }).catch(() => undefined);
}

/* ── Templates (semeados se faltarem) ─────────────────────── */

async function seedTemplates(db: Firestore): Promise<number> {
  const snap = await db.collection("marketingTemplates").limit(1).get();
  if (!snap.empty) return 0;
  let seeded = 0;
  for (const tpl of defaultTemplates()) {
    const data: Omit<MarketingTemplate, "id" | "createdAt" | "updatedAt"> = {
      name: tpl.name,
      event: tpl.event,
      title: tpl.title,
      message: tpl.message,
      ...(tpl.link ? { link: tpl.link } : {}),
    };
    await db.collection("marketingTemplates").doc(tpl.id).set({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    seeded++;
  }
  return seeded;
}

/* ── Orquestração ─────────────────────────────────────────── */

export interface CronResult {
  templatesSeeded: number;
  active: boolean;
  campaignsSent: number;
  campaignMessages: number;
  automationMessages: number;
  skipped: number;
}

/** Executa a rotina completa do cron de marketing. Idempotente e paginada. */
export async function processMarketingCron(now: Date = new Date()): Promise<CronResult> {
  const db = getAdminDb();
  const seeded = await seedTemplates(db);

  const [operation, marketing] = await Promise.all([
    readOperationData(db),
    readMarketingData(db),
  ]);
  const { segments, campaigns, automations, sessions, settings } = marketing;
  const executions = marketing.executions;

  const summary: CronResult = {
    templatesSeeded: seeded,
    active: settings.active,
    campaignsSent: 0,
    campaignMessages: 0,
    automationMessages: 0,
    skipped: 0,
  };

  if (!settings.active) return summary;

  const contacts = buildContacts(operation, now);
  const dayKey = storeParts(now).iso;
  const ctx = buildPlannerContext(executions, settings, dayKey);

  /* 1) Campanhas agendadas (status=scheduled e data <= agora). */
  const dueCampaigns = campaigns
    .filter((c) => c.status === "scheduled")
    .filter((c) => c.channel !== "whatsapp")
    .filter((c) => {
      const t = new Date(c.scheduledFor).getTime();
      return Number.isFinite(t) && t <= now.getTime();
    });

  for (const campaign of dueCampaigns) {
    try {
      const segment = segments.find((s) => s.id === campaign.segmentId);
      if (!segment || !segment.active) {
        await db.collection("marketingCampaigns").doc(campaign.id).update({
          status: "cancelled",
          updatedAt: FieldValue.serverTimestamp(),
        });
        await appendCampaignAudit(db, campaign.id, {
          action: "cancelled",
          by: "cron",
          note: "segmento-alvo inexistente ou inativo",
        });
        continue;
      }

      let couponCode = campaign.couponCode;
      if (campaign.coupon && !couponCode) {
        couponCode = campaignCouponCode();
        await ensureCoupon(db, {
          code: couponCode,
          type: campaign.coupon.type,
          value: campaign.coupon.value,
          ...(campaign.coupon.minOrder != null ? { minOrder: campaign.coupon.minOrder } : {}),
          expiresInDays: campaign.coupon.expiresInDays,
          ...(campaign.coupon.usageLimitPerCpf != null ? { usageLimitPerCpf: campaign.coupon.usageLimitPerCpf } : {}),
          campaignId: campaign.id,
          now,
        });
      }

      const effectiveCampaign: MarketingCampaign = couponCode ? { ...campaign, couponCode } : campaign;

      const { planned, skipped } = planCampaign({
        campaign: effectiveCampaign,
        segment,
        contacts,
        ctx,
        cap: settings.maxAudiencePerCampaign,
      });

      let sent = 0;
      let blocked = 0;
      for (const msg of planned) {
        await persistExecution(db, {
          dedupKey: msg.dedupKey,
          userId: msg.userId,
          channel: msg.channel,
          title: msg.title,
          message: msg.message,
          link: msg.link,
          couponCode: msg.couponCode,
          campaignId: campaign.id,
          status: "processed",
        });
        await createNotification(db, msg);
        if (msg.couponCode) {
          await registerEvent(db, {
            userId: msg.userId,
            type: "campaign",
            campaignId: campaign.id,
            couponCode: msg.couponCode,
            message: msg.message,
            link: msg.link,
          });
        }
        sent++;
        summary.campaignMessages++;
      }
      for (const s of skipped) {
        blocked++;
        summary.skipped++;
        await persistExecution(db, {
          dedupKey: `campaign:${campaign.id}:${s.userId}`,
          userId: s.userId,
          channel: "app",
          title: campaign.title,
          message: campaign.message,
          campaignId: campaign.id,
          status: "skipped_spam",
          reason: s.reason,
        });
      }

      await db.collection("marketingCampaigns").doc(campaign.id).update({
        status: "sent",
        sentAt: now.toISOString(),
        executedBy: "cron",
        sentCount: sent,
        segmentSnapshot: { name: segment.name, size: planned.length + blocked },
        ...(couponCode ? { couponCode } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await appendCampaignAudit(db, campaign.id, {
        action: "sent",
        by: "cron",
        note: `${sent} mensagens, ${blocked} bloqueadas (anti-spam/dedup)`,
      });
      summary.campaignsSent++;
    } catch (err) {
      console.error(`[marketing] falha na campanha ${campaign.id}:`, err);
    }
  }

  /* 2) Automações ativas. */
  const activeAutomations = automations.filter((a) => a.active);

  const { planned: plannedAuto, skipped: skippedAuto, couponsNeeded } = planAutomations({
    automations: activeAutomations,
    contacts,
    sessions,
    settings,
    ctx,
    now,
  });

  // Garante o cupom determinístico do dia SOMENTE das automações que vão enviar
  // pelo menos uma mensagem hoje (evita acumular um cupom não usado por dia).
  for (const auto of activeAutomations) {
    if (!auto.coupon) continue;
    const code = automationCouponCode(auto.event, dayKey);
    if (!couponsNeeded.has(code)) continue;
    try {
      await ensureAutomationCoupon(db, auto, dayKey, now);
    } catch (err) {
      console.error(`[marketing] falha ao garantir cupom da automação ${auto.id}:`, err);
    }
  }

  for (const msg of plannedAuto) {
    try {
      await persistExecution(db, {
        dedupKey: msg.dedupKey,
        userId: msg.userId,
        channel: msg.channel,
        title: msg.title,
        message: msg.message,
        link: msg.link,
        couponCode: msg.couponCode,
        automationId: msg.automationId,
        automationEvent: msg.automationEvent,
        status: "processed",
      });
      await createNotification(db, msg);
      await registerEvent(db, {
        userId: msg.userId,
        type: (msg.automationEvent as MarketingEvent["type"]) ?? "promo",
        automationId: msg.automationId,
        couponCode: msg.couponCode,
        message: msg.message,
        link: msg.link,
      });
      summary.automationMessages++;
    } catch (err) {
      console.error(`[marketing] falha ao persistir automação ${msg.dedupKey}:`, err);
    }
  }
  summary.skipped += skippedAuto.length;

  /* 3) Limpeza: sessões de carrinho de quem já concluiu o pedido ou que estão
   *    sem itens (carrinho esvaziado — o tracker remove ao zerar; isto pega
   *    sobras antigas e escritas concorrentes). */
  const ordered = new Set(operation.orders.filter((o) => o.customerId).map((o) => o.customerId));
  for (const s of sessions) {
    if (ordered.has(s.userId) || !s.itemsCount || s.itemsCount <= 0) {
      await db.collection("marketingCartSessions").doc(s.userId).delete().catch(() => undefined);
    }
  }

  return summary;
}
