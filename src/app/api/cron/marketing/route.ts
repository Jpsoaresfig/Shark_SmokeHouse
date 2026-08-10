import { NextResponse, type NextRequest } from "next/server";
import { processMarketingCron } from "@/lib/marketing/server";
import {
  createSystemAlert,
  logCronExecution,
  logSystemError,
  recordMonitoredRequest,
} from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diário do módulo de marketing:
 *   - semeia os templates de mensagem (uma vez);
 *   - processa campanhas agendadas (status=scheduled com data <= agora);
 *   - processa automações ativas (recuperação, aniversário, carrinho, etc.);
 *   - garante os cupons determinísticos das automações/campanhas;
 *   - persiste execuções idempotentes (doc id = chave de dedup);
 *   - cria notificações in-app e registra eventos de marketing.
 *
 * Roda no servidor (Admin SDK). Protegida por CRON_SECRET (Vercel Cron envia
 * `Authorization: Bearer <CRON_SECRET>`).
 *
 * Agendamento (vercel.json):
 *   { "crons": [{ "path": "/api/cron/marketing", "schedule": "0 16 * * *" }] }
 */
export async function POST(request: NextRequest) {
  return run(request);
}
export async function GET(request: NextRequest) {
  return run(request);
}

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Sem CRON_SECRET a rota só fica acessível em desenvolvimento local; em
  // produção a ausência do segredo é recusada (não expõe o processamento).
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  void recordMonitoredRequest("cron-marketing");

  if (!authorized(request)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await processMarketingCron(new Date());
    void logCronExecution({
      job: "marketing",
      status: "success",
      startedAt,
      requestId,
      processed: result.campaignMessages + result.automationMessages,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Cron marketing falhou:", err);
    void logCronExecution({
      job: "marketing",
      status: "failed",
      startedAt,
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    void logSystemError({
      type: "cron",
      message: "Cron marketing falhou",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/cron/marketing",
      method: "POST",
      statusCode: 500,
      requestId,
    });
    void createSystemAlert({
      key: "cron:marketing",
      type: "cron_failed",
      severity: "critical",
      message: "Rotina de marketing falhou",
      metadata: { requestId },
    });
    return NextResponse.json({ error: "falha no processamento de marketing" }, { status: 500 });
  }
}
