/** Rótulos e variantes de badge para método e status de pagamento. */

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix_manual: "PIX",
  on_delivery: "Na Entrega",
  whatsapp: "Via WhatsApp",
  /* legados */
  online: "PIX",
  on_arrival: "Na Entrega",
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  pending: "—",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  awaiting_proof: "Aguardando comprovante",
  in_negotiation: "Em negociação",
  due_on_delivery: "A receber na entrega",
  paid: "Pago",
  failed: "Falhou",
  refunded: "Reembolsado",
  cancelled: "Cancelado",
};

export type PaymentBadgeVariant =
  | "secondary" | "warning" | "success" | "destructive" | "default";

export const PAYMENT_STATUS_BADGE: Record<string, PaymentBadgeVariant> = {
  pending: "secondary",
  awaiting_proof: "warning",
  in_negotiation: "warning",
  due_on_delivery: "default",
  paid: "success",
  failed: "destructive",
  refunded: "secondary",
  cancelled: "destructive",
};
