/**
 * Segmentos padrão (presets) do módulo de marketing — módulo puro.
 *
 * Os presets são materializados como segmentos com regras prontas (VIP,
 * recorrente, em risco…) para o painel. A exceção é "carrinho abandonado",
 * que não deriva de regras de contato: ele é avaliado contra as sessões de
 * carrinho (na automação e no preview de público) e, como segmento, fica
 * vazio e seguro (não casa ninguém por regra).
 */
import type { MarketingContact, MarketingSegment, MarketingSettings } from "@/types/marketing";
import type { MarketingSegmentRule } from "@/types/marketing";

export type SegmentPreset =
  | "vip"
  | "recorrente"
  | "em_risco"
  | "perdido"
  | "aniversariante"
  | "primeira_compra"
  | "carrinho_abandonado"
  | "pontos_expirando";

export interface PresetMeta {
  preset: SegmentPreset;
  name: string;
  description: string;
  /** Dias usados como padrão em regras "em X dias". */
  defaultDays?: number;
}

export const SEGMENT_PRESETS: readonly PresetMeta[] = [
  {
    preset: "vip",
    name: "Cliente VIP",
    description: "Gasto total igual ou acima do limite de VIP configurado.",
  },
  {
    preset: "recorrente",
    name: "Cliente recorrente",
    description: "2+ compras e última compra nos últimos 60 dias.",
    defaultDays: 60,
  },
  {
    preset: "em_risco",
    name: "Cliente em risco",
    description: "Sem comprar entre 30 e 90 dias.",
    defaultDays: 30,
  },
  {
    preset: "perdido",
    name: "Cliente perdido",
    description: "Sem comprar há 90 dias ou mais.",
    defaultDays: 90,
  },
  {
    preset: "aniversariante",
    name: "Aniversariantes",
    description: "Aniversário nos próximos 7 dias.",
    defaultDays: 7,
  },
  {
    preset: "primeira_compra",
    name: "Primeira compra",
    description: "1 compra, realizada nos últimos 7 dias.",
    defaultDays: 7,
  },
  {
    preset: "carrinho_abandonado",
    name: "Carrinho abandonado",
    description: "Carrinho com itens abandonado (avaliado por sessão, não por regra).",
  },
  {
    preset: "pontos_expirando",
    name: "Pontos próximos de expirar",
    description: "Pontos do Clube Shark expiram nos próximos 7 dias.",
    defaultDays: 7,
  },
];

function numberRule(
  field: MarketingSegmentRule["field"],
  op: MarketingSegmentRule["op"],
  value: number,
): MarketingSegmentRule {
  return { field, op, value };
}

/** Regras padrão de um preset de segmento (vazio/seguro p/ carrinho abandonado). */
export function presetRules(
  preset: SegmentPreset,
  settings: Pick<MarketingSettings, "bigSpenderThreshold">,
): MarketingSegmentRule[] {
  switch (preset) {
    case "vip":
      return [numberRule("totalSpent", "gte", settings.bigSpenderThreshold)];
    case "recorrente":
      return [
        numberRule("ordersCount", "gte", 2),
        numberRule("lastOrderDays", "lte", 60),
      ];
    case "em_risco":
      return [
        numberRule("lastOrderDays", "gte", 30),
        numberRule("lastOrderDays", "lte", 90),
      ];
    case "perdido":
      return [numberRule("lastOrderDays", "gte", 90)];
    case "aniversariante":
      return [numberRule("birthdayInDays", "lte", 7)];
    case "primeira_compra":
      return [
        numberRule("ordersCount", "eq", 1),
        numberRule("lastOrderDays", "lte", 7),
      ];
    case "pontos_expirando":
      return [numberRule("pointsExpiringInDays", "lte", 7)];
    case "carrinho_abandonado":
      return [];
  }
}

/** Esboço pronto para criar o segmento padrão no Firestore (idempotente). */
export function presetSegmentDraft(
  preset: SegmentPreset,
  settings: Pick<MarketingSettings, "bigSpenderThreshold">,
): Omit<MarketingSegment, "id" | "createdAt" | "updatedAt"> {
  const meta = SEGMENT_PRESETS.find((p) => p.preset === preset)!;
  const rules = presetRules(preset, settings);
  return {
    name: meta.name,
    description: meta.description,
    kind: rules.length > 0 ? "rules" : "manual",
    rules,
    userIds: [],
    preset,
    active: true,
  };
}

/** Presets de um contato (badges na listagem) — sem carrinho abandonado, que
 *  depende de sessão e é tratado à parte no painel. */
export function categorizeContact(
  contact: MarketingContact,
  settings: Pick<MarketingSettings, "bigSpenderThreshold">,
): SegmentPreset[] {
  const out: SegmentPreset[] = [];
  for (const p of SEGMENT_PRESETS) {
    if (p.preset === "carrinho_abandonado") continue;
    const rules = presetRules(p.preset, settings);
    if (rules.every((r) => matchesRule(contact, r))) out.push(p.preset);
  }
  return out;
}

/** Avalia uma regra de preset contra o contato (mesma semântica da segmentação). */
function matchesRule(
  contact: MarketingContact,
  rule: MarketingSegmentRule,
): boolean {
  const value = ruleValue(contact, rule.field);
  const expected = rule.value;
  switch (rule.op) {
    case "gt":
      return typeof value === "number" && typeof expected === "number" && value > expected;
    case "gte":
      return typeof value === "number" && typeof expected === "number" && value >= expected;
    case "lt":
      return typeof value === "number" && typeof expected === "number" && value < expected;
    case "lte":
      return typeof value === "number" && typeof expected === "number" && value <= expected;
    case "eq":
      return value === expected;
    case "neq":
      return value !== expected;
  }
}

function ruleValue(contact: MarketingContact, field: MarketingSegmentRule["field"]) {
  switch (field) {
    case "totalSpent":
      return contact.totalSpent;
    case "ordersCount":
      return contact.ordersCount;
    case "lastOrderDays":
      return contact.lastOrderDays;
    case "birthdayInDays":
      return contact.birthdayInDays;
    case "pointsExpiringInDays":
      return contact.pointsExpiringInDays;
    default:
      return null;
  }
}
