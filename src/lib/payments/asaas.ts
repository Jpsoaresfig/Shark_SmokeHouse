import type { PaymentInfo, PaymentStatus } from "@/types";
import type { CreatePaymentInput, PaymentGateway } from "./index";

/**
 * Integração com o Asaas (https://docs.asaas.com).
 *
 * Esta camada está pronta para receber a API key. Enquanto `ASAAS_API_KEY` não
 * estiver definida, `isAsaasConfigured()` retorna false e as rotas de servidor
 * (`/api/payments/asaas/create`, `/api/webhooks/asaas`) respondem com um erro
 * claro de "não configurado", sem quebrar o build nem o restante do app.
 *
 * Fluxo:
 *   1. checkout cria o pedido com `asaasGateway.createPayment(...)`
 *      (provider "asaas", status "pending");
 *   2. checkout chama POST /api/payments/asaas/create { orderId } → este módulo
 *      cria a cobrança no Asaas e devolve QR Code PIX / link;
 *   3. webhook do Asaas chama POST /api/webhooks/asaas → mapeia o status e
 *      aplica a transição no pedido (mesmo gancho da baixa manual do admin).
 *
 * Variáveis de ambiente (servidor):
 *   ASAAS_API_KEY       — chave da API (sandbox ou produção)
 *   ASAAS_API_URL       — base da API. Default: sandbox.
 *                         Sandbox:  https://api-sandbox.asaas.com/v3
 *                         Produção: https://api.asaas.com/v3
 *   ASAAS_WEBHOOK_TOKEN — token configurado no painel do Asaas, validado no webhook.
 */

const DEFAULT_SANDBOX_URL = "https://api-sandbox.asaas.com/v3";

function apiUrl(): string {
  return (process.env.ASAAS_API_URL ?? DEFAULT_SANDBOX_URL).replace(/\/$/, "");
}

function apiKey(): string | undefined {
  return process.env.ASAAS_API_KEY?.trim() || undefined;
}

/** True quando a integração tem credencial configurada. */
export function isAsaasConfigured(): boolean {
  return Boolean(apiKey());
}

/** Valida o token enviado pelo Asaas no header `asaas-access-token`. */
export function isValidWebhookToken(token: string | null): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  // Sem token configurado, recusamos por segurança (em vez de aceitar tudo).
  if (!expected) return false;
  return token === expected;
}

/* ── Tipos do Asaas (subconjunto usado) ─────────────────────────────── */

export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";

/** Status de cobrança do Asaas (subconjunto relevante para o webhook). */
export type AsaasPaymentStatus =
  | "PENDING"
  | "CONFIRMED"
  | "RECEIVED"
  | "RECEIVED_IN_CASH"
  | "OVERDUE"
  | "REFUNDED"
  | "REFUND_REQUESTED"
  | "CHARGEBACK_REQUESTED"
  | "AWAITING_RISK_ANALYSIS"
  | "DELETED";

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
}

export interface AsaasCharge {
  id: string;
  status: AsaasPaymentStatus;
  value: number;
  billingType: AsaasBillingType;
  invoiceUrl?: string;
  externalReference?: string;
}

export interface AsaasPixQrCode {
  /** Imagem base64 (PNG) do QR Code. */
  encodedImage: string;
  /** Payload "copia e cola" do PIX. */
  payload: string;
  expirationDate?: string;
}

/* ── Cliente HTTP ───────────────────────────────────────────────────── */

class AsaasError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = "AsaasError";
  }
}

async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = apiKey();
  if (!key) throw new AsaasError("ASAAS_API_KEY não configurada", 500);

  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...init.headers,
    },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg =
      (data as { errors?: { description?: string }[] })?.errors?.[0]?.description ??
      `Asaas respondeu ${res.status}`;
    throw new AsaasError(msg, res.status, data);
  }
  return data as T;
}

/* ── Operações ──────────────────────────────────────────────────────── */

export interface NewCustomerInput {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}

/** Cria (ou reaproveita) um cliente no Asaas e devolve seu id. */
export async function createCustomer(input: NewCustomerInput): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface NewChargeInput {
  customerId: string;
  billingType: AsaasBillingType;
  value: number;
  /** id do pedido no Firestore — usado para correlacionar no webhook. */
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
  description?: string;
}

/** Cria uma cobrança no Asaas. */
export async function createCharge(input: NewChargeInput): Promise<AsaasCharge> {
  const { customerId, ...rest } = input;
  return asaasFetch<AsaasCharge>("/payments", {
    method: "POST",
    body: JSON.stringify({ customer: customerId, ...rest }),
  });
}

/** Obtém o QR Code PIX de uma cobrança. */
export async function getPixQrCode(chargeId: string): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(`/payments/${chargeId}/pixQrCode`, { method: "GET" });
}

/* ── Mapeamento de status Asaas → status interno ────────────────────── */

/**
 * Converte o status de uma cobrança Asaas no nosso `PaymentStatus`. Retorna
 * `null` para eventos que não devem alterar o pedido (ex.: PENDING/análise).
 */
export function mapAsaasStatus(status: AsaasPaymentStatus): PaymentStatus | null {
  switch (status) {
    case "CONFIRMED":
    case "RECEIVED":
    case "RECEIVED_IN_CASH":
      return "paid";
    case "REFUNDED":
      return "refunded";
    case "OVERDUE":
      return "failed";
    case "DELETED":
      return "cancelled";
    default:
      return null; // PENDING, análise de risco, etc. — sem transição
  }
}

/* ── Gateway (mesma interface do manual) ────────────────────────────── */

/**
 * Gateway do Asaas. O `createPayment` é síncrono (igual ao manual): apenas
 * registra a intenção com provider "asaas" e status "pending". A cobrança de
 * verdade é criada de forma assíncrona na rota de servidor (`createCharge`),
 * que então grava `providerRef` no pedido.
 */
export const asaasGateway: PaymentGateway = {
  provider: "asaas",
  createPayment({ method, amount }: CreatePaymentInput): PaymentInfo {
    const now = new Date().toISOString();
    return {
      method,
      provider: "asaas",
      status: "pending",
      amount,
      history: [{ status: "pending", timestamp: now, note: "Cobrança Asaas iniciada" }],
    };
  },
};
