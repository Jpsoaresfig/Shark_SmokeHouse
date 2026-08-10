/**
 * Tipos do Módulo de Marketing — segmentação de clientes, campanhas, automações
 * e cupons promocionais. Fonte única de verdade para o painel /admin/marketing,
 * para o cron diário (/api/cron/marketing) e para os eventos por cliente.
 */
import type { CouponType } from "@/types";

/* ── Canais ───────────────────────────────────────────────── */
/* Só "app" e "whatsapp": não há envio real de e-mail no módulo (e-mail fake
   enganava o admin no painel). WhatsApp é manual (botão por cliente). */
export type MarketingChannel = "app" | "whatsapp";

/* ── Eventos registrados por cliente ──────────────────────── */
export type MarketingEventType =
  | "welcome"
  | "first_purchase"
  | "birthday"
  | "abandoned_cart"
  | "big_spender"
  | "inactive"
  | "points_expiring"
  | "promo_product"
  | "campaign"
  | "coupon_created"
  | "whatsapp_opened"
  | "whatsapp_copied"
  | "campaign_clicked";

export interface MarketingEvent {
  id: string;
  userId: string;
  type: MarketingEventType;
  campaignId?: string;
  automationId?: string;
  message?: string;
  couponCode?: string;
  link?: string;
  /** ISO. */
  createdAt: string;
}

/* ── Segmento ─────────────────────────────────────────────── */
export type MarketingSegmentKind = "all" | "rules" | "manual";

/** Campos disponíveis nas regras de segmentação (contato enriquecido). */
export type MarketingSegmentField =
  | "totalSpent"
  | "ordersCount"
  | "ticketAvg"
  | "lastOrderDays"
  | "firstOrderDays"
  | "lastOrderValue"
  | "birthdayInDays"
  | "pointsExpiringInDays"
  | "loyaltyPoints"
  | "loyaltyLevel"
  | "city"
  | "neighborhood"
  | "purchasedCategory"
  | "purchasedProduct"
  | "birthdayMonth"
  | "hasPhone"
  | "hasCpf";

export type MarketingSegmentOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

export interface MarketingSegmentRule {
  field: MarketingSegmentField;
  op: MarketingSegmentOperator;
  /** Número (gasto, dias…), string (nível) ou booleano (tem telefone/CPF). */
  value: string | number | boolean;
}

export interface MarketingSegment {
  id: string;
  name: string;
  description?: string;
  /** all = todos; rules = regras combinadas com AND; manual = lista de uids. */
  kind: MarketingSegmentKind;
  rules: MarketingSegmentRule[];
  userIds: string[];
  /** Segmento padrão do sistema (VIP, inativo, aniversariante…). */
  preset?: "vip" | "recorrente" | "em_risco" | "perdido" | "aniversariante" | "primeira_compra" | "carrinho_abandonado" | "pontos_expirando";
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** uid de quem criou/alterou (auditoria). */
  createdBy?: string;
  updatedBy?: string;
}

/* ── Auditoria (nada de alteração silenciosa) ─────────────── */
export type MarketingAuditAction =
  | "created"
  | "updated"
  | "activated"
  | "deactivated"
  | "cancelled"
  | "sent"
  | "scheduled"
  | "coupon_created";

export interface MarketingAuditEvent {
  action: MarketingAuditAction;
  by: string;
  at: string;
  note?: string;
}

/* ── Campanha ─────────────────────────────────────────────── */
export type MarketingCampaignStatus = "draft" | "scheduled" | "sent" | "cancelled";

export type MarketingCampaignObjective =
  | "recover"
  | "increase_sales"
  | "promote_product"
  | "birthday"
  | "loyalty"
  | "first_purchase"
  | "abandoned_cart"
  | "promo"
  | "points_expiring";

/** Cupom criado/configurado DENTRO da campanha (reusa o mecanismo existente). */
export interface MarketingCampaignCoupon {
  /** % (type=percent) ou R$ (type=fixed). */
  type: CouponType;
  /** Valor do desconto. */
  value: number;
  /** Pedido mínimo para valer (R$). */
  minOrder?: number;
  /** Validade em dias (a partir do envio). */
  expiresInDays: number;
  /** Limite de usos por CPF. */
  usageLimitPerCpf?: number;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  description?: string;
  /** Segmento-alvo (deve existir e estar ativo para enviar). */
  segmentId: string;
  /** Objetivo da campanha (recuperar clientes, aniversário, promoção…). */
  objective: MarketingCampaignObjective;
  channel: MarketingChannel;
  title: string;
  message: string;
  /** Destino ao tocar a notificação (ex.: "/catalog?produto=<id>"). */
  link?: string;
  /** Cupom vinculado (criado antes, via painel de cupons). */
  couponCode?: string;
  /** Configuração para criar o cupom no envio (via mecanismo existente). */
  coupon?: MarketingCampaignCoupon;
  status: MarketingCampaignStatus;
  /** ISO — quando enviar (cron dispara as que estiverem com data <= agora). */
  scheduledFor: string;
  sentAt?: string;
  /** "cron" ou uid do admin que usou "Enviar agora". */
  executedBy?: string;
  sentCount?: number;
  /** Snapshot do público no envio (para relatório sem depender do segmento). */
  segmentSnapshot?: { name: string; size: number };
  /** Trilha de auditoria (quem criou/editou/ativou/cancelou/executou). */
  audit?: MarketingAuditEvent[];
  createdAt: string;
  updatedAt: string;
}

