import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Order, PaymentEvent, PaymentStatus } from "@/types";

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

/** Localiza o pedido por `payment.providerRef` (id da preferência do Mercado Pago). */
export async function findOrderIdByProviderRef(providerRef: string): Promise<string | null> {
  const q = await getAdminDb()
    .collection(COL)
    .where("payment.providerRef", "==", providerRef)
    .limit(1)
    .get();
  return q.empty ? null : q.docs[0].id;
}

/** Grava o id da preferência do Mercado Pago no pedido (correlação para o webhook). */
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
