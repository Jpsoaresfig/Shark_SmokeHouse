/**
 * Lógica pura do rastreamento de pedidos (cliente).
 *
 * Deriva a linha do tempo e o card de status a partir dos DADOS REAIS do pedido
 * (`order.status`, `order.statusHistory` e o pagamento via `resolveOrderPayment`).
 * Não existe aqui nenhum status paralelo: cada etapa é um reflexo do que está
 * gravado no Firestore. A etapa "Pagamento confirmado" é derivada do pagamento
 * (payment.status === "paid"), não de um status de pedido inventado.
 *
 * Mapeamento status real → etapa da timeline:
 *   reserved         → nada começa (fila de espera); a etapa "Recebido" fica atual
 *   received         → "Pedido recebido"
 *   analyzing        → "Preparando seu pedido" (em análise)
 *   approved         → "Preparando seu pedido" (aprovado)
 *   preparing        → "Preparando seu pedido"
 *   out_for_delivery → "Saiu para entrega" (inclui "a caminho" na cópia)
 *   delivered        → "Pedido entregue"
 *   cancelled        → sem timeline (card de cancelamento)
 */
import { resolveOrderPayment } from "@/lib/payments";
import { toDate } from "@/lib/utils";
import type { Order, OrderStatus, PaymentMethod } from "@/types";

/** Métodos de pagamento com confirmação online (PIX manual / Mercado Pago).
 *  Para os demais (na entrega, WhatsApp, pontos), não há etapa de confirmação. */
const ONLINE_PAYMENT_METHODS: PaymentMethod[] = ["pix_manual", "mercadopago"];

/** Etapas da timeline de entrega, na ordem exibida ao cliente. */
export type TrackingStepKey =
  | "received"
  | "payment_confirmed"
  | "preparing"
  | "out_for_delivery"
  | "delivered";

export interface TrackingStep {
  key: TrackingStepKey;
  /** Título curto exibido na timeline (ex.: "Preparando seu pedido"). */
  label: string;
  /** Subtítulo exibido quando a etapa é a ATUAL. */
  activeText: string;
  done: boolean;
  /** A etapa atual da jornada (destaque visual). Apenas uma por vez. */
  current: boolean;
  /** Quando a etapa foi concluída (ISO). Ausente enquanto não concluída. */
  completedAt?: string;
  /** Nota registrada no statusHistory da etapa (ex.: motivo de cancelamento). */
  note?: string;
}

/** Ordenação dos status reais (não inclui cancelled — tratado à parte). */
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

/** Procura o evento de um status no histórico do pedido. */
export function findStatusEvent(order: Order, status: OrderStatus) {
  return [...(order.statusHistory ?? [])]
    .slice()
    .reverse()
    .find((h) => h.status === status);
}

/** Data em que a etapa de um status foi concluída, ou undefined. */
function completedAtOf(order: Order, status: OrderStatus): string | undefined {
  return findStatusEvent(order, status)?.timestamp;
}

/**
 * Deriva a timeline de entrega do pedido. Retorna as 5 etapas na ordem correta,
 * cada uma marcada como concluída/atual/futura conforme o estado real do pedido.
 */
export function getTrackingSteps(order: Order): TrackingStep[] {
  const pay = resolveOrderPayment(order);
  const rank = STATUS_RANK[order.status];

  const receivedDone = rank >= STATUS_RANK.received;
  const hasOnlinePayment = ONLINE_PAYMENT_METHODS.includes(pay.method);
  const paymentDone = hasOnlinePayment && pay.status === "paid";
  const preparingDone = rank >= STATUS_RANK.approved;
  const outForDeliveryDone = rank >= STATUS_RANK.out_for_delivery;
  const deliveredDone = rank >= STATUS_RANK.delivered;

  const steps: TrackingStep[] = [
    {
      key: "received",
      label: "Pedido recebido",
      activeText: "Recebemos seu pedido e estamos confirmando as informações.",
      done: receivedDone,
      current: false,
      completedAt: receivedDone
        ? completedAtOf(order, "received") ?? order.createdAt
        : undefined,
      note: findStatusEvent(order, "received")?.note,
    },
  ];

  // Só entra na timeline quando o pagamento tem confirmação online de verdade.
  if (hasOnlinePayment) {
    steps.push({
      key: "payment_confirmed",
      label: "Pagamento confirmado",
      activeText: "Seu pagamento foi aprovado e seu pedido já entrou na fila.",
      done: paymentDone,
      current: false,
      completedAt: pay.paidAt ?? pay.history?.find((e) => e.status === "paid")?.timestamp,
    });
  }

  steps.push(
    {
      key: "preparing",
      label: "Preparando seu pedido",
      activeText: "Nossa equipe está preparando seu pedido agora.",
      done: preparingDone,
      current: false,
      completedAt:
        completedAtOf(order, "preparing") ?? completedAtOf(order, "approved"),
      note: findStatusEvent(order, "preparing")?.note ?? findStatusEvent(order, "approved")?.note,
    },
    {
      key: "out_for_delivery",
      label: "Saiu para entrega",
      activeText: "O motoboy já retirou seu pedido e está a caminho.",
      done: outForDeliveryDone,
      current: false,
      completedAt: completedAtOf(order, "out_for_delivery"),
      note: findStatusEvent(order, "out_for_delivery")?.note,
    },
    {
      key: "delivered",
      label: "Pedido entregue",
      activeText: "Seu pedido foi entregue. Bom apetite!",
      done: deliveredDone,
      current: false,
      completedAt: completedAtOf(order, "delivered"),
      note: findStatusEvent(order, "delivered")?.note,
    },
  );

  // Pedidos cancelados não têm "etapa atual" — a timeline é toda neutra.
  if (order.status === "cancelled") return steps;

  // Etapa atual = primeira etapa ainda não concluída. Se todas concluídas
  // (entregue), a última fica como atual/destaque de celebração.
  const firstPending = steps.findIndex((s) => !s.done);
  if (firstPending === -1) {
    steps[steps.length - 1].current = true;
  } else {
    steps[firstPending].current = true;
  }

  return steps;
}

