/**
 * Camada de abstração de pagamentos.
 *
 * A entidade `Order` guarda um `PaymentInfo` agnóstico de provedor. Cada gateway
 * implementa a interface `PaymentGateway`:
 *
 *   - `manualGateway` (`./manual`): métodos com baixa manual do admin
 *     (PIX manual, na entrega, WhatsApp).
 *   - `mercadopagoGateway` (`./mercadopago`): pagamento online via Checkout Pro.
 *     A rota de servidor cria a preferência e o webhook do Mercado Pago chama
 *     `applyPaymentStatus(order.payment, "paid", …)` — a mesma transição usada
 *     pela baixa manual.
 */
import type { Order, PaymentInfo, PaymentEvent, PaymentMethod, PaymentProvider, PaymentStatus } from "@/types";

export interface CreatePaymentInput {
  method: PaymentMethod;
  /** Valor total da cobrança (snapshot). */
  amount: number;
  /** Chave PIX exibida ao cliente (apenas pix_manual). */
  pixKey?: string;
  pixName?: string;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  /** Cria o registro de pagamento inicial para um checkout. */
  createPayment(input: CreatePaymentInput): PaymentInfo;
}

/**
 * Aplica uma transição de status ao pagamento, registrando o evento no
 * histórico. Função pura — a persistência é responsabilidade do chamador
 * (ver `updatePaymentStatus` em lib/firebase/orders.ts). É também o ponto que
 * o webhook do Mercado Pago usa para confirmar/estornar uma cobrança.
 */
export function applyPaymentStatus(
  payment: PaymentInfo,
  status: PaymentStatus,
  opts: { note?: string; by?: string } = {},
): PaymentInfo {
  const now = new Date().toISOString();
  const event: PaymentEvent = {
    status,
    timestamp: now,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.by ? { by: opts.by } : {}),
  };
  return {
    ...payment,
    status,
    ...(status === "paid"
      ? { paidAt: now, ...(opts.by ? { confirmedBy: opts.by } : {}) }
      : {}),
    history: [...(payment.history ?? []), event],
  };
}

/**
 * Retorna o `PaymentInfo` canônico de um pedido. Para pedidos antigos (sem
 * `order.payment`), deriva a abstração a partir dos campos legados
 * `paymentMethod`/`paymentStatus`, mantendo a UI consistente.
 */
export function resolveOrderPayment(order: Order): PaymentInfo {
  const legacyMethod = order.paymentMethod ?? "pending";
  const legacyStatus = order.paymentStatus ?? "pending";
  const legacyAmount = order.total ?? 0;
  if (order.payment) {
    /* Pode estar incompleto se o admin deu baixa num pedido legado (cria só
       status/history). Completa com os campos legados quando faltarem. */
    return {
      ...order.payment,
      provider: order.payment.provider ?? "manual",
      method: order.payment.method ?? legacyMethod,
      status: order.payment.status ?? legacyStatus,
      amount: order.payment.amount ?? legacyAmount,
      history: order.payment.history ?? [],
    };
  }
  return {
    method: legacyMethod,
    provider: "manual",
    status: legacyStatus,
    amount: legacyAmount,
    history: [],
  };
}

export { manualGateway } from "./manual";
export { mercadopagoGateway } from "./mercadopago";
