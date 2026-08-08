import { NextResponse, type NextRequest } from "next/server";
import {
  computeMetrics,
  isMetricsPeriod,
  recordMonitoredRequest,
  requireAdmin,
} from "@/lib/observability.server";
import type { MetricsPeriod, SystemMetrics } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/metrics?period=24h — métricas agregadas do sistema.
 *
 * Períodos: 1h | 6h | 24h | 7d | 30d (padrão 24h). Exclusivo do admin: valida
 * no servidor o ID token (Authorization: Bearer) e a role "admin" no Firestore.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const raw = request.nextUrl.searchParams.get("period") ?? "24h";
  const period: MetricsPeriod = isMetricsPeriod(raw) ? raw : "24h";

  void recordMonitoredRequest("metrics");

  try {
    const metrics: SystemMetrics = await computeMetrics(period);
    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json(
      { error: "Falha ao computar métricas." },
      { status: 500 },
    );
  }
}
