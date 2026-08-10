/**
 * Prioridades, rótulos e controle anti-spam do módulo de marketing.
 * Módulo puro e testável — não importa Firebase.
 */
import type {
  MarketingAutomationEvent,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingSegment,
  MarketingSegmentField,
  MarketingSegmentKind,
  MarketingSegmentOperator,
} from "@/types/marketing";

/* ── Prioridade de automações ──────────────────────────────── */
/** Menor número = maior prioridade. Quando o cliente se encaixa em várias
 *  automações no mesmo dia, a de menor número vence (evita mensagens repetidas).
 *  Ordem do negócio: Aniversário → Carrinho abandonado → Pontos expirando → VIP
 *  → Recuperação → Promoção. */
export const AUTOMATION_PRIORITY: Record<MarketingAutomationEvent, number> = {
  welcome: 1,
  first_purchase: 2,
  birthday: 3,
  abandoned_cart: 4,
  points_expiring: 5,
  big_spender: 6,
  inactive_30: 7,
  inactive_60: 8,
  promo_product: 9,
};

/* ── Rótulos (UI + relatórios) ─────────────────────────────── */
export const AUTOMATION_EVENT_LABELS: Record<MarketingAutomationEvent, string> = {
  welcome: "Boas-vindas",
  first_purchase: "Primeira compra",
  birthday: "Aniversário",
  abandoned_cart: "Carrinho abandonado",
  points_expiring: "Pontos expirando",
  big_spender: "Cliente VIP",
  inactive_30: "Recuperação (inativo)",
  inactive_60: "Recuperação avançada",
  promo_product: "Promoção de produto",
};

export const AUTOMATION_EVENT_DESCRIPTIONS: Record<MarketingAutomationEvent, string> = {
  welcome: "Novo cadastro (primeiros dias). Envia uma única vez.",
  first_purchase: "Logo após a 1ª compra paga. Envia uma única vez.",
  birthday: "No aniversário do cliente (X dias antes, configurável).",
  abandoned_cart: "Carrinho com itens abandonado há X horas (configurável).",
  points_expiring: "Pontos do Clube Shark prestes a expirar (X dias, configurável).",
  big_spender: "Gasto total acima do limite configurado (VIP).",
  inactive_30: "Sem compra há X dias (configurável).",
  inactive_60: "Sem compra há muito tempo (60+ dias).",
  promo_product: "Promoção de produto/categoria para um público-alvo.",
};

export const CAMPAIGN_STATUS_LABELS: Record<MarketingCampaignStatus, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sent: "Enviada",
  cancelled: "Cancelada",
};

export const CAMPAIGN_OBJECTIVE_LABELS: Record<MarketingCampaignObjective, string> = {
  recover: "Recuperar clientes",
  increase_sales: "Aumentar vendas",
  promote_product: "Divulgar produto",
  birthday: "Aniversário",
  loyalty: "Fidelização",
  first_purchase: "Primeira compra",
  abandoned_cart: "Recuperar carrinho",
  promo: "Divulgar promoção",
  points_expiring: "Expiração de pontos",
};

export const CAMPAIGN_CHANNEL_LABELS: Record<MarketingChannel, string> = {
  app: "Notificação (app)",
  whatsapp: "WhatsApp",
};

export const SEGMENT_KIND_LABELS: Record<MarketingSegmentKind, string> = {
  all: "Todos os clientes",
  rules: "Por regras",
  manual: "Lista manual",
};

export const SEGMENT_PRESET_LABELS: Record<NonNullable<MarketingSegment["preset"]>, string> = {
  vip: "Cliente VIP",
  recorrente: "Cliente recorrente",
  em_risco: "Cliente em risco",
  perdido: "Cliente perdido",
  aniversariante: "Aniversariantes",
  primeira_compra: "Primeira compra",
  carrinho_abandonado: "Carrinho abandonado",
  pontos_expirando: "Pontos próximos de expirar",
};

export const SEGMENT_FIELD_LABELS: Record<MarketingSegmentField, string> = {
  totalSpent: "Gasto total (R$)",
  ordersCount: "Nº de pedidos",
  ticketAvg: "Ticket médio (R$)",
  lastOrderDays: "Dias desde a última compra",
  firstOrderDays: "Dias desde a primeira compra",
  lastOrderValue: "Valor do último pedido (R$)",
  birthdayInDays: "Dias até o aniversário",
  pointsExpiringInDays: "Dias até pontos expirarem",
  loyaltyPoints: "Saldo de pontos",
  loyaltyLevel: "Nível do clube",
  city: "Cidade",
  neighborhood: "Bairro",
  purchasedCategory: "Categoria comprada",
  purchasedProduct: "Produto comprado",
  birthdayMonth: "Mês de aniversário (1–12)",
  hasPhone: "Tem telefone",
  hasCpf: "Tem CPF",
};

export const SEGMENT_OPERATOR_LABELS: Record<MarketingSegmentOperator, string> = {
  gt: "maior que",
  gte: "maior ou igual a",
  lt: "menor que",
  lte: "menor ou igual a",
  eq: "igual a",
  neq: "diferente de",
};

/* ── Anti-spam ─────────────────────────────────────────────── */
export interface SpamCheckInput {
  /** Mensagens de marketing já enviadas ao cliente na janela. */
  recentExecutions: number;
  /** Máximo permitido por janela. */
  maxPerDay: number;
  /** Janela em horas. */
  windowHours: number;
}

export function shouldSend({
  recentExecutions,
  maxPerDay,
  windowHours,
}: SpamCheckInput): { ok: boolean; reason?: string } {
  if (recentExecutions >= maxPerDay) {
    return {
      ok: false,
      reason: `anti-spam: ${recentExecutions}/${maxPerDay} mensagens na janela de ${windowHours}h`,
    };
  }
  return { ok: true };
}
