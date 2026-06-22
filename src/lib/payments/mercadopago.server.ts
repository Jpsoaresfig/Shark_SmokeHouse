import type { PaymentStatus } from "@/types";
import { getPayment, mapMercadoPagoStatus } from "./mercadopago";
import {
  applyPaymentStatusAdmin,
  advanceOrderStatusAdmin,
  getOrderAdmin,
} from "@/lib/firebase/orders.server";
import { qualifyReferralForPaidOrder } from "@/lib/firebase/referrals.server";

/*
 * SOMENTE SERVIDOR — usa o Admin SDK via orders.server. NUNCA importe este
 * arquivo em componentes de cliente.
 */

export interface SyncResult {
  /** Pedido correlacionado (external_reference), ou null se não encontrado. */
  orderId: string | null;
  /** Status interno mapeado, ou null para estados sem transição (pending, etc.). */
  status: PaymentStatus | null;
  /** True se a transição foi efetivamente aplicada nesta chamada. */
  applied: boolean;
}

/**
 * Confirma/atualiza um pagamento do Mercado Pago a partir do id do pagamento.
 *
 * Fonte da verdade: a API do MP (nunca confiamos em corpo de webhook). Usado por
 * DOIS caminhos independentes — o webhook (POST /api/webhooks/mercadopago) e o
 * polling de status do cliente (GET /api/payments/mercadopago/status, como
 * fallback caso a notificação atrase ou falhe). Por isso é idempotente:
 * `applyPaymentStatusAdmin`/`advanceOrderStatusAdmin` ignoram reexecuções, então
 * não há baixa nem avanço de status em dobro.
 *
 * Quando o pagamento é confirmado (`paid`), manda o pedido direto para
 * "Preparando" (pula a triagem manual) e libera a bonificação de indicação.
 */
export async function syncMercadoPagoPayment(paymentId: string): Promise<SyncResult> {
  const payment = await getPayment(paymentId);
  const target = mapMercadoPagoStatus(payment.status);
  const orderId = payment.external_reference?.trim() || null;

  if (!target || !orderId) return { orderId, status: target, applied: false };
  if (!(await getOrderAdmin(orderId))) return { orderId: null, status: target, applied: false };

  const applied = await applyPaymentStatusAdmin(orderId, target, {
    note: `Mercado Pago: pagamento ${paymentId} (${payment.status})`,
  });

  if (applied && target === "paid") {
    // Pagamento confirmado → "Preparando". Seguro: advanceOrderStatusAdmin nunca
    // retrocede nem mexe em pedido entregue/cancelado, e é idempotente.
    try {
      await advanceOrderStatusAdmin(orderId, "preparing", {
        note: "Pagamento confirmado no Mercado Pago — pedido liberado para preparo.",
      });
    } catch (err) {
      console.error("[mercadopago] falha ao avançar status do pedido", { orderId, err });
    }
    // 1ª compra paga do indicado → libera a bonificação. Idempotente.
    try {
      const paidOrder = await getOrderAdmin(orderId);
      if (paidOrder) await qualifyReferralForPaidOrder(paidOrder);
    } catch (err) {
      console.error("[mercadopago] falha ao qualificar indicação", { orderId, err });
    }
  }

  return { orderId, status: target, applied };
}
