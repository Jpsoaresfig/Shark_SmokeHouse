/**
 * Planejador de envios do módulo de marketing — módulo puro e testável.
 *
 * Decide QUEM recebe o quê, aplicando:
 *  - deduplicação (chaves determinísticas → idempotência ao reexecutar);
 *  - anti-spam (limite de mensagens por cliente por janela);
 *  - prioridade de automações (o cliente encaixado em várias recebe só a de
 *    maior prioridade no dia);
 *  - envio único para boas-vindas / 1ª compra (uma vez por automação, não por dia).
 *
 * NÃO escreve no Firestore — o executor (cron ou "Enviar agora") persiste o
 * resultado. Roda igual no cliente (admin) e no servidor.
 */
import type {
  MarketingAutomation,
  MarketingAutomationEvent,
  MarketingCampaign,
  MarketingCartSession,
  MarketingContact,
  MarketingSettings,
  MarketingSegment,
} from "@/types/marketing";import { resolveAudience } from "./segmentation";
import { AUTOMATION_PRIORITY, shouldSend } from "./priorities";
import { buildMessageVars, renderMessage } from "./placeholders";
import {
  automationExecutionKey,
  automationUserKey,
  campaignExecutionKey,
  automationCouponCode,
} from "./ids";

export interface PlannedMessage {
  dedupKey: string;
  userId: string;
  channel: "app";
  title: string;
  message: string;
  link?: string;
  couponCode?: string;
  campaignId?: string;
  automationId?: string;
  automationEvent?: MarketingAutomationEvent;
}

export interface PlannerContext {
  /** Doc ids já processados (dedupKey) — idempotência entre execuções. */
  existing: Set<string>;
  /** Chaves "auto:{id}:{uid}" de envios únicos (boas-vindas / 1ª compra). */
  sentAutoUser: Set<string>;
  /** Quantidade de mensagens de marketing já enviadas por cliente na janela. */
  recentByUser: Map<string, number>;
  /** Último envio automático por cliente (ms epoch) — para o intervalo
   *  "máx. 1 campanha automática a cada N dias" (anti-spam). Opcional. */
  lastAutoAtByUser?: Map<string, number>;
  /** Intervalo mínimo entre envios automáticos, em dias. 0/ausente = sem regra. */
  minDaysBetweenAuto?: number;
  maxPerDay: number;
  windowHours: number;
  /** "YYYY-MM-DD" no fuso da loja — componente das chaves de automação. */
  dayKey: string;
}

const DAY_MS = 86400000;
const TWO_DAYS_MS = 2 * DAY_MS;

/** Intervalo anti-spam de "1 automática a cada N dias". */
function autoIntervalOk(ctx: PlannerContext, uid: string): boolean {
  if (!ctx.minDaysBetweenAuto || ctx.minDaysBetweenAuto <= 0) return true;
  if (!ctx.lastAutoAtByUser) return true;
  const last = ctx.lastAutoAtByUser.get(uid);
  if (last == null) return true;
  return Date.now() - last >= ctx.minDaysBetweenAuto * DAY_MS;
}

function skippedAutoInterval(ctx: PlannerContext, uid: string): boolean {
  return !autoIntervalOk(ctx, uid);
}

