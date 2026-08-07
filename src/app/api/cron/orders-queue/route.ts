import { NextResponse, type NextRequest } from "next/server";
import { processReservedQueue } from "@/lib/firebase/orders.server";

export const runtime = "nodejs";
// Sem cache: é uma rotina disparada por cron.
export const dynamic = "force-dynamic";

/**
 * Fila de pedidos reservados: quando a loja está ABERTA, libera os pedidos que
 * foram feitos fora do horário de funcionamento (`reserved` → `received`).
 *
 * Roda no servidor (Admin SDK) via Vercel Cron, usando o fuso da loja
 * (STORE_TIMEZONE) — o relógio do servidor roda em UTC. Protegida por
 * CRON_SECRET: o Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`.
 *
 * Agendamento (vercel.json):
 *   { "crons": [{ "path": "/api/cron/orders-queue", "schedule": "a cada 15 minutos" }] }
 */
export async function POST(request: NextRequest) {
  return run(request);
}
// Vercel Cron dispara via GET; aceitamos ambos.
export async function GET(request: NextRequest) {
  return run(request);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem segredo configurado, não bloqueia (dev/local)
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  try {
    const result = await processReservedQueue(new Date());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Cron orders-queue falhou:", err);
    return NextResponse.json({ error: "falha no processamento da fila" }, { status: 500 });
  }
}
