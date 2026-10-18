import type { BusinessHours, Order, OrderStatus, UserRole } from "@/types";

/**
 * Lógica PURA da mudança de status de pedido feita pela equipe (admin, vendedor,
 * motoboy). Decide, a partir do pedido atual e do status alvo, os efeitos
 * colaterais que precisam acontecer na MESMA transação do servidor
 * (ver `updateOrderStatusAdmin` em lib/firebase/orderStatus.server):
 *   - baixa/estorno de estoque (flag `stockApplied` impede dobrar);
 *   - limpeza de `awaitingConfirmation` (pedido WhatsApp tocado pela equipe);
 *   - liberação do uso do cupom ao cancelar;
 *   - devolução dos pontos de um resgate cancelado (uma única vez).
 */

/** Ordem do funil de entrega (igual a orders.server / orderTracking). */
export const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  reserved: -1,
  received: 0,
  analyzing: 1,
  approved: 2,
  preparing: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: 6,
};

export type StatusPlanOrder = Pick<
  Order,
  "status" | "stockApplied" | "awaitingConfirmation" | "isRedemption" | "pointsRedeemed" | "motoboyId"
> & { pointsRefunded?: boolean; payment?: { status?: string; method?: string }; paymentMethod?: string; paymentStatus?: string };

export interface StatusPlan {
  /** Movimento de estoque a aplicar ("out" = baixa, "in" = estorno). */
  stockMove: "in" | "out" | null;
  /** Tira o pedido WhatsApp de "aguardando confirmação". */
  clearAwaiting: boolean;
  /** Apaga os registros de uso de cupom do pedido (cancelamento). */
  releaseCoupon: boolean;
  /** Pontos a devolver ao cliente (resgate cancelado), 0 = nada. */
  refundPoints: number;
}

export class StatusChangeError extends Error {
  constructor(message: string, readonly status: number = 409) {
    super(message);
    this.name = "StatusChangeError";
  }
}

/** Pedido do Mercado Pago ainda sem pagamento confirmado. */
export function isUnpaidOnlinePayment(order: StatusPlanOrder): boolean {
  const method = order.payment?.method ?? order.paymentMethod;
  const status = order.payment?.status ?? order.paymentStatus;
  return method === "mercadopago" && status !== "paid";
}

/**
 * O motoboy só avança entregas atribuídas a ele, e só nos passos do fluxo do
 * admin: "preparing" → "out_for_delivery" → "delivered". Pedido WhatsApp não
 * confirmado ou Mercado Pago sem pagamento não sai para entrega.
 */
export function motoboyCanSetStatus(order: StatusPlanOrder, uid: string, target: OrderStatus): boolean {
  if (order.motoboyId !== uid) return false;
  if (target === "out_for_delivery") {
    return order.status === "preparing" && !order.awaitingConfirmation && !isUnpaidOnlinePayment(order);
  }
  if (target === "delivered") return order.status === "out_for_delivery";
  return false;
}

/** Autorização da mudança de status por papel. Lança StatusChangeError. */
export function assertCanSetStatus(
  role: UserRole | undefined,
  uid: string,
  order: StatusPlanOrder,
  target: OrderStatus,
): void {
  if (role === "admin" || role === "seller") return;
  if (role === "motoboy" && motoboyCanSetStatus(order, uid, target)) return;
  throw new StatusChangeError("Sem permissão para mudar o status deste pedido.", 403);
}

export function planStatusChange(order: StatusPlanOrder, target: OrderStatus): StatusPlan {
  const current = order.status;
  const cancelling = target === "cancelled" && current !== "cancelled";
  const reopening = current === "cancelled" && target !== "cancelled";

  // Resgate cancelado já devolveu os pontos: reabrir entregaria o brinde de graça.
  if (reopening && order.isRedemption && order.pointsRefunded) {
    throw new StatusChangeError(
      "Resgate cancelado não pode ser reaberto — os pontos já voltaram ao cliente. Peça um novo resgate.",
    );
  }

  let stockMove: StatusPlan["stockMove"] = null;
  let clearAwaiting = false;
  if (target === "cancelled") {
    if (order.stockApplied) stockMove = "in";
  } else if (!order.stockApplied && !order.isRedemption) {
    // Pedido WhatsApp que a equipe levou adiante (preparar/entregar) sem o cliente
    // confirmar: a venda aconteceu, então baixa o estoque e sai de "aguardando".
    const advancing = ORDER_STATUS_RANK[target] > ORDER_STATUS_RANK.received;
    if (order.awaitingConfirmation) {
      if (advancing) {
        stockMove = "out";
        clearAwaiting = true;
      }
    } else if (reopening) {
      // Reabrir um cancelado → baixa de novo o que foi estornado.
      stockMove = "out";
    }
  }

  const refundPoints =
    cancelling && order.isRedemption && !order.pointsRefunded
      ? Math.max(0, Math.round(Number(order.pointsRedeemed) || 0))
      : 0;

  return { stockMove, clearAwaiting, releaseCoupon: cancelling, refundPoints };
}

/** Normaliza o `businessHours` gravado em settings/site (dados não confiáveis). */
export function parseBusinessHours(raw: unknown): BusinessHours | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { enabled?: boolean; days?: Array<{ open?: string; close?: string } | null> };
  return {
    enabled: r.enabled ?? false,
    days: (Array.isArray(r.days) ? r.days : []).slice(0, 7).map((d) => {
      if (!d || !/^\d{2}:\d{2}$/.test(d.open ?? "") || !/^\d{2}:\d{2}$/.test(d.close ?? "")) {
        return null;
      }
      return { open: d.open!, close: d.close! };
    }),
    closedMessage: "",
  };
}
