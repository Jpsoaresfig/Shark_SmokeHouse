import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type { Order } from "@/types";

/**
 * Bonificação de indicação executada no SERVIDOR via Firebase Admin SDK.
 *
 * Roda em contexto confiável (webhook do Mercado Pago e rota /api/referrals/qualify),
 * fora das regras de segurança do Firestore — por isso o crédito ao indicador NÃO
 * precisa (e não deve) ser permitido via regra cliente. NUNCA importe este arquivo
 * em componentes de cliente.
 */

/** Pontos creditados ao INDICADOR quando o indicado conclui a 1ª compra paga (Task 3.2). */
export const REFERRAL_POINTS = 50;

/**
 * Libera a bonificação de uma indicação PENDENTE quando o indicado conclui sua
 * primeira compra paga.
 *
 * Regra (Task 3.2): o indicador só recebe os +50 pontos após o indicado cumprir,
 * cumulativamente, Cadastro + 1ª Compra paga. O vínculo pendente é criado no
 * cadastro (recordReferral); aqui ele é promovido a "qualified" e os pontos são
 * creditados — uma única vez.
 *
 * Idempotente e seguro contra corrida: a transição pending → qualified acontece
 * dentro de uma transação, então só a PRIMEIRA compra paga credita; pagamentos
 * seguintes (ou reentregas do webhook) encontram a indicação já qualificada e não
 * fazem nada. Resgates por pontos (isRedemption) não contam como "compra".
 *
 * @returns true se esta chamada efetivou a bonificação; false caso contrário.
 */
export async function qualifyReferralForPaidOrder(order: Order): Promise<boolean> {
  // Só um pedido real e pago conta como "primeira compra". Resgates por pontos
  // (total 0, pagos com pontos) não qualificam a indicação.
  if (order.isRedemption) return false;
  const paid = (order.payment?.status ?? order.paymentStatus) === "paid";
  if (!paid) return false;

  const referredUserId = order.customerId;
  if (!referredUserId) return false;

  const db = getAdminDb();
  const referralRef = db.collection("referrals").doc(referredUserId);

  return db.runTransaction(async (tx) => {
    const refSnap = await tx.get(referralRef);
    if (!refSnap.exists) return false; // o indicado não foi indicado por ninguém

    const data = refSnap.data()!;
    if (data.status !== "pending") return false; // já qualificada (1ª compra já contou)

    const referrerId = data.referrerId as string | undefined;
    if (!referrerId) return false;

    const now = new Date().toISOString();
    const userRef = db.collection("users").doc(referrerId);
    const txRef = db.collection("loyaltyTransactions").doc();

    tx.update(referralRef, {
      status: "qualified",
      pointsAwarded: REFERRAL_POINTS,
      qualifiedAt: now,
      qualifyingOrderId: order.id,
    });
    // set/merge é robusto caso o campo loyaltyPoints ainda não exista no indicador.
    tx.set(
      userRef,
      {
        loyaltyPoints: FieldValue.increment(REFERRAL_POINTS),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(txRef, {
      userId: referrerId,
      type: "referral",
      points: REFERRAL_POINTS,
      reason: "Indicação concluiu a 1ª compra",
      referredUserId,
      createdAt: FieldValue.serverTimestamp(),
    });

    return true;
  });
}
