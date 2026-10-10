import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { createOrderAdmin, OrderCreateError, type OrderCreateInput } from "@/lib/firebase/orderCreate.server";
import { logSystemError } from "@/lib/observability.server";
import { requestIdFrom } from "@/lib/requestId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/create — cria o pedido do checkout no servidor.
 *
 * Exige o ID token do cliente (Authorization: Bearer). Preços, frete, taxa de
 * cartão, cupom e total são conferidos contra o catálogo/configurações; estoque,
 * pedido e uso do cupom são gravados numa única transação. Ver
 * `createOrderAdmin` (lib/firebase/orderCreate.server).
 */
export async function POST(request: NextRequest) {
  const requestId = requestIdFrom(request.headers);
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "Faça login para finalizar o pedido." }, { status: 401 });
  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as OrderCreateInput | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  try {
    const { id, total } = await createOrderAdmin(decoded.uid, body);
    return NextResponse.json({ id, total });
  } catch (err) {
    if (err instanceof OrderCreateError) {
      if (err.code === "pricing") {
        void logSystemError({
          type: "payment",
          message: "Pedido com valores divergentes — criação recusada",
          route: "/api/orders/create",
          method: "POST",
          statusCode: 409,
          userId: decoded.uid,
          requestId,
          metadata: { total: body.total, problems: err.problems.slice(0, 10) },
        });
      }
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === "invalid" ? 400 : 409 },
      );
    }
    console.error("[orders-create]", err);
    void logSystemError({
      type: "order",
      message: "Falha ao criar pedido",
      stack: err instanceof Error ? err.stack : undefined,
      route: "/api/orders/create",
      method: "POST",
      statusCode: 500,
      userId: decoded.uid,
      requestId,
    });
    return NextResponse.json({ error: "Erro ao finalizar pedido. Tente novamente." }, { status: 500 });
  }
}
