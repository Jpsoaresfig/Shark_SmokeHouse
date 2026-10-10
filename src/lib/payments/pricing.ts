/**
 * Conferência dos valores de um pedido contra os dados oficiais (catálogo,
 * frete por bairro, cupom) — módulo puro e testável, sem Firebase.
 *
 * Por quê: o pedido é criado pelo navegador do cliente (client SDK), então
 * `items[].price`, `subtotal`, `deliveryFee`, `discount` e `total` são dados do
 * cliente e podem ser adulterados. Antes de COBRAR (ex.: gerar o PIX do Mercado
 * Pago com `order.total`), o servidor recalcula tudo a partir das fontes
 * confiáveis e recusa se não bater. Quem chama (orders.server) injeta o contexto.
 */
import { evaluateCoupon } from "@/lib/coupons";
import type { Coupon, Order } from "@/types";

/** Tolerância de arredondamento (meio centavo). */
const EPS = 0.005;

/** Igual a `normalizeArea` (lib/firebase/delivery) — duplicado aqui para não
 *  puxar o client SDK do Firebase para o servidor/testes. */
function normalizeArea(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface PricingProduct {
  id: string;
  price: number;
  category: string;
  variations?: { id: string }[];
}

export interface PricingContext {
  products: Map<string, PricingProduct>;
  deliveryAreas: { name: string; fee: number; active?: boolean }[];
  freeShipping: { enabled: boolean; threshold: number };
  /** Cupom resgatado neste pedido (via couponRedemptions), quando houver desconto. */
  coupon?: Coupon | null;
  /** Usos ANTERIORES do mesmo cupom pelo mesmo CPF/conta (sem contar este pedido). */
  priorCouponUses?: number;
  /** CPF registrado no resgate do cupom (dígitos). */
  couponCpf?: string;
  /** Referência de "agora" para a validade do cupom (use a data do pedido). */
  now?: Date;
  /** % da diferença de preço no cartão (crédito/débito na maquininha) definida
   *  pelo servidor a partir das configurações. Ausente/0 = sem taxa (ex.: PIX). */
  cardFeePercent?: number;
}

export interface PricingCheck {
  ok: boolean;
  /** Motivos de divergência (para log/alerta — não exibir ao cliente). */
  problems: string[];
  /** Total recalculado no servidor. */
  expectedTotal: number;
}

/**
 * Recalcula e confere os valores de um pedido de cobrança online (sem taxa de
 * cartão — o Mercado Pago PIX não tem acréscimo). Retorna `ok: false` com a
 * lista de divergências quando algo não bate.
 */
export function checkOrderPricing(
  order: Pick<Order, "items" | "subtotal" | "deliveryFee" | "discount" | "cardFee" | "total" | "deliveryAddress">,
  ctx: PricingContext,
): PricingCheck {
  const problems: string[] = [];
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) problems.push("pedido sem itens");

  // 1) Itens: preço oficial do catálogo, quantidade inteira ≥ 1, variação existente.
  let subtotal = 0;
  const couponItems: { categorySlug: string; lineTotal: number }[] = [];
  for (const it of items) {
    const product = ctx.products.get(it.productId);
    const qty = Number(it.quantity);
    if (!product) {
      problems.push(`produto inexistente: ${it.productId}`);
      continue;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      problems.push(`quantidade inválida em ${it.productId}: ${it.quantity}`);
      continue;
    }
    if (it.variationId && !(product.variations ?? []).some((v) => v.id === it.variationId)) {
      problems.push(`variação inexistente: ${it.productId}/${it.variationId}`);
    }
    if (!(Math.abs(Number(it.price) - product.price) < EPS)) {
      problems.push(`preço divergente em ${it.productId}: ${it.price} ≠ ${product.price}`);
    }
    const line = product.price * qty;
    subtotal += line;
    couponItems.push({ categorySlug: product.category ?? "", lineTotal: line });
  }
  subtotal = round2(subtotal);
  if (!(Math.abs(Number(order.subtotal) - subtotal) < EPS)) {
    problems.push(`subtotal divergente: ${order.subtotal} ≠ ${subtotal}`);
  }

  // 2) Frete: retirada = 0; entrega = taxa do bairro (ou 0 com frete grátis).
  const isPickup = order.deliveryAddress?.id === "pickup";
  const fee = Number(order.deliveryFee ?? 0);
  let expectedFee = 0;
  if (!isPickup) {
    const target = normalizeArea(order.deliveryAddress?.neighborhood ?? "");
    const area = ctx.deliveryAreas.find(
      (a) => a.active !== false && normalizeArea(a.name) === target,
    );
    const freeShip =
      ctx.freeShipping.enabled && ctx.freeShipping.threshold > 0 && subtotal >= ctx.freeShipping.threshold;
    if (!area) {
      problems.push(`bairro de entrega não atendido: ${order.deliveryAddress?.neighborhood ?? ""}`);
      expectedFee = Math.max(0, fee);
    } else {
      expectedFee = freeShip ? 0 : round2(Number(area.fee) || 0);
      // Frete grátis é um benefício: aceita 0 quando qualifica, ou a taxa cheia.
      const okFee =
        Math.abs(fee - expectedFee) < EPS ||
        (freeShip && Math.abs(fee - (Number(area.fee) || 0)) < EPS);
      if (!okFee) problems.push(`frete divergente: ${fee} ≠ ${expectedFee}`);
      else expectedFee = fee;
    }
  } else if (Math.abs(fee) >= EPS) {
    problems.push(`retirada com frete: ${fee}`);
    expectedFee = 0;
  }

  // 3) Taxa de cartão: só no crédito/débito (maquininha), sobre subtotal + frete;
  //    pode ser negativa (desconto no cartão). Em PIX/online deve ser 0.
  const cardFee = Number(order.cardFee ?? 0);
  const pct = Number(ctx.cardFeePercent ?? 0) || 0;
  const expectedCardFee = round2((subtotal + expectedFee) * (pct / 100));
  if (!Number.isFinite(cardFee) || Math.abs(cardFee - expectedCardFee) >= EPS) {
    problems.push(`taxa de cartão divergente: ${order.cardFee} ≠ ${expectedCardFee}`);
  }

  // 4) Desconto: só com cupom resgatado e válido NA DATA DO PEDIDO.
  const discount = Number(order.discount ?? 0);
  let expectedDiscount = 0;
  if (!Number.isFinite(discount) || discount < 0) {
    problems.push(`desconto inválido: ${order.discount}`);
  } else if (discount >= EPS) {
    if (!ctx.coupon) {
      problems.push("desconto sem cupom resgatado");
    } else {
      const ev = evaluateCoupon(ctx.coupon, {
        items: couponItems,
        cpf: ctx.couponCpf || undefined,
        priorUsesForCpf: ctx.priorCouponUses ?? 0,
        now: ctx.now,
      });
      if (!ev.valid) {
        problems.push(`cupom ${ctx.coupon.code} inválido: ${ev.reason}`);
      } else if (discount > ev.discount + EPS) {
        problems.push(`desconto acima do cupom: ${discount} > ${ev.discount}`);
      } else {
        expectedDiscount = discount;
      }
    }
  }

  const expectedTotal = round2(Math.max(0, subtotal + expectedFee + expectedCardFee - expectedDiscount));
  if (!(Math.abs(Number(order.total) - expectedTotal) < EPS)) {
    problems.push(`total divergente: ${order.total} ≠ ${expectedTotal}`);
  }

  return { ok: problems.length === 0, problems, expectedTotal };
}
