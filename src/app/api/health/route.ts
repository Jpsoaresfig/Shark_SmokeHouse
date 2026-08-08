import { NextResponse, type NextRequest } from "next/server";
import {
  recordMonitoredRequest,
  requireAdmin,
  runHealthCheck,
} from "@/lib/observability.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health — saúde dos serviços do Shark SmokeHouse.
 *
 * Exclusivo do admin: valida no servidor o ID token (Authorization: Bearer) e a
 * role "admin" no Firestore. Retorna o status agregado e o estado de cada
 * serviço monitorado (api, firestore, mercadopago, cloudinary, resend, cron).
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  void recordMonitoredRequest("health");

  try {
    const health = await runHealthCheck();
    return NextResponse.json(health);
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        services: {},
      },
      { status: 500 },
    );
  }
}
