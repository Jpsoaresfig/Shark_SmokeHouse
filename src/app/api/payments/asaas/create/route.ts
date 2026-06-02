import { NextResponse, type NextRequest } from "next/server";
import {
  isAsaasConfigured,
  createCustomer,
  createCharge,
  getPixQrCode,
  type AsaasBillingType,
} from "@/lib/payments/asaas";
import { getOrderAdmin, setOrderProviderRef } from "@/lib/firebase/orders.server";

export const runtime = "nodejs";

/**
 * Cria uma cobrança no Asaas para um pedido já existente no Firestore.
 *
 * Pré-requisito: o checkout cria o pedido com `asaasGateway.createPayment(...)`
 * (provider "asaas", status "pending") e então chama esta rota com o `orderId`.
 *
 * Body: { orderId, cpfCnpj, billingType?, email? }
 *  - cpfCnpj é exigido pelo Asaas para criar o cliente da cobrança.
 *  - billingType: "PIX" (default) | "CREDIT_CARD" | "BOLETO".
 *
 * Retorna o id da cobrança, a invoiceUrl e, no PIX, o QR Code (copia-e-cola +
 * imagem). O pedido recebe `payment.providerRef` = id da cobrança, usado depois
 * pelo webhook para confirmar o pagamento.
 */
export async function POST(request: NextRequest) {
  if (!isAsaasConfigured()) {
    return NextResponse.json(
      { error: "Pagamento automático (Asaas) não configurado." },
      { status: 503 },
    );
  }

  let body: { orderId?: string; cpfCnpj?: string; email?: string; billingType?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const orderId = String(body.orderId ?? "").trim();
  const cpfCnpj = String(body.cpfCnpj ?? "").replace(/\D/g, "");
  const billingType = (body.billingType ?? "PIX") as AsaasBillingType;

  if (!orderId) {
    return NextResponse.json({ error: "orderId é obrigatório." }, { status: 400 });
  }
  if (!cpfCnpj) {
    return NextResponse.json(
      { error: "CPF/CNPJ é obrigatório para gerar a cobrança." },
      { status: 400 },
    );
  }

  const order = await getOrderAdmin(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  try {
    const customer = await createCustomer({
      name: order.customerName,
      cpfCnpj,
      phone: order.customerPhone,
      ...(body.email ? { email: String(body.email).trim() } : {}),
    });

    // Vencimento: hoje (PIX é imediato; ajuste se for usar boleto).
    const dueDate = new Date().toISOString().slice(0, 10);

    const charge = await createCharge({
      customerId: customer.id,
      billingType,
      value: order.total,
      externalReference: orderId,
      dueDate,
      description: `Pedido ${orderId} — Shark SmokeHouse`,
    });

    await setOrderProviderRef(orderId, charge.id);

    const pix =
      billingType === "PIX"
        ? await getPixQrCode(charge.id).catch(() => null)
        : null;

    return NextResponse.json({
      ok: true,
      chargeId: charge.id,
      status: charge.status,
      invoiceUrl: charge.invoiceUrl ?? null,
      pix: pix ? { payload: pix.payload, encodedImage: pix.encodedImage } : null,
    });
  } catch (err) {
    console.error("Erro ao criar cobrança no Asaas:", err);
    return NextResponse.json(
      { error: "Não foi possível gerar a cobrança." },
      { status: 502 },
    );
  }
}
