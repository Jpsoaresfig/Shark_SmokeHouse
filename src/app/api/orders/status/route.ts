import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { updateOrderStatusAdmin } from "@/lib/firebase/orderStatus.server";
import { StatusChangeError } from "@/lib/orderStatusPlan";
import { logSystemError } from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";
import type { OrderStatus, UserRole } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: OrderStatus[] = [
  "reserved", "received", "analyzing", "approved", "preparing", "out_for_delivery", "delivered", "cancelled",
];

/**
 * POST /api/orders/status { orderId, status, note? } — a equipe muda o status do
 * pedido. Roda no servidor porque, junto com o status, baixa/estorna estoque,
 * libera o cupom e devolve pontos de resgate numa única transação (ver
 * `updateOrderStatusAdmin`). Exige o ID token; o papel vem de users/{uid}.role:
 * admin/vendedor mudam qualquer pedido, motoboy só avança as próprias entregas.
 */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "sessão inválida" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { orderId?: unknown; status?: unknown; note?: unknown }
    | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
    return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
  }
  const status = body?.status as OrderStatus;
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";

  const profile = await getAdminDb().collection("users").doc(decoded.uid).get();
  const role = profile.data()?.role as UserRole | undefined;
  if (role !== "admin" && role !== "seller" && role !== "motoboy") {
    return NextResponse.json({ error: "acesso restrito à equipe" }, { status: 403 });
  }

  try {
    const { customerId } = await updateOrderStatusAdmin({ uid: decoded.uid, role }, orderId, status, note || undefined);
    return NextResponse.json({ ok: true, customerId });
  } catch (err) {
    if (err instanceof StatusChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[orders-status]", err);
    void logSystemError({
      type: "order",
      message: "Falha ao atualizar status do pedido",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/orders/status",
      method: "POST",
      statusCode: 500,
      userId: decoded.uid,
      requestId,
      metadata: { orderId, status },
    });
    return NextResponse.json({ error: "Não foi possível atualizar o pedido." }, { status: 500 });
  }
}
