import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { isOpenNow, zonedClock, STORE_TIMEZONE } from "@/lib/businessHours";
import { parseBusinessHours } from "@/lib/orderStatusPlan";
import { createSystemAlert } from "@/lib/observability.server";
import { checkOrderPricing, type PricingCheck, type PricingProduct } from "@/lib/payments/pricing";
import { DEFAULT_DELIVERY_AREAS } from "@/lib/firebase/delivery.defaults";
import { toDate } from "@/lib/utils";
import type { Coupon, Order, OrderStatus, PaymentEvent, PaymentStatus, StatusEvent } from "@/types";

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

/**
 * Grava o id do pagamento do Mercado Pago no pedido (correlação para o webhook).
 * `resetPending`: uma NOVA cobrança substituiu outra que expirou/foi recusada —
 * volta o status financeiro para "pending" (senão o polling, que ignora estados
 * resolvidos, nunca confirmaria o novo PIX).
 */
export async function setOrderProviderRef(
  orderId: string,
  providerRef: string,
  opts: { resetPending?: boolean } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const event: PaymentEvent = {
    status: "pending",
    timestamp: now,
    note: `Nova cobrança PIX gerada (${providerRef})`,
  };
  await getAdminDb().collection(COL).doc(orderId).update({
    "payment.providerRef": providerRef,
    "payment.provider": "mercadopago",
    ...(opts.resetPending
      ? {
          "payment.status": "pending",
          "payment.history": FieldValue.arrayUnion(event),
          paymentStatus: "pending",
        }
      : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Transições financeiras permitidas a partir do servidor (webhook/polling).
 * - "paid" só pode virar "refunded" (estorno/chargeback). Uma notificação tardia
 *   de "cancelled"/"failed" (ex.: PIX antigo que expirou depois de o admin dar
 *   baixa manual) NÃO pode desfazer um pagamento recebido.
 * - "refunded" é final.
 * - Qualquer estado em aberto pode ir para qualquer outro.
 */
export function canTransitionPayment(current: PaymentStatus | undefined, next: PaymentStatus): boolean {
  if (current === next) return false;
  if (current === "refunded") return false;
  if (current === "paid") return next === "refunded";
  return true;
}

/**
 * Aplica uma transição de status financeiro a partir do servidor (webhook).
 * Idempotente: se o pedido já está no status alvo, não faz nada e retorna false.
 * Espelha `paymentStatus` (campo legado), igual ao `updatePaymentStatus` do client.
 */
export async function applyPaymentStatusAdmin(
  orderId: string,
  status: PaymentStatus,
  opts: { note?: string; by?: string } = {},
): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COL).doc(orderId);
  // Transação: webhook e polling chegam quase juntos — sem ela, os dois liam
  // "pending", ambos aplicavam "paid" e o avanço/indicação rodavam em dobro.
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;

    const current = (snap.data()?.payment?.status ?? snap.data()?.paymentStatus) as
      | PaymentStatus
      | undefined;
    // já aplicado (evita baixa duplicada) ou transição proibida (ex.: paid → cancelled)
    if (!canTransitionPayment(current, status)) return false;

    const now = new Date().toISOString();
    const event: PaymentEvent = {
      status,
      timestamp: now,
      ...(opts.note ? { note: opts.note } : {}),
      ...(opts.by ? { by: opts.by } : {}),
    };

    tx.update(ref, {
      "payment.status": status,
      "payment.history": FieldValue.arrayUnion(event),
      ...(status === "paid" ? { "payment.paidAt": now } : {}),
      paymentStatus: status, // espelho legado
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/* Ordem do funil de entrega — usada para nunca retroceder o status.
   "reserved" fica abaixo de tudo: pedidos reservados fora do horário podem
   avançar para qualquer status assim que a loja abrir ou o pagamento cair. */
const STATUS_RANK: Record<OrderStatus, number> = {
  reserved: -1,
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
 *   - nunca mexe em pedido "delivered" ou "cancelled" — PIX pago num pedido
 *     cancelado vira alerta no Centro de Operações para a equipe estornar;
 *   - pedido "reserved" com a loja FECHADA continua reservado (a fila o libera
 *     já pago para "Preparando" quando a loja abrir — ver processReservedQueue);
 *   - idempotente: reenvios do webhook não duplicam o avanço.
 * Retorna true se aplicou, false se ignorou.
 */
export async function advanceOrderStatusAdmin(
  orderId: string,
  toStatus: OrderStatus,
  opts: { note?: string; by?: string } = {},
): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.collection(COL).doc(orderId);
  // Horário lido fora da transação (não precisa de consistência com o pedido).
  const storeOpen = await isStoreOpenAdmin();
  let paidOnCancelled = false;
  const applied = await db.runTransaction(async (tx) => {
    paidOnCancelled = false;
    const snap = await tx.get(ref);
    if (!snap.exists) return false;

    const data = snap.data() ?? {};
    const current = (data.status ?? "received") as OrderStatus;
    if (current === "cancelled") {
      paidOnCancelled = (data.payment?.status ?? data.paymentStatus) === "paid";
      return false;
    }
    if (current === "delivered") return false;
    if (current === "reserved" && !storeOpen) return false; // loja fechada: segue na fila
    if ((STATUS_RANK[current] ?? 0) >= STATUS_RANK[toStatus]) return false; // já igual/à frente

    const event: StatusEvent = {
      status: toStatus,
      timestamp: new Date().toISOString(),
      ...(opts.note ? { note: opts.note } : {}),
      ...(opts.by ? { updatedBy: opts.by } : {}),
    };
    tx.update(ref, {
      status: toStatus,
      statusHistory: FieldValue.arrayUnion(event),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });

  if (paidOnCancelled) {
    console.error("[orders] pagamento confirmado em pedido cancelado", { orderId });
    void createSystemAlert({
      key: `paid-on-cancelled:${orderId}`,
      type: "mercadopago_failures",
      severity: "critical",
      message: `Pedido #${orderId.slice(-8).toUpperCase()} foi PAGO depois de cancelado — estorne o cliente no Mercado Pago.`,
      metadata: { orderId },
    });
  }
  return applied;
}

/**
 * Confere no SERVIDOR os valores de um pedido (preços do catálogo, frete do
 * bairro, cupom resgatado) antes de cobrá-lo. O pedido é criado pelo navegador,
 * então `total`/`items[].price` não são confiáveis por si só. Ver `checkOrderPricing`.
 */
export async function verifyOrderPricingAdmin(order: Order): Promise<PricingCheck> {
  const db = getAdminDb();
  const items = Array.isArray(order.items) ? order.items : [];
  const ids = [...new Set(items.map((i) => String(i.productId ?? "")).filter(Boolean))];

  const [productSnaps, areasSnap, settingsSnap, redemptionSnap] = await Promise.all([
    ids.length ? db.getAll(...ids.map((id) => db.collection("products").doc(id))) : Promise.resolve([]),
    db.collection("deliveryAreas").get(),
    db.collection("settings").doc("site").get(),
    db.collection("couponRedemptions").where("orderId", "==", order.id).limit(1).get(),
  ]);

  const products = new Map<string, PricingProduct>();
  for (const snap of productSnaps) {
    if (!snap.exists) continue;
    const d = snap.data() ?? {};
    products.set(snap.id, {
      id: snap.id,
      price: Number(d.price),
      category: String(d.category ?? ""),
      variations: Array.isArray(d.variations) ? d.variations : undefined,
    });
  }

  // Coleção vazia = o checkout usa a tabela padrão (mesmo fallback do client).
  const deliveryAreas = areasSnap.empty
    ? DEFAULT_DELIVERY_AREAS.map((a) => ({ ...a, active: true }))
    : areasSnap.docs.map((d) => {
        const a = d.data();
        return { name: String(a.name ?? ""), fee: Number(a.fee) || 0, active: a.active as boolean | undefined };
      });

  const cart = settingsSnap.data()?.cart as
    | { freeShippingEnabled?: boolean; freeShippingThreshold?: number }
    | undefined;
  // Mesmos defaults de lib/firebase/settings (DEFAULT_SETTINGS.cart).
  const freeShipping = {
    enabled: cart?.freeShippingEnabled ?? true,
    threshold: Number(cart?.freeShippingThreshold ?? 150) || 0,
  };

  let coupon: Coupon | null = null;
  let priorCouponUses = 0;
  let couponCpf = "";
  const redemption = redemptionSnap.docs[0]?.data();
  if (redemption?.couponId) {
    const cSnap = await db.collection("coupons").doc(String(redemption.couponId)).get();
    if (cSnap.exists) coupon = { ...(cSnap.data() as Coupon), id: cSnap.id };
    couponCpf = String(redemption.cpf ?? "");
    if (coupon && coupon.usageLimitPerCpf != null) {
      // Usos do mesmo cupom pelo mesmo CPF OU pela mesma conta em OUTROS pedidos
      // (pega resgates duplicados em corrida e troca de CPF).
      const couponId = coupon.id;
      const [byCpf, byUser] = await Promise.all([
        couponCpf
          ? db.collection("couponRedemptions").where("couponId", "==", couponId).where("cpf", "==", couponCpf).get()
          : Promise.resolve(null),
        db.collection("couponRedemptions").where("couponId", "==", couponId).where("userId", "==", order.customerId).get(),
      ]);
      const others = (snap: { docs: { data(): { orderId?: string } }[] } | null) =>
        snap ? snap.docs.filter((d) => d.data().orderId !== order.id).length : 0;
      priorCouponUses = Math.max(others(byCpf), others(byUser));
    }
  }

  return checkOrderPricing(order, {
    products,
    deliveryAreas,
    freeShipping,
    coupon,
    priorCouponUses,
    couponCpf,
    // Validade do cupom na data do pedido (o cliente pode pagar depois).
    now: order.createdAt ? toDate(order.createdAt) : undefined,
  });
}

/** Lê o horário de funcionamento (settings/site) e diz se a loja está aberta
 *  AGORA no fuso da loja (o servidor roda em UTC — `new Date()` não reflete a
 *  loja). Sem configuração legível, considera aberta (mesmo padrão do client). */
export async function isStoreOpenAdmin(now: Date = new Date()): Promise<boolean> {
  const settings = await getAdminDb().collection("settings").doc("site").get().catch(() => null);
  return isOpenNow(parseBusinessHours(settings?.data()?.businessHours), zonedClock(STORE_TIMEZONE, now)).open;
}

/**
 * Processa a fila de pedidos RESERVADOS (feitos fora do horário de funcionamento):
 * quando a loja está ABERTA agora, move cada pedido `reserved` para `received`
 * (ou direto para `preparing`, se o PIX do Mercado Pago já foi pago), entrando
 * na fila normal de processamento. Roda no servidor (cron diário + disparo
 * oportunista — ver maybeProcessReservedQueue). Idempotente: cada pedido é
 * relido numa transação e só é movido se AINDA estiver `reserved` (um
 * cancelamento entre a leitura e a escrita não é desfeito).
 * Retorna quantos foram liberados e quantos continuam aguardando a abertura.
 */
export async function processReservedQueue(
  now: Date = new Date(),
): Promise<{ processed: number; waiting: number }> {
  const db = getAdminDb();

  const snap = await db.collection(COL).where("status", "==", "reserved").get();
  if (!(await isStoreOpenAdmin(now))) {
    // Ainda fechado — a fila continua aguardando. Conta para informar o admin.
    return { processed: 0, waiting: snap.size };
  }
  if (snap.empty) return { processed: 0, waiting: 0 };

  let processed = 0;
  for (const d of snap.docs) {
    const moved = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(d.ref);
      const data = fresh.data();
      if (!fresh.exists || data?.status !== "reserved") return false; // cancelado/mexido no meio

      const paid = (data.payment?.status ?? data.paymentStatus) === "paid";
      const toStatus: OrderStatus = paid ? "preparing" : "received";
      const event: StatusEvent = {
        status: toStatus,
        timestamp: now.toISOString(),
        note: paid
          ? "Loja abriu — pedido já pago saiu da fila de espera e foi para o preparo."
          : "Loja abriu — pedido saiu da fila de espera e entrou no processamento.",
        updatedBy: "system",
      };
      tx.update(d.ref, {
        status: toStatus,
        statusHistory: FieldValue.arrayUnion(event),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (moved) processed += 1;
  }
  return { processed, waiting: 0 };
}

/* Intervalo mínimo entre disparos oportunistas da fila (o cron da Vercel Hobby
   roda só 1x/dia, então a fila também é processada quando a equipe abre o
   painel ou quando entra um pedido novo). */
const QUEUE_THROTTLE_MS = 5 * 60 * 1000;
let lastQueueRunMs = 0; // atalho em memória (por instância serverless)

/**
 * Dispara `processReservedQueue` no máximo uma vez a cada 5 minutos, somando
 * todas as instâncias (trava em `systemLocks/ordersQueue`, só Admin SDK — as
 * regras negam o acesso de clientes por padrão). Retorna null quando pulou.
 */
export async function maybeProcessReservedQueue(
  now: Date = new Date(),
): Promise<{ processed: number; waiting: number } | null> {
  const nowMs = now.getTime();
  if (nowMs - lastQueueRunMs < QUEUE_THROTTLE_MS) return null;
  lastQueueRunMs = nowMs;

  const db = getAdminDb();
  const lockRef = db.collection("systemLocks").doc("ordersQueue");
  const acquired = await db.runTransaction(async (tx) => {
    const snap = await tx.get(lockRef);
    const last = Number(snap.data()?.lastRunMs) || 0;
    if (nowMs - last < QUEUE_THROTTLE_MS) return false;
    tx.set(lockRef, { lastRunMs: nowMs, lastRunAt: now.toISOString() }, { merge: true });
    return true;
  });
  if (!acquired) return null;
  return processReservedQueue(now);
}
