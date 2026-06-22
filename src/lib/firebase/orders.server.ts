import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Order, OrderStatus, PaymentEvent, PaymentStatus, StatusEvent } from "@/types";

/**
 * Operações de pedido executadas no SERVIDOR via Firebase Admin SDK.
 *
 * Diferente de `lib/firebase/orders.ts` (client SDK, sujeito às regras de
 * segurança), estas funções rodam em contexto confiável — usadas pelo webhook
 * do Mercado Pago e pela rota que cria a cobrança. NUNCA importe este arquivo em
 * componentes de cliente — ele usa o Admin SDK (somente servidor).
 */

const COL = "orders";

/** Carrega um pedido pelo id. */
export async function getOrderAdmin(orderId: string): Promise<Order | null> {
  const snap = await getAdminDb().collection(COL).doc(orderId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Order;
}

/** Localiza o pedido por `payment.providerRef` (id do pagamento do Mercado Pago). */
export async function findOrderIdByProviderRef(providerRef: string): Promise<string | null> {
  const q = await getAdminDb()
    .collection(COL)
    .where("payment.providerRef", "==", providerRef)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

/** Grava o id do pagamento do Mercado Pago no pedido (correlação para o webhook). */
export async function setOrderProviderRef(orderId: string, providerRef: string): Promise<void> {
  await getAdminDb().collection(COL).doc(orderId).update({
    "payment.providerRef": providerRef,
    "payment.provider": "mercadopago",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Aplica uma transição de status financeiro a partir do servidor (webhook).
 * Idempotente: se o pedido já está no status alvo, não faz nada e retorna false.
 * Espelha `paymentStatus` (campo legado), igual ao `updatePaymentStatus` do client.
 */
export async function applyPaymentStatusAdmin(
  orderId: string,
  status: PaymentStatus,
  opts: { note?: string } = {},
): Promise<boolean> {
  const ref = getAdminDb().collection(COL).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const current = (snap.data()?.payment?.status ?? snap.data()?.paymentStatus) as
    | PaymentStatus
    | undefined;
  if (current === status) return false; // já aplicado — evita baixa duplicada

  const now = new Date().toISOString();
  const event: PaymentEvent = {
    status,
    timestamp: now,
    ...(opts.note ? { note: opts.note } : {}),
  };

  await ref.update({
    "payment.status": status,
    "payment.history": FieldValue.arrayUnion(event),
    ...(status === "paid" ? { "payment.paidAt": now } : {}),
    paymentStatus: status, // espelho legado
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

/* Ordem do funil de entrega — usada para nunca retroceder o status. */
const STATUS_RANK: Record<OrderStatus, number> = {
  received: 0,
  analyzing: 1,
  approved: 2,
  preparing: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: 6,
};

/**
 * Avança o status de entrega do pedido a partir do servidor (webhook), apenas se
 * for um avanço real. Usado quando o pagamento do Mercado Pago é confirmado para
 * mandar o pedido direto para "Preparando".
 *
 * Seguro:
 *   - nunca retrocede (ignora se o pedido já passou do status alvo);
 *   - nunca mexe em pedido "delivered" ou "cancelled";
 *   - idempotente: reenvios do webhook não duplicam o avanço.
 * Retorna true se aplicou, false se ignorou.
 */
export async function advanceOrderStatusAdmin(
  orderId: string,
  toStatus: OrderStatus,
  opts: { note?: string } = {},
): Promise<boolean> {
  const ref = getAdminDb().collection(COL).doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const current = (snap.data()?.status ?? "received") as OrderStatus;
  if (current === "cancelled" || current === "delivered") return false;
  if (STATUS_RANK[current] >= STATUS_RANK[toStatus]) return false; // já igual/à frente

  const event: StatusEvent = {
    status: toStatus,
    timestamp: new Date().toISOString(),
    ...(opts.note ? { note: opts.note } : {}),
  };
  await ref.update({
    status: toStatus,
    statusHistory: FieldValue.arrayUnion(event),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}
