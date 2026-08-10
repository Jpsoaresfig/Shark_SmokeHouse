import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { getAllUsers } from "@/lib/firebase/users";
import { getOrders } from "@/lib/firebase/orders";
import { getSales } from "@/lib/firebase/sales";
import { getProducts } from "@/lib/firebase/products";
import { getCoupons } from "@/lib/firebase/coupons";
import { createNotification } from "@/lib/firebase/notifications";
import { buildContacts, resolveAudience } from "@/lib/marketing/segmentation";
import { planCampaign, type PlannerContext } from "@/lib/marketing/planner";
import { storeParts } from "@/lib/bi/periods";
import { defaultTemplates } from "@/lib/marketing/templates";
import { campaignCouponCode } from "@/lib/marketing/ids";
import { isMarketingCoupon } from "@/lib/marketing/analytics";
import type {
  MarketingAutomation, MarketingCampaign, MarketingCartSession, MarketingContact,
  MarketingEvent, MarketingExecution, MarketingSegment, MarketingSettings,
  MarketingTemplate,
} from "@/types/marketing";
import type {
  Coupon, CouponRedemption, CouponType, LoyaltyTransaction, Order, Product, Sale, UserProfile,
} from "@/types";

const CAMPAIGNS = "marketingCampaigns";
const SEGMENTS = "marketingSegments";
const AUTOMATIONS = "marketingAutomations";
const TEMPLATES = "marketingTemplates";
const EXECUTIONS = "marketingExecutions";
const EVENTS = "marketingEvents";
const SETTINGS = "marketingSettings";
const CART_SESSIONS = "marketingCartSessions";

