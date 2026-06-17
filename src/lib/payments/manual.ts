import type { PaymentInfo, PaymentStatus } from "@/types";
import type { CreatePaymentInput, PaymentGateway } from "./index";

/** Status financeiro inicial de cada método manual no momento do checkout. */
const INITIAL_STATUS: Partial<Record<CreatePaymentInput["method"], PaymentStatus>> = {
  pix_manual: "awaiting_proof",   // aguardando o comprovante via WhatsApp
  on_delivery: "due_on_delivery", // a cobrar pelo motoboy na entrega
  credit: "due_on_delivery",      // cartão na maquininha (entrega/retirada)
  debit: "due_on_delivery",       // cartão na maquininha (entrega/retirada)
  whatsapp: "in_negotiation",     // tratativa direta com a equipe
};

/**
 * Gateway manual da Fase 1: não processa cobrança automaticamente. Apenas
 * registra a intenção de pagamento e o status inicial; a baixa é feita
 * manualmente pelo admin (o método "mercadopago" usa o gateway automático).
 */
export const manualGateway: PaymentGateway = {
  provider: "manual",
  createPayment({ method, amount, pixKey, pixName, installments }): PaymentInfo {
    const status = INITIAL_STATUS[method] ?? "pending";
    const now = new Date().toISOString();
    return {
      method,
      provider: "manual",
      status,
      amount,
      history: [{ status, timestamp: now, note: "Pedido criado" }],
      ...(method === "pix_manual" && pixKey
        ? { pixKey, ...(pixName ? { pixName } : {}) }
        : {}),
      // Parcelas só fazem sentido no crédito (na maquininha).
      ...(method === "credit" ? { installments: Math.max(1, installments ?? 1) } : {}),
    };
  },
};
