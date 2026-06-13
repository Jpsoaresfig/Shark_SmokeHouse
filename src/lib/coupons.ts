/**
 * Motor de validação de cupons de desconto (Task 3.3) — módulo puro e testável.
 *
 * Aplica, na ordem, as travas configuradas por cupom:
 *  - ativo / não expirado;
 *  - restrição por categorias (desconto incide só sobre os itens elegíveis);
 *  - valor mínimo do pedido;
 *  - limite de uso por CPF.
 * Não importa Firebase — quem chama injeta o contexto (itens, CPF, usos prévios).
 */

import type { Coupon } from "@/types";

/** Normaliza um código digitado/colado: maiúsculas, sem espaços. */
export function normalizeCouponCode(raw: string): string {
  return (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Data local no formato "YYYY-MM-DD" (para comparar expiração de forma inclusiva). */
function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export interface CouponCartItem {
  /** Slug da categoria do produto (para restrição por categoria). */
  categorySlug: string;
  /** Preço × quantidade da linha (R$). */
  lineTotal: number;
}

export interface CouponContext {
  items: CouponCartItem[];
  /** CPF do cliente (dígitos). Necessário quando há limite por CPF. */
  cpf?: string;
  /** Quantas vezes este CPF já usou este cupom. */
  priorUsesForCpf?: number;
  now?: Date;
}

export type CouponInvalidReason =
  | "inactive"
  | "expired"
  | "no-eligible-items"
  | "min-order"
  | "cpf-required"
  | "limit-reached";

export interface CouponEvaluation {
  valid: boolean;
  reason?: CouponInvalidReason;
  message?: string;
  /** Desconto em R$ (0 quando inválido). */
  discount: number;
  /** Base elegível considerada (subtotal dos itens das categorias permitidas). */
  eligibleBase: number;
}

/** Um cupom já expirou em relação a `now`? (validade inclusiva no dia). */
export function isCouponExpired(expiresAt: string | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false;
  return toYMD(now) > expiresAt;
}

/** Avalia um cupom contra o carrinho/cliente e calcula o desconto. */
export function evaluateCoupon(coupon: Coupon, ctx: CouponContext): CouponEvaluation {
  const now = ctx.now ?? new Date();
  const cartSubtotal = ctx.items.reduce((s, i) => s + i.lineTotal, 0);
  const restricted = (coupon.categories?.length ?? 0) > 0;
  const eligibleBase = restricted
    ? ctx.items
        .filter((i) => coupon.categories!.includes(i.categorySlug))
        .reduce((s, i) => s + i.lineTotal, 0)
    : cartSubtotal;

  const fail = (reason: CouponInvalidReason, message: string): CouponEvaluation => ({
    valid: false, reason, message, discount: 0, eligibleBase,
  });

  if (!coupon.active) return fail("inactive", "Cupom inativo.");
  if (isCouponExpired(coupon.expiresAt, now)) return fail("expired", "Cupom expirado.");
  if (restricted && eligibleBase <= 0) {
    return fail("no-eligible-items", "Cupom não vale para os itens do carrinho.");
  }
  if (coupon.minOrder && cartSubtotal < coupon.minOrder) {
    return fail("min-order", `Pedido mínimo de ${brl(coupon.minOrder)} para usar este cupom.`);
  }
  if (coupon.usageLimitPerCpf != null) {
    if (!ctx.cpf) return fail("cpf-required", "Este cupom exige CPF cadastrado.");
    if ((ctx.priorUsesForCpf ?? 0) >= coupon.usageLimitPerCpf) {
      return fail("limit-reached", "Limite de uso deste cupom por CPF atingido.");
    }
  }

  const rawDiscount = coupon.type === "percent"
    ? eligibleBase * (coupon.value / 100)
    : Math.min(coupon.value, eligibleBase);
  // Nunca desconta mais que a base elegível; arredonda a centavos.
  const discount = Math.min(Math.round(rawDiscount * 100) / 100, eligibleBase);

  return { valid: true, discount, eligibleBase };
}
