import { NextResponse, type NextRequest } from "next/server";
import { isMercadoPagoConfigured, createPreference } from "@/lib/payments/mercadopago";
import { getOrderAdmin, setOrderProviderRef } from "@/lib/firebase/orders.server";
import { resolveOrderPayment } from "@/lib/payments";

export const runtime = "nodejs";

/** URL pública base para back_urls/webhook: env explícita ou origem da requisição. */
function resolveBaseUrl(request: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/**
 * Cria uma preferência de Checkout Pro (Mercado Pago) para um pedido existente.
 *
 * Pré-requisito: o checkout cria o pedido com `mercadopagoGateway.createPayment(...)`
 * (provider "mercadopago", status "pending") e então chama esta rota.
 *
 * Body: { orderId }
 * Retorna: { initPoint } — URL para onde o cliente deve ser redirecionado.
 */
export async function POST(request: NextRequest) {
  if (!isMercadoPagoConfigured()) {
    return NextResponse.json(
      { error: "Pagamento pelo Mercado Pago não configurado." },
      { status: 503 },
    );
  }

  let body: { orderId?: string };
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

  try {
    const ref = `#${orderId.slice(-8).toUpperCase()}`;
    const preference = await createPreference({
      orderId,
      title: `Pedido ${ref} — Shark SmokeHouse`,
      amount: order.total,
      payerName: order.customerName,
      baseUrl: resolveBaseUrl(request),
    });

    await setOrderProviderRef(orderId, preference.id);

    return NextResponse.json({
      ok: true,
      initPoint: preference.init_point || preference.sandbox_init_point,
    });
  } catch (err) {
    console.error("Erro ao criar preferência no Mercado Pago:", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar o pagamento." },
      { status: 502 },
    );
  }
}