/* ── Campanhas agendadas ───────────────────────────────────── */
export function planCampaign(opts: {
  campaign: MarketingCampaign;
  segment: MarketingSegment | null;
  contacts: MarketingContact[];
  ctx: PlannerContext;
  cap?: number;
}): { planned: PlannedMessage[]; skipped: { userId: string; reason: string }[] } {
  const { campaign, segment, contacts, ctx, cap } = opts;
  const planned: PlannedMessage[] = [];
  const skipped: { userId: string; reason: string }[] = [];

  if (!segment || !segment.active) {
    return { planned, skipped };
  }

  // Canal WhatsApp é envio manual (via wa.me): a engine nunca dispara
  // notificação in-app para campanhas desse canal.
  if (campaign.channel === "whatsapp") {
    return { planned, skipped };
  }

  const audience = resolveAudience(segment, contacts);
  const limit = cap && cap > 0 ? Math.min(audience.length, cap) : audience.length;

  for (let i = 0; i < limit; i++) {
    const contact = audience[i];
    const dedupKey = campaignExecutionKey(campaign.id, contact.uid);

    if (ctx.existing.has(dedupKey)) {
      skipped.push({ userId: contact.uid, reason: "dedup" });
      continue;
    }
    if (skippedAutoInterval(ctx, contact.uid)) {
      skipped.push({
        userId: contact.uid,
        reason: `anti-spam: intervalo de ${ctx.minDaysBetweenAuto}d entre campanhas automáticas`,
      });
      continue;
    }
    const check = shouldSend({
      recentExecutions: ctx.recentByUser.get(contact.uid) ?? 0,
      maxPerDay: ctx.maxPerDay,
      windowHours: ctx.windowHours,
    });
    if (!check.ok) {
      skipped.push({ userId: contact.uid, reason: check.reason ?? "anti-spam" });
      continue;
    }

    const vars = buildMessageVars(contact, {
      coupon: campaign.couponCode,
      couponValue: campaign.coupon?.value,
      couponType: campaign.coupon?.type,
      link: campaign.link,
      diasSemComprar: contact.daysSinceActivity,
    });
    planned.push({
      dedupKey,
      userId: contact.uid,
      channel: "app",
      title: renderMessage(campaign.title, vars),
      message: renderMessage(campaign.message, vars),
      ...(campaign.link ? { link: campaign.link } : {}),
      ...(campaign.couponCode ? { couponCode: campaign.couponCode } : {}),
      campaignId: campaign.id,
    });
    ctx.existing.add(dedupKey);
    ctx.recentByUser.set(contact.uid, (ctx.recentByUser.get(contact.uid) ?? 0) + 1);
  }

  return { planned, skipped };
}

/* ── Automações ────────────────────────────────────────────── */

/** Candidatos de uma automação (clientes que "disparam" o evento hoje). */
function candidatesFor(
  automation: MarketingAutomation,
  contacts: MarketingContact[],
  sessions: MarketingCartSession[],
  settings: MarketingSettings,
  now: Date,
): MarketingContact[] {
  const event = automation.event;
  const cfg = automation.config ?? {};
  switch (event) {
    case "welcome": {
      const cutoff = new Date(now.getTime() - TWO_DAYS_MS).getTime();
      return contacts.filter((c) => c.createdAt && new Date(c.createdAt).getTime() >= cutoff);
    }
    case "first_purchase": {
      const cutoff = new Date(now.getTime() - TWO_DAYS_MS).getTime();
      return contacts.filter(
        (c) =>
          c.ordersCount === 1 &&
          c.lastOrderAt &&
          new Date(c.lastOrderAt).getTime() >= cutoff,
      );
    }
    case "birthday": {
      const before = cfg.birthdayDaysBefore ?? 0;
      return contacts.filter((c) => c.birthdayInDays != null && c.birthdayInDays <= before);
    }
    case "inactive_30": {
      const days = cfg.inactiveDays ?? 30;
      return contacts.filter((c) => c.daysSinceActivity >= days && c.daysSinceActivity < days + 30);
    }
    case "inactive_60":
      return contacts.filter((c) => c.daysSinceActivity >= 60);
    case "big_spender":
      return contacts.filter((c) => c.totalSpent >= settings.bigSpenderThreshold);
    case "points_expiring": {
      const days = cfg.pointsExpireInDays ?? 7;
      return contacts.filter(
        (c) => c.pointsExpiringInDays != null && c.pointsExpiringInDays <= days,
      );
    }
    case "promo_product": {
      const cat = cfg.productCategory;
      const prod = cfg.productId;
      const audience = cfg.promoAudience ?? "previous_buyers";
      const filterBase = (c: MarketingContact): boolean => {
        if (cat && !c.purchasedCategories.includes(cat)) return false;
        if (prod && !c.purchasedProducts.some((p) => p === prod)) return false;
        return true;
      };
      switch (audience) {
        case "previous_buyers":
          return contacts.filter((c) => c.ordersCount > 0 && filterBase(c));
        case "vip":
          return contacts.filter(
            (c) => c.totalSpent >= settings.bigSpenderThreshold && filterBase(c),
          );
        case "never_bought":
          return contacts.filter((c) => c.ordersCount === 0);
        case "inactive":
          return contacts.filter(
            (c) => c.daysSinceActivity >= (cfg.inactiveDays ?? 30) && filterBase(c),
          );
      }
      return [];
    }
    case "abandoned_cart": {
      const hours = cfg.cartHours ?? 24;
      const cutoff = new Date(now.getTime() - hours * 3600_000).getTime();
      const byUid = new Map(contacts.map((c) => [c.uid, c]));
      const out: MarketingContact[] = [];
      for (const s of sessions) {
        if (!s.itemsCount || s.itemsCount <= 0) continue;
        const updated = new Date(s.updatedAt).getTime();
        if (!Number.isFinite(updated) || updated < cutoff) continue;
        const contact = byUid.get(s.userId);
        if (contact) out.push(contact);
      }
      return out;
    }
  }
}

