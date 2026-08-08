import { NextResponse, type NextRequest } from "next/server";
import { isMercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { syncMercadoPagoPayment } from "@/lib/payments/mercadopago.server";
import {
  createSystemAlert,
  logSystemError,
  logWebhookEvent,
  recordMonitoredRequest,
} from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";

export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago — confirma/atualiza o pagamento de um pedido.
 *
 * Configure no painel do Mercado Pago (Suas integrações → Webhooks) ou via
 * `notification_url` da cobrança (já enviada na criação):
 *   URL:  https://SEU_DOMINIO/api/webhooks/mercadopago
 *   Evento: Pagamentos (payment)
 *
 * Segurança: não confiamos no corpo da notificação. Pegamos só o id do
 * pagamento e o buscamos na API do MP com o nosso Access Token — a resposta da
 * API é a fonte da verdade (status + external_reference = id do pedido). Uma
 * notificação forjada com id inexistente simplesmente falha o GET e é ignorada.
 *
 * A lógica de baixa fica em `syncMercadoPagoPayment` (compartilhada com o polling
 * de status do cliente), que é idempotente — reenvios do mesmo evento não dão
 * baixa dupla.
 *
 * Comportamento:
 *   - 200 quando processado OU sem ação necessária (para o MP parar de reenviar).
 *   - 500 só em falha real, para o MP tentar de novo.
 */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  void recordMonitoredRequest("webhook-mercadopago");

  if (!isMercadoPagoConfigured()) {
    // Sem credencial não há como validar/buscar; confirma para não reenviar.
    void logWebhookEvent({ provider: "mercadopago", status: "skipped", requestId, error: "não configurado" });
    return NextResponse.json({ received: true, skipped: "não configurado" });
  }

  const url = new URL(request.url);
  // O MP envia o id em formatos diferentes (querystring ou corpo).
  let type = url.searchParams.get("type") ?? url.searchParams.get("topic");
  let paymentId =
    url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? null;

  try {
    const body = (await request.json().catch(() => null)) as
      | { type?: string; topic?: string; action?: string; data?: { id?: string | number } }
      | null;
    if (body) {
      type = type ?? body.type ?? body.topic ?? null;
      if (!paymentId && body.data?.id != null) paymentId = String(body.data.id);
    }
  } catch {
    /* corpo vazio/não-JSON — seguimos com os parâmetros da querystring */
  }

  // Só tratamos eventos de pagamento.
  if (type && type !== "payment") {
    void logWebhookEvent({ provider: "mercadopago", type, status: "skipped", requestId, error: "tipo não tratado" });
    return NextResponse.json({ received: true, skipped: type });
  }
  if (!paymentId) {
    void logWebhookEvent({ provider: "mercadopago", type: type ?? "payment", status: "skipped", requestId, error: "sem id de pagamento" });
    return NextResponse.json({ received: true, skipped: "sem id de pagamento" });
  }

  const started = Date.now();
  try {
    const result = await syncMercadoPagoPayment(paymentId);
    const webhookStatus =
      result.applied ? "success" : result.status ? "duplicate" : "skipped";
    void logWebhookEvent({
      provider: "mercadopago",
      type: type ?? "payment",
      providerRef: String(paymentId),
      orderId: result.orderId ?? undefined,
      status: webhookStatus,
      processingTime: Date.now() - started,
      requestId,
    });
    if (!result.status) {
      // Status sem transição (pending, in_process, etc.).
      return NextResponse.json({ received: true, skipped: "sem transição" });
    }
    if (!result.orderId) {
      console.warn("Webhook MP: pedido não encontrado", { paymentId });
      return NextResponse.json({ received: true, skipped: "pedido não encontrado" });
    }
    return NextResponse.json({
      received: true,
      orderId: result.orderId,
      status: result.status,
      applied: result.applied,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro ao processar webhook do Mercado Pago:", err);
    void logWebhookEvent({
      provider: "mercadopago",
      type: type ?? "payment",
      providerRef: String(paymentId),
      status: "failed",
      statusCode: 500,
      processingTime: Date.now() - started,
      requestId,
      error: message,
    });
    void logSystemError({
      type: "webhook",
      message: "Webhook do Mercado Pago falhou",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/webhooks/mercadopago",
      method: "POST",
      statusCode: 500,
      requestId,
      metadata: { paymentId: String(paymentId) },
    });
    void createSystemAlert({
      key: "webhook:mercadopago",
      type: "webhook_failures",
      severity: "warning",
      message: "Falha ao processar webhook do Mercado Pago",
      metadata: { requestId, paymentId: String(paymentId) },
    });
    // 500 → MP reenvia o evento mais tarde.
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
