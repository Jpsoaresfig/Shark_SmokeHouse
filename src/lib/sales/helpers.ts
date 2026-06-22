/**
 * Helpers PUROS de venda — fonte única dos fallbacks retroativos e da regra de
 * comissão. Mantidos sem efeitos colaterais (sem Date/IO/randomness) para serem
 * seguros em render do React Compiler.
 *
 * Compatibilidade: vendas legadas não têm `paymentStatus`/`amountReceived` —
 * são tratadas como quitadas (`paid`, recebido = total). Nunca recalcular status
 * a partir de `amountReceived` quando `paymentStatus` está ausente.
 */
import type { Sale, SalePaymentStatus, SalePaymentMethod } from "@/types";

/** Tolerância de centavos para fechar a conta (arredondamentos). */
export const CENTS_EPSILON = 0.005;

/** Status efetivo da venda. Venda legada (sem campo) ⇒ "paid". */
export function saleStatus(sale: Sale): SalePaymentStatus {
  return sale.paymentStatus ?? "paid";
}

/** Deriva o status a partir do valor recebido e do total (regra única). */
export function deriveStatus(amountReceived: number, total: number): SalePaymentStatus {
  if (amountReceived <= 0) return "pending";
  if (amountReceived >= total - CENTS_EPSILON) return "paid";
  return "partial";
}

/**
 * Valor efetivamente recebido (regime de caixa).
 * - cancelada ⇒ 0 (não é dinheiro em caixa)
 * - legada (sem paymentStatus) ⇒ total (estava quitada)
 * - senão ⇒ amountReceived (0 é legítimo) com fallback para total
 */
export function saleReceivedAmount(sale: Sale): number {
  if (sale.paymentStatus === "cancelled") return 0;
  if (sale.paymentStatus === undefined) return sale.total;
  return sale.amountReceived ?? sale.total;
}

/** Saldo em aberto (a receber). Cancelada ⇒ 0. */
export function saleOutstanding(sale: Sale): number {
  if (saleStatus(sale) === "cancelled") return 0;
  return Math.max(0, sale.total - saleReceivedAmount(sale));
}

/** A venda conta como receita/faturamento? (canceladas não contam) */
export function saleIsRevenue(sale: Sale): boolean {
  return saleStatus(sale) !== "cancelled";
}

/** Base de cálculo da comissão: produtos − cupom − desconto manual (>= 0). */
export function saleCommissionBase(sale: Sale): number {
  return Math.max(
    0,
    (sale.subtotal ?? sale.total) - (sale.discount ?? 0) - (sale.manualDiscount?.amount ?? 0),
  );
}

/**
 * Comissão da venda. Regra de negócio: só conta quando a venda está QUITADA
 * (paymentStatus "paid" ou legada). Pendente/parcial/cancelada ⇒ null.
 */
export function saleCommission(
  sale: Sale,
  commissionRate?: number,
): { rate: number; amount: number } | null {
  if (commissionRate == null || commissionRate <= 0) return null;
  if (saleStatus(sale) !== "paid") return null;
  const base = saleCommissionBase(sale);
  return { rate: commissionRate, amount: base * (commissionRate / 100) };
}

/* ── Custo e lucro ────────────────────────────────────────
 * O custo é congelado por item (SaleItem.costPrice) no momento da venda.
 * Para vendas antigas (sem custo), um `costMap` opcional (productId → custo
 * atual) serve de estimativa de fallback. */

/** Soma total de descontos concedidos (cupom + manual). */
export function saleDiscountTotal(sale: Sale): number {
  return (sale.discount ?? 0) + (sale.manualDiscount?.amount ?? 0);
}

/** Receita só dos produtos, já abatidos cupom e desconto manual (>= 0). */
export function saleNetProducts(sale: Sale): number {
  return saleCommissionBase(sale); // mesma base: (subtotal ?? total) − descontos
}

/** Custo total dos produtos vendidos. `costMap` é fallback p/ itens sem custo. */
export function saleCost(sale: Sale, costMap?: Map<string, number>): number {
  let cost = 0;
  for (const item of sale.items) {
    const unit = item.costPrice ?? costMap?.get(item.productId) ?? 0;
    cost += unit * item.quantity;
  }
  return cost;
}

/** Lucro bruto PROJETADO (competência): receita de produtos − custo. Cancelada ⇒ 0. */
export function saleGrossProfit(sale: Sale, costMap?: Map<string, number>): number {
  if (saleStatus(sale) === "cancelled") return 0;
  return saleNetProducts(sale) - saleCost(sale, costMap);
}

/** Lucro REALIZADO (caixa): lucro projetado ponderado pela fração já recebida. */
export function saleRealizedProfit(sale: Sale, costMap?: Map<string, number>): number {
  if (saleStatus(sale) === "cancelled") return 0;
  const projected = saleGrossProfit(sale, costMap);
  if (sale.total <= 0) return projected;
  const factor = Math.min(1, saleReceivedAmount(sale) / sale.total);
  return projected * factor;
}

/** Uma entrada de caixa (recebimento efetivo). */
export interface CashEntry {
  at: string;            // ISO ou Timestamp (consumidor converte)
  amount: number;
  method: SalePaymentMethod;
  saleId: string;
}

/**
 * Entradas de caixa de uma venda (para o fluxo de caixa). Usa o histórico de
 * `payments` quando existe; senão, vendas legadas/quitadas sem histórico contam
 * o recebido na data da venda. Canceladas não geram entrada.
 */
export function cashEntriesForSale(sale: Sale): CashEntry[] {
  if (saleStatus(sale) === "cancelled") return [];
  if (sale.payments && sale.payments.length) {
    return sale.payments.map((p) => ({ at: p.receivedAt, amount: p.amount, method: p.method, saleId: sale.id }));
  }
  const received = saleReceivedAmount(sale);
  if (received <= 0) return [];
  return [{ at: sale.createdAt, amount: received, method: sale.paymentMethod, saleId: sale.id }];
}