/* ── Automação ────────────────────────────────────────────── */
export type MarketingAutomationEvent =
  | "welcome"
  | "first_purchase"
  | "birthday"
  | "inactive_30"
  | "inactive_60"
  | "big_spender"
  | "abandoned_cart"
  | "points_expiring"
  | "promo_product";

/** Configuração paramétrica de uma automação (dias, horas, público…). */
export interface MarketingAutomationConfig {
  /** Dias sem compra para a "recuperação de cliente" (inactive_30/60). */
  inactiveDays?: number;
  /** Dias ANTES do aniversário para disparar (0 = no próprio dia). */
  birthdayDaysBefore?: number;
  /** Horas após o carrinho ser abandonado para disparar (1h–48h). */
  cartHours?: number;
  /** Dias antes da expiração de pontos para avisar. */
  pointsExpireInDays?: number;
  /** Promoção de produto — slug da categoria-alvo. */
  productCategory?: string;
  /** Promoção de produto — id do produto-alvo. */
  productId?: string;
  /** Promoção de produto — público-alvo. */
  promoAudience?: "previous_buyers" | "vip" | "never_bought" | "inactive";
}

export interface MarketingAutomationCoupon {
  type: CouponType;
  value: number;
  /** Pedido mínimo para o cupom valer (R$). Opcional. */
  minOrder?: number;
  /** Validade do cupom gerado, em dias. */
  expiresInDays: number;
  /** Limite de usos por CPF. */
  usageLimitPerCpf?: number;
}

export interface MarketingAutomation {
  id: string;
  name: string;
  event: MarketingAutomationEvent;
  title: string;
  message: string;
  link?: string;
  /** Parâmetros do trigger (dias/horas/público). */
  config?: MarketingAutomationConfig;
  /** Quando presente, o cron gera um cupom para a automação (1 por dia). */
  coupon?: MarketingAutomationCoupon;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ── Template (sugestões prontas) ─────────────────────────── */
export interface MarketingTemplate {
  id: string;
  name: string;
  event?: MarketingAutomationEvent;
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  updatedAt: string;
}

/* ── Execução (mensagem individual planejada/persistida) ──── */
export interface MarketingExecution {
  /** Doc id = dedupKey (garante idempotência ao reexecutar). */
  id: string;
  campaignId?: string;
  automationId?: string;
  automationEvent?: MarketingAutomationEvent;
  userId: string;
  channel: MarketingChannel;
  title: string;
  /** Mensagem já renderizada com os placeholders do cliente. */
  message: string;
  link?: string;
  couponCode?: string;
  /** Chave de deduplicação: campaign:{id}:{uid} | auto:{id}:{uid}:{YYYY-MM-DD}. */
  dedupKey: string;
  status: "pending" | "processed" | "failed" | "cancelled" | "skipped_spam" | "error";
  reason?: string;
  /** ISO. */
  createdAt: string;
}

/* ── Contato enriquecido (derivado para segmentação) ──────── */
export interface MarketingContact {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  hasPhone: boolean;
  hasCpf: boolean;
  loyaltyPoints: number;
  /** Nome do nível (getLevel). */
  loyaltyLevel: string;
  /** Pedidos + vendas vinculadas (não canceladas). */
  ordersCount: number;
  totalSpent: number;
  /** Ticket médio (totalSpent ÷ ordersCount; 0 quando nunca comprou). */
  ticketAvg: number;
  /** Valor (R$) da última compra. */
  lastOrderValue?: number;
  lastOrderAt?: string;
  /** Dias desde a última compra (null = nunca comprou). */
  lastOrderDays: number | null;
  /** Primeira compra (data ISO). */
  firstOrderAt?: string;
  /** Dias desde a primeira compra (null = nunca comprou). */
  firstOrderDays: number | null;
  /** Dias desde a última atividade (compra ou, sem compras, desde o cadastro). */
  daysSinceActivity: number;
  /** 1–12 (null = sem data de nascimento). */
  birthdayMonth: number | null;
  /** Data de nascimento "YYYY-MM-DD" (para placeholders de aniversário). */
  birthDate?: string;
  /** Dias até o próximo aniversário (0 = hoje; null = sem data de nascimento). */
  birthdayInDays: number | null;
  /** Dias até o próximo lote de pontos expirar (null = sem pontos a expirar). */
  pointsExpiringInDays: number | null;
  /** Slugs das categorias compradas. */
  purchasedCategories: string[];
  /** Nomes dos produtos comprados. */
  purchasedProducts: string[];
  /** Cidade da entrega (último pedido/endereço padrão). */
  city?: string;
  /** Bairro da entrega (último pedido/endereço padrão). */
  neighborhood?: string;
  referredBy?: string;
  /** ISO — data do cadastro. */
  createdAt: string;
}

/* ── Configuração (marketingSettings/defaults) ────────────── */
export interface MarketingSettings {
  /** Kill switch global do cron de marketing. */
  active: boolean;
  /** Máx. de mensagens de marketing por cliente na janela. */
  maxPerDay: number;
  /** Janela anti-spam, em horas. */
  windowHours: number;
  /** Intervalo mínimo entre campanhas/automações automáticas por cliente (dias). */
  minDaysBetweenAuto: number;
  /** Gasto total mínimo para a automação "grandes compradores" / VIP. */
  bigSpenderThreshold: number;
  /** Limite de destinatários por campanha/automação por execução. */
  maxAudiencePerCampaign: number;
  /** ISO. */
  updatedAt: string;
}

/* ── Sessão de carrinho (para a automação de carrinho abandonado) ── */
export interface MarketingCartSession {
  userId: string;
  itemsCount: number;
  subtotal: number;
  /** ISO. */
  updatedAt: string;
}