/* ── Card de status em destaque ────────────────────────────── */

export interface TrackingStatusMeta {
  /** Chave do ícone — mapeada para lucide no componente. */
  iconKey: "received" | "payment" | "preparing" | "delivery" | "delivered" | "cancelled" | "reserved" | "analyzing" | "approved" | "whatsapp";
  title: string;
  description: string;
  /** Variante visual do card (cor de destaque). */
  tone: "neutral" | "blue" | "orange" | "success" | "destructive" | "warning";
}

/** Card de destaque a partir do estado real do pedido (+ pagamento). */
export function getTrackingStatusMeta(order: Order): TrackingStatusMeta {
  const pay = resolveOrderPayment(order);

  if (order.status === "cancelled") {
    return {
      iconKey: "cancelled",
      title: "Pedido cancelado",
      description: "Este pedido foi cancelado. Em caso de dúvida, fale com a gente.",
      tone: "destructive",
    };
  }

  if (order.awaitingConfirmation) {
    return {
      iconKey: "whatsapp",
      title: "Aguardando sua confirmação",
      description: "Você fez a compra pelo WhatsApp? Confirme em Meus Pedidos para liberarmos o pedido.",
      tone: "warning",
    };
  }

  switch (order.status) {
    case "reserved":
      return {
        iconKey: "reserved",
        title: "Pedido reservado",
        description: "Pedido feito fora do horário — reservado na fila de espera até a loja abrir.",
        tone: "warning",
      };
    case "received":
      // Pagamento já confirmado (webhook MP ou baixa manual) mas o pedido ainda
      // não avançou: a informação mais útil ao cliente é o pagamento confirmado.
      if (pay.status === "paid") {
        return {
          iconKey: "payment",
          title: "Pagamento confirmado",
          description: "Seu pagamento foi aprovado e seu pedido já entrou na fila.",
          tone: "success",
        };
      }
      return {
        iconKey: "received",
        title: "Pedido recebido",
        description: "Recebemos seu pedido e estamos confirmando as informações.",
        tone: "neutral",
      };
    case "analyzing":
      return {
        iconKey: "analyzing",
        title: "Pedido em análise",
        description: "Estamos verificando seu pedido.",
        tone: "neutral",
      };
    case "approved":
      return {
        iconKey: "approved",
        title: "Pedido aprovado",
        description: "Seu pedido foi aprovado e já entrou na fila de preparação.",
        tone: "blue",
      };
    case "preparing":
      return {
        iconKey: "preparing",
        title: "Preparando seu pedido",
        description: "Nossa equipe está preparando seu pedido agora.",
        tone: "blue",
      };
    case "out_for_delivery":
      return {
        iconKey: "delivery",
        title: "Seu pedido saiu para entrega",
        description: "O motoboy já retirou seu pedido e está a caminho.",
        tone: "orange",
      };
    case "delivered":
      return {
        iconKey: "delivered",
        title: "Pedido entregue",
        description: "Seu pedido foi entregue. Bom apetite!",
        tone: "success",
      };
    default:
      return {
        iconKey: "received",
        title: "Pedido recebido",
        description: "Recebemos seu pedido e estamos confirmando as informações.",
        tone: "neutral",
      };
  }
}

/** Motivo do cancelamento, quando registrado no histórico. */
export function getCancelReason(order: Order): string | undefined {
  return findStatusEvent(order, "cancelled")?.note;
}

/** Se há localização GPS real e recente do entregador (≤ 5 min). */
export function isCourierLocationFresh(location: { updatedAt: string } | undefined, now = new Date()): boolean {
  if (!location) return false;
  const age = now.getTime() - toDate(location.updatedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= 5 * 60 * 1000;
}

/** Horas decorridas desde que o pedido entrou no status dado (fallback: createdAt). */
export function hoursInStatus(order: Order, status: OrderStatus, now = new Date()): number {
  const since = findStatusEvent(order, status)?.timestamp ?? order.createdAt;
  const diff = now.getTime() - toDate(since).getTime();
  return Number.isFinite(diff) && diff > 0 ? diff / 3600_000 : 0;
}

/**
 * Entrega em rota há mais tempo que o limite — sinal de que o motoboy esqueceu
 * de concluir (marcar como entregue) ou cancelar o pedido.
 */
export function isDeliveryStuck(order: Order, thresholdHours = 4, now = new Date()): boolean {
  return (
    order.status === "out_for_delivery" &&
    hoursInStatus(order, "out_for_delivery", now) >= thresholdHours
  );
}

/**
 * Limite de horas por status antes de o pedido ser considerado "preso" (sem
 * conclusão). Espelha os limites usados no servidor (observability.server.ts).
 */
export const STUCK_THRESHOLD_HOURS: Record<OrderStatus, number> = {
  reserved: 0,
  received: 6,
  analyzing: 6,
  approved: 24,
  preparing: 4,
  out_for_delivery: 4,
  delivered: 0,
  cancelled: 0,
};

/** Pedido há tempo excessivo no status atual sem ser concluído (entregue/cancelado). */
export function isOrderStuck(order: Order, now = new Date()): boolean {
  const threshold = STUCK_THRESHOLD_HOURS[order.status];
  if (!threshold) return false;
  return hoursInStatus(order, order.status, now) >= threshold;
}
