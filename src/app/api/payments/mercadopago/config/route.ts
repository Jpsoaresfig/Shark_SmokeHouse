import { NextResponse } from "next/server";
import { isMercadoPagoConfigured } from "@/lib/payments/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/payments/mercadopago/config — informa ao checkout se o PIX automático
 * está disponível (Access Token configurado). Sem ele a opção some do checkout,
 * em vez de criar o pedido e falhar ao gerar o PIX. Não expõe a credencial.
 */
export async function GET() {
  return NextResponse.json({ enabled: isMercadoPagoConfigured() });
}
