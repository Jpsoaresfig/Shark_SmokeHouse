import { NextResponse, type NextRequest } from "next/server";
import { isMercadoPagoConfigured, createPixPayment } from "@/lib/payments/mercadopago";
import { getOrderAdmin, setOrderProviderRef } from "@/lib/firebase/orders.server";
import { resolveOrderPayment } from "@/lib/payments";

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

  const order = await getOrderAdmin(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (resolveOrderPayment(order).status === "paid") {
    return NextResponse.json({ error: "Este pedido já foi pago." }, { status: 409 });
  }

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
    });

    await setOrderProviderRef(orderId, String(pix.id));

    return NextResponse.json({
      ok: true,
      paymentId: pix.id,
      status: pix.status,
      qrCode: pix.qrCode,
      qrCodeBase64: pix.qrCodeBase64,
      ticketUrl: pix.ticketUrl,
    });
  } catch (err) {
    console.error("Erro ao criar cobrança PIX no Mercado Pago:", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento." },
      { status: 502 },
    );
  }
}
