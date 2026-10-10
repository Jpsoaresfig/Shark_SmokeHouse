import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { confirmWhatsappOrderAdmin, OrderCreateError } from "@/lib/firebase/orderCreate.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/confirm-whatsapp { orderId } — o cliente confirma que concluiu
 * a compra combinada pelo WhatsApp. Roda no servidor porque baixa o estoque
 * (clientes não gravam mais em `products`). Exige o ID token do dono do pedido.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "sessão inválida" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { orderId?: unknown } | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(orderId)) {
    return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
  }

  try {
    await confirmWhatsappOrderAdmin(decoded.uid, orderId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrderCreateError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[orders-confirm-whatsapp]", err);
    return NextResponse.json({ error: "Não foi possível confirmar o pedido." }, { status: 500 });
  }
}
