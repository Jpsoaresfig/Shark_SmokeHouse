import { NextResponse, type NextRequest } from "next/server";
import {
  isValidWebhookToken,
  mapAsaasStatus,
  type AsaasPaymentStatus,
} from "@/lib/payments/asaas";
import {
  applyPaymentStatusAdmin,
  findOrderIdByProviderRef,
  getOrderAdmin,
} from "@/lib/firebase/orders.server";

export const runtime = "nodejs";

/**
 * Webhook do Asaas — confirma/atualiza o pagamento de um pedido.
 *
 * Configure no painel do Asaas (Integrações → Webhooks):
 *   URL:   https://SEU_DOMINIO/api/webhooks/asaas
 *   Token: o mesmo valor de ASAAS_WEBHOOK_TOKEN (enviado no header
 *          `asaas-access-token`, validado aqui).
 *
 * Comportamento:
 *   - 401 se o token não bater (Asaas reenvia depois).
 *   - 200 sempre que o evento foi processado OU não exige ação (PENDING etc.),
 *     para o Asaas parar de reenviar.
 *   - 500 só em falha real de processamento, para o Asaas tentar de novo.
 *
 * Idempotência: `applyPaymentStatusAdmin` ignora a transição se o pedido já
 * está no status alvo — então reenvios do mesmo evento não dão baixa dupla.
 */
export async function POST(request: NextRequest) {
  if (!isValidWebhookToken(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ error: "Token inválido." }, { status: 401 });
  }

  let body: {
    event?: string;
    payment?: { id?: string; status?: AsaasPaymentStatus; externalReference?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  const payment = body.payment;
  if (!payment?.id || !payment.status) {
    // Sem dados de cobrança não há o que fazer — confirma para não reenviar.
    return NextResponse.json({ received: true, skipped: "sem dados de cobrança" });
  }

  const target = mapAsaasStatus(payment.status);
  if (!target) {
    // Status sem transição (PENDING, análise de risco, etc.).
    return NextResponse.json({ received: true, skipped: payment.status });
  }

  try {
    // Correlação: externalReference (id do pedido) tem prioridade; senão busca
    // pelo providerRef (id da cobrança) gravado no pedido.
    let orderId = payment.externalReference?.trim() || null;
    if (orderId && !(await getOrderAdmin(orderId))) orderId = null;
    if (!orderId) orderId = await findOrderIdByProviderRef(payment.id);

    if (!orderId) {
      console.warn("Webhook Asaas: pedido não encontrado", {
        chargeId: payment.id,
        externalReference: payment.externalReference,
      });
      // Confirma para não reenviar indefinidamente; é um evento órfão.
      return NextResponse.json({ received: true, skipped: "pedido não encontrado" });
    }

    const applied = await applyPaymentStatusAdmin(orderId, target, {
      note: `Asaas: ${body.event ?? payment.status}`,
    });

    return NextResponse.json({ received: true, orderId, status: target, applied });
  } catch (err) {
    console.error("Erro ao processar webhook do Asaas:", err);
    // 500 → Asaas reenvia o evento mais tarde.
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
}
