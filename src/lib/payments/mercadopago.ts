import type { PaymentInfo, PaymentStatus } from "@/types";
import type { CreatePaymentInput, PaymentGateway } from "./index";

/**
 * Integração com o Mercado Pago — PIX direto (https://www.mercadopago.com.br/developers).
 *
 * Modelo: cobrança PIX via API de pagamentos (`/v1/payments`). O QR Code já vem
 * com o valor embutido e é exibido inline no checkout — sem redirecionar. O
 * Mercado Pago confirma o pagamento via webhook (o mesmo gancho usado pela baixa
 * manual do admin).
 *
 * Fluxo:
 *   1. checkout cria o pedido com `mercadopagoGateway.createPayment(...)`
 *      (provider "mercadopago", status "pending");
 *   2. a tela de sucesso chama POST /api/payments/mercadopago/create { orderId }
 *      → este módulo cria o pagamento PIX (`createPixPayment`) e devolve o QR;
 *   3. o cliente paga pelo QR/copia-e-cola; a tela faz polling de
 *      GET /api/payments/mercadopago/status para detectar a confirmação;
 *   4. o webhook (POST /api/webhooks/mercadopago) busca o pagamento na API do MP
 *      e aplica a transição no pedido (correlação por `external_reference` = orderId).
 *
 * Variáveis de ambiente (servidor):
 *   MERCADOPAGO_ACCESS_TOKEN — Access Token (TEST-... no sandbox, APP_USR-... em produção)
 *   NEXT_PUBLIC_SITE_URL     — (opcional) URL pública do site para a notification_url;
 *                              se ausente, deriva-se da própria requisição.
 */

const API_BASE = "https://api.mercadopago.com";

function accessToken(): string | undefined {
  return process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || undefined;
}

/** True quando a integração tem credencial configurada. */
export function isMercadoPagoConfigured(): boolean {
  return Boolean(accessToken());
}

/* ── Cliente HTTP ───────────────────────────────────────────────────── */

class MercadoPagoError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

async function mpFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = accessToken();
  if (!token) throw new MercadoPagoError("MERCADOPAGO_ACCESS_TOKEN não configurado", 500);

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (data as { message?: string })?.message ?? `Mercado Pago respondeu ${res.status}`;
    throw new MercadoPagoError(msg, res.status, data);
  }
  return data as T;
}

/* ── PIX direto (QR inline com valor) ───────────────────────────────── */

export interface CreatePixPaymentInput {
  orderId: string;
  /** Valor da cobrança (R$). */
  amount: number;
  description: string;
  /** E-mail do pagador — obrigatório pela API de pagamentos do MP. */
  payerEmail: string;
  payerFirstName?: string;
  payerLastName?: string;
  /** CPF do pagador (só dígitos, 11 chars), quando disponível. */
  payerCpf?: string;
  /** URL pública do webhook (notification_url). */
  notificationUrl: string;
}

export interface MercadoPagoPixPayment {
  id: number;
  status: string;
  /** PIX "copia e cola" (BR Code EMV, com o valor já embutido). */
  qrCode: string;
  /** Imagem do QR em PNG base64 (sem o prefixo `data:`). */
  qrCodeBase64: string;
  /** Página do MP com o QR (fallback). */
  ticketUrl?: string;
}

interface MpPaymentResponse {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

/**
 * Cria um pagamento PIX direto (API `/v1/payments`) e devolve o QR Code já com o
 * valor embutido — exibido inline no checkout, sem redirecionar. A confirmação
 * usa o mesmo webhook do Checkout Pro (correlação por `external_reference` = orderId).
 *
 * Idempotência: a chave é o orderId, então recriar a cobrança do mesmo pedido
 * devolve o mesmo PIX (evita cobrança duplicada em recargas da página).
 */
export async function createPixPayment(
  input: CreatePixPaymentInput,
): Promise<MercadoPagoPixPayment> {
  const data = await mpFetch<MpPaymentResponse>("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": `order-${input.orderId}` },
    body: JSON.stringify({
      transaction_amount: Math.round(input.amount * 100) / 100,
      description: input.description,
      payment_method_id: "pix",
      external_reference: input.orderId,
      notification_url: input.notificationUrl,
      payer: {
        email: input.payerEmail,
        ...(input.payerFirstName ? { first_name: input.payerFirstName } : {}),
        ...(input.payerLastName ? { last_name: input.payerLastName } : {}),
        ...(input.payerCpf?.length === 11
          ? { identification: { type: "CPF", number: input.payerCpf } }
          : {}),
      },
    }),
  });
  const tx = data.point_of_interaction?.transaction_data;
  return {
    id: data.id,
    status: data.status,
    qrCode: tx?.qr_code ?? "",
    qrCodeBase64: tx?.qr_code_base64 ?? "",
    ticketUrl: tx?.ticket_url,
  };
}

/* ── Pagamentos ─────────────────────────────────────────────────────── */

export interface MercadoPagoPayment {
  id: number;
  status: string;
  external_reference?: string;
}

/** Busca um pagamento na API do MP (fonte da verdade para o webhook). */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment> {
  return mpFetch<MercadoPagoPayment>(`/v1/payments/${paymentId}`, { method: "GET" });
}

/* ── Mapeamento de status MP → status interno ───────────────────────── */

/**
 * Converte o status de um pagamento do Mercado Pago no nosso `PaymentStatus`.
 * Retorna `null` para estados sem transição (pending, in_process, authorized).
 */
export function mapMercadoPagoStatus(status: string): PaymentStatus | null {
  switch (status) {
    case "approved":
      return "paid";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "cancelled":
      return "cancelled";
    case "rejected":
      return "failed";
    default:
      return null; // pending, in_process, authorized, etc.
  }
}

/* ── Gateway (mesma interface do manual) ────────────────────────────── */

/**
 * Gateway do Mercado Pago. O `createPayment` é síncrono (igual ao manual):
 * apenas registra a intenção com provider "mercadopago" e status "pending". A
 * cobrança PIX é criada na rota de servidor (`createPixPayment`), que grava o
 * `providerRef` (id do pagamento) no pedido.
 */
export const mercadopagoGateway: PaymentGateway = {
  provider: "mercadopago",
  createPayment({ method, amount }: CreatePaymentInput): PaymentInfo {
    const now = new Date().toISOString();
    return {
      method,
      provider: "mercadopago",
      status: "pending",
      amount,
      history: [{ status: "pending", timestamp: now, note: "Aguardando pagamento no Mercado Pago" }],
    };
  },
};
