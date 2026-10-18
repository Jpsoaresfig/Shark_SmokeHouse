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
} from "@/types/marketing";
import { resolveAudience } from "./segmentation";
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
  /** Último envio (ms epoch) por "auto:{automationId}:{uid}" — usado para o
   *  aniversário sair 1x por ano. Opcional. */
  lastSentByAutoUser?: Map<string, number>;
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

/** Motivo registrado quando o cliente recusou marketing (LGPD). */
export const OPT_OUT_REASON = "opt-out (LGPD)";

/**
 * Aniversário: 1 envio por aniversário. Com `birthdayDaysBefore` = N o cliente
 * fica elegível por N+1 dias seguidos e a dedup diária deixava a mesma
 * mensagem (e cupom) sair todos os dias da janela.
 */
const BIRTHDAY_RESEND_GUARD_DAYS = 300;

/**
 * Reenvio das automações "de estado" (o cliente continua elegível dia após dia).
 * Sem trava, o único freio era o intervalo anti-spam entre automáticas (7 dias
 * por padrão) e a mesma mensagem — com cupom — saía para sempre a cada 7 dias.
 *
 *  - inactive_30 / inactive_60 / abandoned_cart: UMA vez por "episódio" — só
 *    reenvia se o cliente teve atividade nova (compra/carrinho atualizado)
 *    DEPOIS do último envio desta automação (ver `episodeAt` dos candidatos);
 *  - big_spender: no máx. 1 vez a cada 180 dias (reconhecimento periódico do VIP);
 *  - promo_product: no máx. 1 vez a cada 30 dias por automação (a promoção pode
 *    ser trocada pelo admin, mas o mesmo cliente não recebe toda semana).
 *
 * Usa o mesmo mecanismo do aniversário (`lastSentByAutoUser`, último envio por
 * automação+cliente, derivado das execuções persistidas).
 */
export const AUTOMATION_RESEND_COOLDOWN_DAYS: Partial<Record<MarketingAutomationEvent, number>> = {
  big_spender: 180,
  promo_product: 30,
  // Fallback para inativos sem data de atividade conhecida (episódio indefinido).
  inactive_30: 30,
  inactive_60: 60,
};

/**
 * Carrinho abandonado: além das N horas de inatividade, o carrinho precisa ter
 * sido atualizado dentro desta folga extra. O cron roda 1x/dia, então a janela
 * de seleção precisa cobrir 24h (mais margem para atraso do cron); a trava de
 * episódio impede o lembrete duplicado do mesmo carrinho.
 */
export const ABANDONED_CART_LOOKBACK_EXTRA_HOURS = 36;

/** Candidato de uma automação + início do "episódio" que o tornou elegível. */
interface Candidate {
  contact: MarketingContact;
  /** ms epoch — início do episódio (última compra, carrinho atualizado…). */
  episodeAt?: number;
}

/** Ids de produto do Firestore (20 caracteres alfanuméricos) — nunca mostrar ao cliente. */
const FIRESTORE_ID_RE = /^[A-Za-z0-9]{20}$/;

/**
 * Resolve o produto em destaque de "promoção de produto" para o NOME. O painel
 * grava o nome digitado (datalist de nomes) em `config.productId`; dados antigos
 * podem ter o id. Aceita os dois: id → nome; nome (sem diferenciar maiúsculas)
 * → nome do catálogo; sem correspondência, o texto digitado (se não for um id).
 */
