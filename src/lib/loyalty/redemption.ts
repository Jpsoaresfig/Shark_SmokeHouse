/**
 * Motor de regras de resgate por pontos (Task 3.6) — módulo puro e testável.
 *
 * Decide se um produto pode ser resgatado por pontos e quanto custa, aplicando:
 *  1. Trava de segurança financeira: margem de lucro < 20% bloqueia o resgate;
 *  2. Fórmula automática: itens elegíveis custam Valor do Produto × 200 pontos;
 *  3. Overwrite manual por produto: desativar o resgate, ou sobrescrever o custo
 *     em pontos (que também libera o item, assumindo a decisão do admin).
 */

/** Pontos por R$ 1,00 no resgate: custo = valor × 200. */
export const REDEMPTION_POINTS_PER_REAL = 200;

/** Margem mínima de lucro (20%) para liberar o resgate automaticamente. */
export const MIN_REDEMPTION_MARGIN = 0.2;

export interface RedeemableInput {
  price?: number;
  /** Custo de aquisição por unidade (R$). Necessário para calcular a margem. */
  costPrice?: number;
  /** Imposto (%) sobre o produto. */
  taxPercent?: number;
  /** Overwrite: desativa o resgate deste item, independente da margem. */
  redeemDisabled?: boolean;
  /** Overwrite: custo manual em pontos, ignorando a fórmula (e a trava de margem). */
  loyaltyPointsOverride?: number;
}

export type RedemptionBasis =
  | "disabled"      // desativado manualmente
  | "no-cost"       // sem custo cadastrado → margem indeterminada → bloqueado
  | "below-margin"  // margem < 20% → bloqueado pela trava financeira
  | "override"      // custo manual (overwrite)
  | "formula";      // fórmula padrão (valor × 200)

export interface RedemptionResult {
  /** Produto pode ser resgatado por pontos? */
  eligible: boolean;
  /** Custo em pontos quando elegível; null caso contrário. */
  pointsCost: number | null;
  /** Motivo do resultado (para UI/auditoria). */
  basis: RedemptionBasis;
  /** Margem de lucro calculada (fração); null quando indeterminada. */
  margin: number | null;
  /** Custo pela fórmula padrão (valor × 200), exibido mesmo havendo override. */
  formulaCost: number | null;
}

/**
 * Margem de lucro: (preço − custo − imposto) / preço.
 * Retorna null quando não dá para calcular (sem preço positivo ou sem custo).
 */
export function computeMargin(input: {
  price?: number;
  costPrice?: number;
  taxPercent?: number;
}): number | null {
  const price = Number(input.price) || 0;
  if (price <= 0) return null;
  if (input.costPrice == null) return null;
  const cost = Number(input.costPrice) || 0;
  const tax = price * ((Number(input.taxPercent) || 0) / 100);
  return (price - cost - tax) / price;
}

/** Aplica todas as regras de resgate e retorna a decisão completa. */
export function computeRedemption(input: RedeemableInput): RedemptionResult {
  const price = Number(input.price) || 0;
  const margin = computeMargin(input);
  const formulaCost = price > 0 ? Math.round(price * REDEMPTION_POINTS_PER_REAL) : null;
  const override = input.loyaltyPointsOverride;

  // Desativado manualmente vence qualquer outra regra.
  if (input.redeemDisabled) {
    return { eligible: false, pointsCost: null, basis: "disabled", margin, formulaCost };
  }
  // Override manual: ignora a fórmula E a trava de margem (decisão explícita do admin).
  if (override != null && override > 0) {
    return { eligible: true, pointsCost: Math.round(override), basis: "override", margin, formulaCost };
  }
  // Sem custo cadastrado → margem indeterminada → bloqueia por segurança.
  if (margin == null) {
    return { eligible: false, pointsCost: null, basis: "no-cost", margin, formulaCost };
  }
  // Trava de segurança financeira: margem abaixo de 20% bloqueia automaticamente.
  if (margin < MIN_REDEMPTION_MARGIN) {
    return { eligible: false, pointsCost: null, basis: "below-margin", margin, formulaCost };
  }
  // Elegível pela fórmula padrão.
  return { eligible: true, pointsCost: formulaCost, basis: "formula", margin, formulaCost };
}
