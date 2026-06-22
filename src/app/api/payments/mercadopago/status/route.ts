import { NextResponse, type NextRequest } from "next/server";
import { getOrderAdmin } from "@/lib/firebase/orders.server";
import { resolveOrderPayment } from "@/lib/payments";
import { isMercadoPagoConfigured } from "@/lib/payments/mercadopago";
import { syncMercadoPagoPayment } from "@/lib/payments/mercadopago.server";

export const runtime = "nodejs";

/** Estados financeiros já resolvidos — não precisam mais consultar o MP. */
const SETTLED = new Set(["paid", "cancelled", "refunded", "failed"]);

/**
 * Status do pagamento de um pedido — fonte para o polling do cliente enquanto a
 * tela do PIX está aberta.
 *
 * Robustez: além de ler o estado já gravado (que o webhook atualiza), enquanto o
 * pagamento ainda não foi resolvido este endpoint consulta a API do MP
 * diretamente e aplica a confirmação. Assim o pedido é liberado mesmo se a
 * notificação do webhook atrasar ou falhar — a confirmação tem dois caminhos
 * independentes. `syncMercadoPagoPayment` é idempotente.
 *
 * Query: ?orderId=...
 * Retorna: { status, orderStatus }
 */
export async function GET(request: NextRequest) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId é obrigatório." }, { status: 400 });
  }

  let order = await getOrderAdmin(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  let pay = resolveOrderPayment(order);

  // Fallback: pagamento ainda pendente + temos o id do pagamento do MP → confirma
  // direto na API (cobre atraso/falha do webhook). Não derruba o polling se falhar.
  if (!SETTLED.has(pay.status) && pay.providerRef && isMercadoPagoConfigured()) {
    try {
      const result = await syncMercadoPagoPayment(pay.providerRef);
      if (result.applied) {
        const fresh = await getOrderAdmin(orderId);
        if (fresh) {
          order = fresh;
          pay = resolveOrderPayment(fresh);
        }
      }
    } catch (err) {
      console.error("[mercadopago-status] sync", err);
    }
  }

  return NextResponse.json({ status: pay.status, orderStatus: order.status });
}
