import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { stockUpdateFor } from "@/lib/firebase/orderCreate.server";
import { assertCanSetStatus, planStatusChange, StatusChangeError, type StatusPlanOrder } from "@/lib/orderStatusPlan";
import type { CartItem, OrderStatus, Product, StatusEvent, UserRole } from "@/types";

/**
 * Mudança de status de pedido feita pela EQUIPE (admin, vendedor, motoboy),
 * executada no servidor (Admin SDK) — chamada por /api/orders/status.
 *
 * Antes isso rodava no navegador em duas escritas (status, depois estoque), e
 * ficavam de fora efeitos que as regras não permitem ao cliente/vendedor/motoboy:
 * liberar o uso do cupom, devolver os pontos de um resgate e baixar o estoque de
 * um pedido WhatsApp não confirmado entregue pelo motoboy. Agora tudo vai numa
 * ÚNICA transação (ver `planStatusChange` em lib/orderStatusPlan):
 *   - status + statusHistory;
 *   - baixa/estorno de estoque com a flag `stockApplied` (sem dobrar);
 *   - `awaitingConfirmation` limpo quando a equipe leva o pedido adiante;
 *   - cancelamento apaga os `couponRedemptions` do pedido;
 *   - cancelamento de resgate devolve `pointsRedeemed` (flag `pointsRefunded`)
 *     com lançamento no extrato (`loyaltyTransactions`).
 * Retorna o `customerId` (o client usa para notificar o cliente).
 */
export async function updateOrderStatusAdmin(
  actor: { uid: string; role: UserRole | undefined },
  orderId: string,
  status: OrderStatus,
  note?: string,
): Promise<{ customerId: string | null }> {
  const db = getAdminDb();
  const ref = db.collection("orders").doc(orderId);
  const redemptionsQuery = db.collection("couponRedemptions").where("orderId", "==", orderId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new StatusChangeError("Pedido não encontrado.", 404);
    const order = snap.data() as StatusPlanOrder & { customerId?: string; items?: CartItem[] };

    assertCanSetStatus(actor.role, actor.uid, order, status);
    const plan = planStatusChange(order, status);

    /* ── Leituras (todas antes das escritas) ── */
    const items = (order.items ?? []).filter((i) => i.productId && Number(i.quantity) > 0);
    const productRefs = plan.stockMove
      ? [...new Set(items.map((i) => i.productId))].map((id) => db.collection("products").doc(id))
      : [];
    const productSnaps = productRefs.length ? await tx.getAll(...productRefs) : [];
    const redemptions = plan.releaseCoupon ? await tx.get(redemptionsQuery) : null;
    const userRef = order.customerId ? db.collection("users").doc(order.customerId) : null;
    const userSnap = plan.refundPoints > 0 && userRef ? await tx.get(userRef) : null;
    const refund = plan.refundPoints > 0 && userSnap?.exists ? plan.refundPoints : 0;

    /* ── Escritas ── */
    const now = new Date().toISOString();
    const event: StatusEvent = {
      status,
      timestamp: now,
      ...(note ? { note } : {}),
      updatedBy: actor.uid,
    };
    tx.update(ref, {
      status,
      statusHistory: FieldValue.arrayUnion(event),
      ...(plan.stockMove ? { stockApplied: plan.stockMove === "out" } : {}),
      ...(plan.clearAwaiting ? { awaitingConfirmation: false } : {}),
      ...(refund > 0 ? { pointsRefunded: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const sign = plan.stockMove === "in" ? 1 : -1;
    for (const s of productSnaps) {
      if (!s.exists) continue;
      const product = { id: s.id, ...(s.data() as Omit<Product, "id">) } as Product;
      tx.update(s.ref, { ...stockUpdateFor(product, items, sign), updatedAt: FieldValue.serverTimestamp() });
    }

    // Pedido cancelado não conta como uso do cupom (libera o limite por CPF/conta).
    for (const d of redemptions?.docs ?? []) tx.delete(d.ref);

    if (refund > 0 && userRef) {
      tx.update(userRef, {
        loyaltyPoints: FieldValue.increment(refund),
        updatedAt: FieldValue.serverTimestamp(),
      });
      // Crédito no extrato (mesmo formato dos ajustes do admin em lib/firebase/loyalty).
      tx.set(db.collection("loyaltyTransactions").doc(), {
        userId: order.customerId,
        type: "adjustment",
        points: refund,
        reason: `Estorno do resgate #${orderId.slice(-6).toUpperCase()} (pedido cancelado)`,
        orderId,
        by: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { customerId: order.customerId ?? null };
  });
}
