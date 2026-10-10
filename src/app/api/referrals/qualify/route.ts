import { NextResponse, type NextRequest } from "next/server";
import { getOrderAdmin } from "@/lib/firebase/orders.server";
import { qualifyReferralForPaidOrder } from "@/lib/firebase/referrals.server";

export const runtime = "nodejs";

/**
 * Libera a bonificação de indicação após a 1ª compra paga do indicado (Task 3.2).
 *
 * Chamada pelo cliente (admin) logo após dar baixa manual no pagamento de um
 * pedido. NÃO exige autenticação porque NÃO confia no chamador: lê o pedido no
 * servidor (Admin SDK) e só credita se o pedido estiver realmente `paid` e houver
 * uma indicação PENDENTE para o cliente. É idempotente — reentradas não creditam
 * de novo. O fluxo do Mercado Pago já chama qualifyReferralForPaidOrder direto no
 * webhook; esta rota cobre a baixa manual.
 */
export async function POST(request: NextRequest) {
  const { orderId } = (await request.json().catch(() => ({}))) as { orderId?: unknown };
  // Valida o tipo/formato: um objeto ou path ("a/b") quebraria o doc() do Admin SDK.
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
    return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
  }

  try {
    const order = await getOrderAdmin(orderId);
    if (!order) {
      return NextResponse.json({ error: "pedido não encontrado" }, { status: 404 });
    }
    const qualified = await qualifyReferralForPaidOrder(order);
    return NextResponse.json({ qualified });
  } catch (err) {
    console.error("Erro ao qualificar indicação:", err);
    return NextResponse.json({ error: "Falha ao qualificar indicação." }, { status: 500 });
  }
}
