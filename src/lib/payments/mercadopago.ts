import type { PaymentInfo, PaymentStatus } from "@/types";
import type { CreatePaymentInput, PaymentGateway } from "./index";

/**
 * Integração com o Mercado Pago — Checkout Pro (https://www.mercadopago.com.br/developers).
 *
 * Modelo: Checkout Pro. O cliente é redirecionado para a tela do Mercado Pago
 * (restrita a PIX nesta loja), paga, e o Mercado Pago confirma o pagamento via
 * webhook — o mesmo gancho usado pela baixa manual do admin.
 *
 * Fluxo:
 *   1. checkout cria o pedido com `mercadopagoGateway.createPayment(...)`
 *      (provider "mercadopago", status "pending");
 *   2. a tela de sucesso chama POST /api/payments/mercadopago/create { orderId }
 *      → este módulo cria uma "preferência" e devolve o link (`init_point`);
 *   3. o cliente é redirecionado, paga via PIX e volta pelas back_urls;
 *   4. o webhook (POST /api/webhooks/mercadopago) busca o pagamento na API do MP
 *      e aplica a transição no pedido (correlação por `external_reference` = orderId).
 *
 * Variáveis de ambiente (servidor):
 *   MERCADOPAGO_ACCESS_TOKEN — Access Token (TEST-... no sandbox, APP_USR-... em produção)
 *   NEXT_PUBLIC_SITE_URL     — (opcional) URL pública do site para back_urls/webhook;
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

/* ── Preferências (Checkout Pro) ────────────────────────────────────── */

export interface CreatePreferenceInput {
  orderId: string;
  title: string;
  amount: number;
  payerName?: string;
  /** URL pública base (sem barra no fim) para back_urls e notification_url. */
  baseUrl: string;
}

export interface MercadoPagoPreference {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

/**
 * Cria uma preferência de Checkout Pro restrita a PIX. Retorna o link para onde
 * o cliente deve ser redirecionado (`init_point`).
 */
export async function createPreference(input: CreatePreferenceInput): Promise<MercadoPagoPreference> {
  const { orderId, title, amount, payerName, baseUrl } = input;
  return mpFetch<MercadoPagoPreference>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
      items: [
        { id: orderId, title, quantity: 1, unit_price: amount, currency_id: "BRL" },
      ],
      external_reference: orderId,
      ...(payerName ? { payer: { name: payerName } } : {}),
      back_urls: {
        success: `${baseUrl}/orders?pago=sucesso`,
        pending: `${baseUrl}/orders?pago=pendente`,
        failure: `${baseUrl}/orders?pago=falhou`,
      },
      auto_return: "approved",
      // Restringe o Checkout Pro a PIX: exclui cartão e boleto.
      payment_methods: {
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "ticket" },
        ],
        installments: 1,
      },
      notification_url: `${baseUrl}/api/webhooks/mercadopago`,
      statement_descriptor: "SHARK SMOKEHOUSE",
    }),
  });
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
 * preferência de cobrança é criada na rota de servidor (`createPreference`),
 * que grava o `providerRef` no pedido.
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
