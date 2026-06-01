/**
 * Camada de abstração de pagamentos.
 *
 * Os métodos da Fase 1 são todos processados pelo gateway "manual"
 * (`./manual`). A entidade `Order` guarda um `PaymentInfo` agnóstico de
 * provedor, de modo que a futura integração com o Asaas seja plugada aqui sem
 * refatorar a lógica de negócio:
 *
 *   - Um `asaasGateway` implementaria a mesma interface `PaymentGateway`,
 *     retornando um `PaymentInfo` com `provider: "asaas"` e o id da cobrança em
 *     `providerRef`.
 *   - O webhook do Asaas chamaria `applyPaymentStatus(order.payment, "paid", …)`
 *     — exatamente a mesma transição usada hoje pela baixa manual do admin.
 *
 * Assim, trocar manual → automático é só escolher o gateway na criação e ligar
 * o webhook às transições já existentes.
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
 * um webhook do Asaas usaria para confirmar/estornar uma cobrança.
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