/** serverTimestamp() volta como Timestamp na leitura — normaliza para ISO. */
function tsToISO(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/* ── Campanhas ────────────────────────────────────────────── */
export async function getMarketingCampaigns(force = false): Promise<MarketingCampaign[]> {
  return cached(CAMPAIGNS, async () => {
    const snap = await getDocs(collection(db, CAMPAIGNS));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          scheduledFor: tsToISO(data.scheduledFor),
          sentAt: tsToISO(data.sentAt),
          createdAt: tsToISO(data.createdAt),
          updatedAt: tsToISO(data.updatedAt),
        } as MarketingCampaign;
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

export type MarketingCampaignInput = Omit<
  MarketingCampaign, "id" | "createdAt" | "updatedAt" | "sentAt" | "sentCount" | "executedBy"
>;

export async function createMarketingCampaign(data: MarketingCampaignInput): Promise<string> {
  const ref = await addDoc(collection(db, CAMPAIGNS), {
    ...stripUndefined(data),
    status: data.status ?? "draft",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate(CAMPAIGNS);
  return ref.id;
}

export async function updateMarketingCampaign(
  id: string,
  data: Partial<Omit<MarketingCampaign, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(db, CAMPAIGNS, id), { ...stripUndefined(data), updatedAt: serverTimestamp() });
  invalidate(CAMPAIGNS);
}

export async function deleteMarketingCampaign(id: string): Promise<void> {
  await deleteDoc(doc(db, CAMPAIGNS, id));
  invalidate(CAMPAIGNS);
}

/* ── Segmentos ────────────────────────────────────────────── */
export async function getMarketingSegments(force = false): Promise<MarketingSegment[]> {
  return cached(SEGMENTS, async () => {
    const snap = await getDocs(collection(db, SEGMENTS));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: tsToISO(data.createdAt),
          updatedAt: tsToISO(data.updatedAt),
        } as MarketingSegment;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, force);
}

export type MarketingSegmentInput = Omit<MarketingSegment, "id" | "createdAt" | "updatedAt">;

export async function createMarketingSegment(data: MarketingSegmentInput): Promise<string> {
  const ref = await addDoc(collection(db, SEGMENTS), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate(SEGMENTS);
  return ref.id;
}

export async function updateMarketingSegment(
  id: string,
  data: Partial<Omit<MarketingSegment, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(db, SEGMENTS, id), { ...stripUndefined(data), updatedAt: serverTimestamp() });
  invalidate(SEGMENTS);
}

export async function deleteMarketingSegment(id: string): Promise<void> {
  await deleteDoc(doc(db, SEGMENTS, id));
  invalidate(SEGMENTS);
}

/* ── Automações ───────────────────────────────────────────── */
export async function getMarketingAutomations(force = false): Promise<MarketingAutomation[]> {
  return cached(AUTOMATIONS, async () => {
    const snap = await getDocs(collection(db, AUTOMATIONS));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: tsToISO(data.createdAt),
          updatedAt: tsToISO(data.updatedAt),
        } as MarketingAutomation;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, force);
}

export type MarketingAutomationInput = Omit<MarketingAutomation, "id" | "createdAt" | "updatedAt">;

export async function createMarketingAutomation(data: MarketingAutomationInput): Promise<string> {
  const ref = await addDoc(collection(db, AUTOMATIONS), {
    ...stripUndefined(data),
    active: data.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate(AUTOMATIONS);
  return ref.id;
}

export async function updateMarketingAutomation(
  id: string,
  data: Partial<Omit<MarketingAutomation, "id" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await updateDoc(doc(db, AUTOMATIONS, id), { ...stripUndefined(data), updatedAt: serverTimestamp() });
  invalidate(AUTOMATIONS);
}

export async function deleteMarketingAutomation(id: string): Promise<void> {
  await deleteDoc(doc(db, AUTOMATIONS, id));
  invalidate(AUTOMATIONS);
}

/* ── Templates ────────────────────────────────────────────── */
/** Lista os templates; sem coleção ainda, devolve os presets padrão (sem gravar). */
export async function getMarketingTemplates(force = false): Promise<MarketingTemplate[]> {
  return cached(TEMPLATES, async () => {
    const snap = await getDocs(collection(db, TEMPLATES));
    if (snap.empty) return defaultTemplates();
    return snap.docs.map((d) => ({
      ...d.data(),
      id: d.id,
      createdAt: tsToISO(d.data().createdAt),
      updatedAt: tsToISO(d.data().updatedAt),
    } as MarketingTemplate));
  }, force);
}

export async function saveMarketingTemplate(
  id: string,
  data: Omit<MarketingTemplate, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  await setDoc(doc(db, TEMPLATES, id), {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate(TEMPLATES);
}

export async function deleteMarketingTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, TEMPLATES, id));
  invalidate(TEMPLATES);
}

/* ── Execuções e eventos ──────────────────────────────────── */
export async function getMarketingExecutions(force = false): Promise<MarketingExecution[]> {
  return cached(`${EXECUTIONS}:all`, async () => {
    const snap = await getDocs(collection(db, EXECUTIONS));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id, createdAt: tsToISO(d.data().createdAt) } as MarketingExecution))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

export async function getMarketingEvents(force = false): Promise<MarketingEvent[]> {
  return cached(`${EVENTS}:all`, async () => {
    const snap = await getDocs(collection(db, EVENTS));
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id, createdAt: tsToISO(d.data().createdAt) } as MarketingEvent))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

/* ── Configurações ────────────────────────────────────────── */
export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  active: true,
  maxPerDay: 2,
  windowHours: 24,
  minDaysBetweenAuto: 7,
  bigSpenderThreshold: 400,
  maxAudiencePerCampaign: 200,
  updatedAt: "",
};

export async function getMarketingSettings(force = false): Promise<MarketingSettings> {
  return cached("marketing:settings", async () => {
    const snap = await getDoc(doc(db, SETTINGS, "defaults"));
    if (!snap.exists()) return { ...DEFAULT_MARKETING_SETTINGS };
    return { ...DEFAULT_MARKETING_SETTINGS, ...snap.data() } as MarketingSettings;
  }, force);
}

export async function saveMarketingSettings(
  partial: Partial<Omit<MarketingSettings, "updatedAt">>,
): Promise<void> {
  await setDoc(doc(db, SETTINGS, "defaults"), {
    ...partial,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  invalidate("marketing:settings");
}

/* ── Contatos enriquecidos (para listagem e preview de público) ── */
/** Todas as transações de fidelidade (admin): alimenta "pontos a expirar". */
async function getAllLoyaltyTransactions(force = false): Promise<LoyaltyTransaction[]> {
  return cached("loyalty:transactions:all", async () => {
    const snap = await getDocs(collection(db, "loyaltyTransactions"));
    return snap.docs
      .map((d) => ({
        ...d.data(),
        id: d.id,
        createdAt: tsToISO(d.data().createdAt),
      }) as LoyaltyTransaction)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

export async function getMarketingContacts(force = false): Promise<MarketingContact[]> {
  return cached("marketing:contacts", async () => {
    const [users, orders, sales, products, txs] = await Promise.all([
      getAllUsers() as Promise<UserProfile[]>,
      getOrders() as Promise<Order[]>,
      getSales() as Promise<Sale[]>,
      getProducts() as Promise<Product[]>,
      getAllLoyaltyTransactions() as Promise<LoyaltyTransaction[]>,
    ]);
    return buildContacts({ users, orders, sales, products, loyaltyTransactions: txs });
  }, force);
}

/* ── Cupons de marketing e usos (painel) ──────────────────── */
/** Usos de cupons (auditoria) — lidos pelo dashboard/histórico. */
export async function getCouponRedemptions(force = false): Promise<CouponRedemption[]> {
  return cached("couponRedemptions:all", async () => {
    const snap = await getDocs(collection(db, "couponRedemptions"));
    return snap.docs
      .map((d) => ({
        ...d.data(),
        id: d.id,
        createdAt: tsToISO(d.data().createdAt),
      }) as CouponRedemption)
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

/** Cupons criados pelo módulo de marketing (fonte única do painel). */
export async function getMarketingCoupons(force = false): Promise<Coupon[]> {
  const coupons = await getCoupons(force);
  return coupons.filter(isMarketingCoupon);
}

/** Cria o cupom de uma campanha no momento do envio (idempotente). */
async function ensureMarketingCoupon(input: {
  code: string;
  type: CouponType;
  value: number;
  minOrder?: number;
  expiresInDays: number;
  usageLimitPerCpf?: number;
  campaignId?: string;
}): Promise<void> {
  const ref = doc(db, "coupons", input.code);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const expires = storeParts(new Date(Date.now() + input.expiresInDays * 86400_000)).iso;
  await setDoc(ref, {
    code: input.code,
    type: input.type,
    value: input.value,
    ...(input.minOrder != null ? { minOrder: input.minOrder } : {}),
    expiresAt: expires,
    ...(input.usageLimitPerCpf != null ? { usageLimitPerCpf: input.usageLimitPerCpf } : {}),
    active: true,
    source: "marketing",
    ...(input.campaignId ? { marketingCampaignId: input.campaignId } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate("coupons");
}

export async function getSegmentAudience(
  segment: MarketingSegment,
  cap = 100,
): Promise<{ total: number; preview: MarketingContact[] }> {
  const contacts = await getMarketingContacts(true);
  const audience = resolveAudience(segment, contacts);
  return { total: audience.length, preview: audience.slice(0, cap) };
}

/* ── Carrinho abandonado (heartbeat leve no cliente) ──────── */
let lastCartWrite = 0;
const CART_THROTTLE_MS = 60_000;

/**
 * Registra uma "sessão de carrinho" (usuário logado com itens no carrinho) que
 * alimenta a automação de carrinho abandonado. Fica no doc `{userId}` da
 * coleção marketingCartSessions; o cron lê quem atualizou há < 24h com itens.
 * Throttling de 1 minuto para não escrever a cada render.
 */
export async function trackMarketingCartSession(
  uid: string,
  itemsCount: number,
  subtotal: number,
): Promise<void> {
  if (!uid || !itemsCount || itemsCount <= 0) return;
  const now = Date.now();
  if (now - lastCartWrite < CART_THROTTLE_MS) return;
  lastCartWrite = now;
  try {
    await setDoc(
      doc(db, CART_SESSIONS, uid),
      { userId: uid, itemsCount, subtotal, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (err) {
    console.error("[marketing] falha ao registrar sessão de carrinho:", err);
  }
}

/** Estado de sessões de carrinho (lido pelo cron e pelo painel). */
export async function getMarketingCartSessions(force = false): Promise<MarketingCartSession[]> {
  return cached(`${CART_SESSIONS}:all`, async () => {
    const snap = await getDocs(collection(db, CART_SESSIONS));
    return snap.docs.map((d) => ({
      userId: d.id,
      itemsCount: d.data().itemsCount ?? 0,
      subtotal: d.data().subtotal ?? 0,
      updatedAt: tsToISO(d.data().updatedAt),
    }) as MarketingCartSession);
  }, force);
}

/**
 * Remove a sessão de carrinho do usuário (carrinho esvaziado). Impede que a
 * automação de carrinho abandonado dispare um lembrete para quem desistiu dos
 * itens. Best-effort e não throttled (a próxima gravação pode vir logo em
 * seguida, então resetamos o throttle da escrita).
 */
export async function clearMarketingCartSession(uid: string): Promise<void> {
  if (!uid) return;
  lastCartWrite = 0;
  try {
    await deleteDoc(doc(db, CART_SESSIONS, uid));
  } catch (err) {
    console.error("[marketing] falha ao limpar sessão de carrinho:", err);
  }
}

/**
 * Registra o toque em uma notificação de campanha (métrica "Toques (link)").
 * Best-effort: falhas silenciosas não podem travar a navegação do usuário.
 * O servidor valida a identidade (idToken) e deduplica por notificação.
 */
export async function registerMarketingClick(
  notificationId: string,
  campaignId: string,
): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/marketing/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ notificationId, campaignId }),
    });
  } catch {
    // tracking é best-effort
  }
}

/* ── "Enviar agora" (execução manual pelo admin) ──────────── */
export interface SendNowResult {
  campaignId: string;
  planned: number;
  deduped: number;
  skippedSpam: number;
}

/**
 * Executa uma campanha imediatamente, do lado do cliente (admin). Calcula o
 * público pela mesma engine do cron (planner), respeita dedup e anti-spam e
 * persiste execuções + notificações + eventos. Idempotente: cada campanha só
 * envia uma vez por cliente (doc id = chave determinística).
 */
export async function executeCampaignNow(campaignId: string, by: string): Promise<SendNowResult> {
  const campaign = (await getMarketingCampaigns(true)).find((c) => c.id === campaignId);
  if (!campaign) throw new Error("Campanha não encontrada.");
  if (campaign.status === "sent") throw new Error("Esta campanha já foi enviada.");
  if (campaign.channel === "whatsapp") {
    throw new Error("Campanha de WhatsApp é de envio manual (wa.me) — envie pelo botão WhatsApp na página de Clientes.");
  }

  const segment = (await getMarketingSegments(true)).find((s) => s.id === campaign.segmentId) ?? null;
  if (!segment || !segment.active) throw new Error("Segmento-alvo inválido ou inativo.");

  const [users, orders, sales, products, txs, executions, settings] = await Promise.all([
    getAllUsers(undefined, true) as Promise<UserProfile[]>,
    getOrders(undefined, true) as Promise<Order[]>,
    getSales(undefined, undefined, true) as Promise<Sale[]>,
    getProducts(true) as Promise<Product[]>,
    getAllLoyaltyTransactions(true) as Promise<LoyaltyTransaction[]>,
    getMarketingExecutions(true),
    getMarketingSettings(true),
  ]);

  const contacts = buildContacts({ users, orders, sales, products, loyaltyTransactions: txs });
  const existing = new Set(executions.map((e) => e.id));
  const recentByUser = new Map<string, number>();
  const windowStart = new Date(Date.now() - settings.windowHours * 3600_000).getTime();
  for (const e of executions) {
    const t = new Date(e.createdAt).getTime();
    if (Number.isFinite(t) && t >= windowStart) {
      recentByUser.set(e.userId, (recentByUser.get(e.userId) ?? 0) + 1);
    }
  }

  const ctx: PlannerContext = {
    existing,
    sentAutoUser: new Set(),
    recentByUser,
    maxPerDay: settings.maxPerDay,
    windowHours: settings.windowHours,
    dayKey: storeParts(new Date()).iso,
  };

  // Se a campanha define cupom a criar no envio, garante o código antes de
  // renderizar as mensagens (mesmo comportamento do cron).
  let couponCode = campaign.couponCode;
  if (campaign.coupon && !couponCode) {
    couponCode = campaignCouponCode();
    await ensureMarketingCoupon({
      code: couponCode,
      type: campaign.coupon.type,
      value: campaign.coupon.value,
      ...(campaign.coupon.minOrder != null ? { minOrder: campaign.coupon.minOrder } : {}),
      expiresInDays: campaign.coupon.expiresInDays,
      ...(campaign.coupon.usageLimitPerCpf != null ? { usageLimitPerCpf: campaign.coupon.usageLimitPerCpf } : {}),
      campaignId: campaign.id,
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

  for (const msg of planned) {
    await setDoc(doc(db, EXECUTIONS, msg.dedupKey), {
      userId: msg.userId,
      channel: msg.channel,
      title: msg.title,
      message: msg.message,
      ...(msg.link ? { link: msg.link } : {}),
      ...(msg.couponCode ? { couponCode: msg.couponCode } : {}),
      ...(msg.campaignId ? { campaignId: msg.campaignId } : {}),
      dedupKey: msg.dedupKey,
      status: "processed",
      createdAt: serverTimestamp(),
    });
    await createNotification({
      userId: msg.userId,
      category: "promo",
      title: msg.title,
      body: msg.message,
      ...(msg.link ? { link: msg.link } : {}),
      ...(msg.campaignId ? { marketingCampaignId: msg.campaignId } : {}),
    });
    await addDoc(collection(db, EVENTS), {
      userId: msg.userId,
      type: "campaign",
      ...(msg.campaignId ? { campaignId: msg.campaignId } : {}),
      ...(msg.message ? { message: msg.message } : {}),
      ...(msg.couponCode ? { couponCode: msg.couponCode } : {}),
      ...(msg.link ? { link: msg.link } : {}),
      createdAt: nowIso(),
    });
  }

  await updateDoc(doc(db, CAMPAIGNS, campaignId), {
    status: "sent",
    sentAt: nowIso(),
    executedBy: by,
    sentCount: planned.length,
    segmentSnapshot: { name: segment.name, size: planned.length },
    ...(couponCode ? { couponCode } : {}),
    updatedAt: serverTimestamp(),
  });
  invalidate(CAMPAIGNS);
  invalidate(EXECUTIONS);
  invalidate(EVENTS);

  return {
    campaignId,
    planned: planned.length,
    deduped: skipped.filter((s) => s.reason === "dedup" || s.reason === "dedup (envio único)").length,
    skippedSpam: skipped.filter((s) => s.reason.includes("anti-spam")).length,
  };
}
