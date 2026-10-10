import { NextResponse, type NextRequest } from "next/server";
import { isMercadoPagoConfigured, createPixPayment } from "@/lib/payments/mercadopago";
import { getOrderAdmin, setOrderProviderRef, verifyOrderPricingAdmin } from "@/lib/firebase/orders.server";
import { resolveOrderPayment } from "@/lib/payments";
import { logSystemError, recordMonitoredRequest } from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";

export const runtime = "nodejs";

/** URL pública base para notification_url: env explícita ou origem da requisição. */
function resolveBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/**
 * Cria uma cobrança PIX (Mercado Pago) para um pedido existente e devolve o QR
 * Code já com o valor embutido — exibido inline no checkout, sem redirecionar.
 *
 * Pré-requisito: o checkout cria o pedido com `mercadopagoGateway.createPayment(...)`
 * (provider "mercadopago", status "pending") e então chama esta rota.
 *
 * Body: { orderId, payerEmail?, payerCpf? }
 * Retorna: { ok, paymentId, status, qrCode, qrCodeBase64, ticketUrl }
 *
 * A confirmação é assíncrona, via webhook (POST /api/webhooks/mercadopago); o
 * cliente acompanha pelo polling de GET /api/payments/mercadopago/status.
 */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  void recordMonitoredRequest("payments-create");

  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Pagamento pelo Mercado Pago não configurado." },
      { status: 503 },
    );
  }

  let body: { orderId?: string; payerEmail?: string; payerCpf?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId é obrigatório." }, { status: 400 });
  }

  let order;
  try {
    order = await getOrderAdmin(orderId);
  } catch (err) {
    // Falha ao acessar o Firestore via Admin SDK (ex.: credenciais ausentes/erradas
    // na Vercel). Antes isso estourava como 500/502 cru, sem pista da causa.
    const reason = err instanceof Error ? err.message : String(err);
    console.error("Erro ao carregar pedido (Admin SDK):", err);
    return NextResponse.json(
      { error: "Falha ao acessar o pedido no servidor.", reason },
      { status: 500 },
    );
  }
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const currentPay = resolveOrderPayment(order);
  if (currentPay.status === "paid") {
    return NextResponse.json({ error: "Este pedido já foi pago." }, { status: 409 });
  }
  if (currentPay.status === "refunded" || order.status === "cancelled" || order.status === "delivered") {
    return NextResponse.json({ error: "Este pedido não aceita mais pagamento." }, { status: 409 });
  }
  if (currentPay.method !== "mercadopago") {
    return NextResponse.json({ error: "Este pedido não usa pagamento pelo Mercado Pago." }, { status: 409 });
  }

  // O pedido é gravado pelo navegador: NÃO confiamos em `order.total`. Recalcula
  // preços do catálogo, frete do bairro e cupom no servidor antes de cobrar —
  // senão um cliente poderia gravar total R$ 0,01, pagar e o webhook liberaria.
  try {
    const pricing = await verifyOrderPricingAdmin(order);
    if (!pricing.ok || !(pricing.expectedTotal > 0)) {
      console.error("[mercadopago-create] valores do pedido não conferem", { orderId, problems: pricing.problems });
      void logSystemError({
        type: "payment",
        message: "Pedido com valores divergentes — cobrança PIX recusada",
        route: "/api/payments/mercadopago/create",
        method: "POST",
        statusCode: 409,
        userId: typeof order.customerId === "string" ? order.customerId : undefined,
        requestId,
        metadata: { orderId, total: order.total, expectedTotal: pricing.expectedTotal, problems: pricing.problems.slice(0, 10) },
      });
      return NextResponse.json(
        { error: "Os valores do pedido não conferem com os preços atuais. Fale com a loja pelo WhatsApp." },
        { status: 409 },
      );
    }
  } catch (err) {
    console.error("Erro ao conferir valores do pedido:", err);
    return NextResponse.json({ error: "Falha ao conferir o pedido no servidor." }, { status: 500 });
  }

  // Cobrança anterior expirou/foi recusada → gera um PIX NOVO (chave de
  // idempotência diferente) e volta o status para "pending".
  const retrying =
    !!currentPay.providerRef && (currentPay.status === "cancelled" || currentPay.status === "failed");

  // O MP exige um e-mail de pagador válido. Usa o informado pelo cliente quando
  // disponível; senão, deriva um placeholder com formato válido (PIX não envia
  // e-mail ao pagador, então não precisa ser entregável).
  const clientEmail = String(body.payerEmail ?? "").trim();
  const payerEmail =
    clientEmail.includes("@") && clientEmail.length <= 254
      ? clientEmail
      : `pedido-${orderId.slice(-8).toLowerCase()}@shark-smokehouse.com.br`;
  const payerCpf = String(body.payerCpf ?? "").replace(/\D/g, "") || undefined;
  const [firstName, ...rest] = (order.customerName ?? "").trim().split(/\s+/);

  try {
    const ref = `#${orderId.slice(-8).toUpperCase()}`;
    const pix = await createPixPayment({
      orderId,
      amount: order.total,
      description: `Pedido ${ref} — Shark SmokeHouse`,
      payerEmail,
      payerFirstName: firstName || undefined,
      payerLastName: rest.join(" ") || undefined,
      payerCpf,
      notificationUrl: `${resolveBaseUrl(request)}/api/webhooks/mercadopago`,
      ...(retrying ? { idempotencyKey: `order-${orderId}-retry-${currentPay.providerRef}` } : {}),
    });

    await setOrderProviderRef(orderId, String(pix.id), {
      resetPending: retrying && String(pix.id) !== currentPay.providerRef,
    });

    return NextResponse.json({
      ok: true,
      paymentId: pix.id,
      status: pix.status,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
    });
  } catch (err) {
    // Surfaça o motivo real do Mercado Pago para diagnóstico (mensagem do gateway
    // + status). A mensagem do MP não contém segredos. Ex. comum: conta sem chave
    // PIX habilitada ("Collector user without key enabled for QR render").
    console.error("Erro ao criar cobrança PIX no Mercado Pago:", err);
    const isMpError = err instanceof Error && err.name === "MercadoPagoError";
    const reason = err instanceof Error ? err.message : String(err);
    const mpStatus = isMpError ? (err as { status?: number }).status : undefined;
    void logSystemError({
      type: "payment",
      message: "Falha ao criar cobrança PIX no Mercado Pago",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/payments/mercadopago/create",
      method: "POST",
      statusCode: 502,
      userId: typeof order.customerId === "string" ? order.customerId : undefined,
      requestId,
      metadata: { orderId, mpStatus },
    });
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento.", reason, mpStatus },
      { status: 502 },
    );
  }
}