export function planAutomations(opts: {
  automations: MarketingAutomation[];
  contacts: MarketingContact[];
  sessions: MarketingCartSession[];
  settings: MarketingSettings;
  ctx: PlannerContext;
  now: Date;
}): {
  planned: PlannedMessage[];
  skipped: { userId: string; reason: string }[];
  /** Códigos de cupom que o executor precisa garantir que existam — apenas das
   *  automações que vão enviar pelo menos uma mensagem hoje (evita criar cupom
   *  diário para automação sem destinatários). */
  couponsNeeded: Set<string>;
} {
  const { automations, contacts, sessions, settings, ctx, now } = opts;
  const planned: PlannedMessage[] = [];
  const skipped: { userId: string; reason: string }[] = [];
  const couponsNeeded = new Set<string>();
  const plannedToday = new Set<string>();

  const sorted = [...automations].sort(
    (a, b) => AUTOMATION_PRIORITY[a.event] - AUTOMATION_PRIORITY[b.event],
  );

  for (const automation of sorted) {
    if (!automation.active) continue;

    const couponCode = automation.coupon
      ? automationCouponCode(automation.event, ctx.dayKey)
      : undefined;

    const candidates = candidatesFor(automation, contacts, sessions, settings, now);
    const limit = Math.min(candidates.length, settings.maxAudiencePerCampaign);

    for (let i = 0; i < limit; i++) {
      const contact = candidates[i];

      if (plannedToday.has(contact.uid)) {
        skipped.push({ userId: contact.uid, reason: "já recebeu outra automação hoje" });
        continue;
      }

      const dedupKey = automationExecutionKey(automation.id, contact.uid, ctx.dayKey);
      if (ctx.existing.has(dedupKey)) {
        skipped.push({ userId: contact.uid, reason: "dedup" });
        continue;
      }

      // Boas-vindas / 1ª compra enviam UMA vez por automação (não por dia).
      const onceEver = automation.event === "welcome" || automation.event === "first_purchase";
      if (onceEver && ctx.sentAutoUser.has(automationUserKey(automation.id, contact.uid))) {
        skipped.push({ userId: contact.uid, reason: "dedup (envio único)" });
        continue;
      }

      if (skippedAutoInterval(ctx, contact.uid)) {
        skipped.push({
          userId: contact.uid,
          reason: `anti-spam: intervalo de ${ctx.minDaysBetweenAuto}d entre campanhas automáticas`,
        });
        continue;
      }

      const check = shouldSend({
        recentExecutions: ctx.recentByUser.get(contact.uid) ?? 0,
        maxPerDay: ctx.maxPerDay,
        windowHours: ctx.windowHours,
      });
      if (!check.ok) {
        skipped.push({ userId: contact.uid, reason: check.reason ?? "anti-spam" });
        continue;
      }

      const vars = buildMessageVars(contact, {
        coupon: couponCode,
        couponValue: automation.coupon?.value,
        couponType: automation.coupon?.type,
        link: automation.link,
        product: automation.config?.productId,
        diasSemComprar: contact.daysSinceActivity,
      });
      planned.push({
        dedupKey,
        userId: contact.uid,
        channel: "app",
        title: renderMessage(automation.title, vars),
        message: renderMessage(automation.message, vars),
        ...(automation.link ? { link: automation.link } : {}),
        ...(couponCode ? { couponCode } : {}),
        automationId: automation.id,
        automationEvent: automation.event,
      });
      if (couponCode) couponsNeeded.add(couponCode);

      ctx.existing.add(dedupKey);
      ctx.recentByUser.set(contact.uid, (ctx.recentByUser.get(contact.uid) ?? 0) + 1);
      plannedToday.add(contact.uid);
      if (onceEver) ctx.sentAutoUser.add(automationUserKey(automation.id, contact.uid));
    }
  }

  return { planned, skipped, couponsNeeded };
}