export function resolvePromoProductName(
  ref: string | undefined,
  products?: { id: string; name?: string }[],
): string | undefined {
  const v = ref?.trim();
  if (!v) return undefined;
  const byId = products?.find((p) => p.id === v)?.name?.trim();
  if (byId) return byId;
  const lower = v.toLowerCase();
  const byName = products?.find((p) => p.name?.trim().toLowerCase() === lower)?.name?.trim();
  if (byName) return byName;
  return FIRESTORE_ID_RE.test(v) ? undefined : v;
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
  // O limite vale para quem REALMENTE recebe: aplicado depois dos filtros
  // (opt-out, dedup, anti-spam). Antes cortava o público bruto e, com muitos
  // bloqueados entre os primeiros, a campanha saía para bem menos gente.
  const limit = cap && cap > 0 ? cap : Infinity;

  for (const contact of audience) {
    if (planned.length >= limit) break;
    const dedupKey = campaignExecutionKey(campaign.id, contact.uid);

    if (contact.marketingOptOut) {
      skipped.push({ userId: contact.uid, reason: OPT_OUT_REASON });
      continue;
    }

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
  promoProductName?: string,
): Candidate[] {
  const event = automation.event;
  const cfg = automation.config ?? {};
  const plain = (list: MarketingContact[]): Candidate[] => list.map((contact) => ({ contact }));
  /** Início do episódio de inatividade = última compra (ou o cadastro). */
  const activityAt = (c: MarketingContact): number | undefined => {
    const t = new Date(c.lastOrderAt ?? c.createdAt ?? "").getTime();
    return Number.isFinite(t) ? t : undefined;
  };
  switch (event) {
    case "welcome": {
      const cutoff = new Date(now.getTime() - TWO_DAYS_MS).getTime();
      return plain(contacts.filter((c) => c.createdAt && new Date(c.createdAt).getTime() >= cutoff));
    }
    case "first_purchase": {
      const cutoff = new Date(now.getTime() - TWO_DAYS_MS).getTime();
      return plain(contacts.filter(
        (c) =>
          c.ordersCount === 1 &&
          c.lastOrderAt &&
          new Date(c.lastOrderAt).getTime() >= cutoff,
      ));
    }
    case "birthday": {
      const before = cfg.birthdayDaysBefore ?? 0;
      return plain(contacts.filter((c) => c.birthdayInDays != null && c.birthdayInDays <= before));
    }
    case "inactive_30": {
      const days = cfg.inactiveDays ?? 30;
      return contacts
        .filter((c) => c.daysSinceActivity >= days && c.daysSinceActivity < days + 30)
        .map((contact) => ({ contact, episodeAt: activityAt(contact) }));
    }
    case "inactive_60":
      return contacts
        .filter((c) => c.daysSinceActivity >= 60)
        .map((contact) => ({ contact, episodeAt: activityAt(contact) }));
    case "big_spender":
      return plain(contacts.filter((c) => c.totalSpent >= settings.bigSpenderThreshold));
    case "points_expiring": {
      const days = cfg.pointsExpireInDays ?? 7;
      // Só avisa quem ainda TEM saldo (quem já gastou tudo não tem o que perder).
      return plain(contacts.filter(
        (c) =>
          c.loyaltyPoints > 0 &&
          c.pointsExpiringInDays != null &&
          c.pointsExpiringInDays <= days,
      ));
    }
    case "promo_product": {
      const cat = cfg.productCategory;
      // `purchasedProducts` guarda NOMES; compara pelo nome resolvido.
      const prod = (promoProductName ?? cfg.productId)?.trim().toLowerCase();
      const audience = cfg.promoAudience ?? "previous_buyers";
      const filterBase = (c: MarketingContact): boolean => {
        if (cat && !c.purchasedCategories.includes(cat)) return false;
        if (prod && !c.purchasedProducts.some((p) => p.trim().toLowerCase() === prod)) return false;
        return true;
      };
      switch (audience) {
        case "previous_buyers":
          return plain(contacts.filter((c) => c.ordersCount > 0 && filterBase(c)));
        case "vip":
          return plain(contacts.filter(
            (c) => c.totalSpent >= settings.bigSpenderThreshold && filterBase(c),
          ));
        case "never_bought":
          return plain(contacts.filter((c) => c.ordersCount === 0));
        case "inactive":
          return plain(contacts.filter(
            (c) => c.daysSinceActivity >= (cfg.inactiveDays ?? 30) && filterBase(c),
          ));
      }
      return [];
    }
    case "abandoned_cart": {
      // Carrinho parado há PELO MENOS N horas (e atualizado dentro de N + folga).
      // Antes exigia "atualizado nas últimas N horas": com o cron 1x/dia e N<24,
      // carrinhos abandonados à noite nunca entravam na janela.
      const hours = cfg.cartHours ?? 24;
      const idleCutoff = now.getTime() - hours * 3600_000;
      const lookback = now.getTime() - (hours + ABANDONED_CART_LOOKBACK_EXTRA_HOURS) * 3600_000;
      const byUid = new Map(contacts.map((c) => [c.uid, c]));
      const out: Candidate[] = [];
      for (const s of sessions) {
        if (!s.itemsCount || s.itemsCount <= 0) continue;
        const updated = new Date(s.updatedAt).getTime();
        if (!Number.isFinite(updated) || updated > idleCutoff || updated < lookback) continue;
        const contact = byUid.get(s.userId);
        if (contact) out.push({ contact, episodeAt: updated });
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
  /** Opcional — catálogo para o {{produto}} mostrar o NOME (não o id). */
  products?: { id: string; name?: string }[];
}): {
  planned: PlannedMessage[];
  skipped: { userId: string; reason: string }[];
  /** Códigos de cupom que o executor precisa garantir que existam — apenas das
   *  automações que vão enviar pelo menos uma mensagem hoje (evita criar cupom
   *  diário para automação sem destinatários). */
  couponsNeeded: Set<string>;
} {
  const { automations, contacts, sessions, settings, ctx, now, products } = opts;
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
      ? automationCouponCode(automation.id, automation.event, ctx.dayKey)
      : undefined;

    const promoProductName = automation.event === "promo_product"
      ? resolvePromoProductName(automation.config?.productId, products)
      : undefined;
    const candidates = candidatesFor(automation, contacts, sessions, settings, now, promoProductName);
    // Limite aplicado a quem efetivamente recebe (após opt-out/dedup/anti-spam),
    // igual às campanhas. 0/ausente = sem limite.
    const cap = settings.maxAudiencePerCampaign > 0 ? settings.maxAudiencePerCampaign : Infinity;
    let plannedForAutomation = 0;
    const cooldownDays = AUTOMATION_RESEND_COOLDOWN_DAYS[automation.event];

    for (const { contact, episodeAt } of candidates) {
      if (plannedForAutomation >= cap) break;

      if (contact.marketingOptOut) {
        skipped.push({ userId: contact.uid, reason: OPT_OUT_REASON });
        continue;
      }

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

      if (automation.event === "birthday") {
        const last = ctx.lastSentByAutoUser?.get(automationUserKey(automation.id, contact.uid));
        if (last != null && now.getTime() - last < BIRTHDAY_RESEND_GUARD_DAYS * DAY_MS) {
          skipped.push({ userId: contact.uid, reason: "dedup (aniversário já enviado)" });
          continue;
        }
      }

      // Automações "de estado": 1 envio por episódio ou por período de carência
      // (ver AUTOMATION_RESEND_COOLDOWN_DAYS).
      const lastSent = ctx.lastSentByAutoUser?.get(automationUserKey(automation.id, contact.uid));
      if (lastSent != null) {
        if (episodeAt != null) {
          if (lastSent >= episodeAt) {
            skipped.push({ userId: contact.uid, reason: "dedup (já enviado neste ciclo)" });
            continue;
          }
        } else if (cooldownDays && now.getTime() - lastSent < cooldownDays * DAY_MS) {
          skipped.push({ userId: contact.uid, reason: `dedup (reenvio só após ${cooldownDays}d)` });
          continue;
        }
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
        // Nome do produto; sem catálogo/produto, um texto neutro em vez do id
        // cru (antes a mensagem saía "selecionamos aB3xY9… com desconto").
        product:
          promoProductName ??
          (automation.event === "promo_product" ? "produtos selecionados" : undefined),
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
      plannedForAutomation++;

      ctx.existing.add(dedupKey);
      ctx.recentByUser.set(contact.uid, (ctx.recentByUser.get(contact.uid) ?? 0) + 1);
      plannedToday.add(contact.uid);
      if (onceEver) ctx.sentAutoUser.add(automationUserKey(automation.id, contact.uid));
      ctx.lastSentByAutoUser?.set(automationUserKey(automation.id, contact.uid), now.getTime());
    }
  }

  return { planned, skipped, couponsNeeded };
}
