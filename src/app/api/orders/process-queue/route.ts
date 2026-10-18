import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { maybeProcessReservedQueue } from "@/lib/firebase/orders.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/orders/process-queue — disparo OPORTUNISTA da fila de pedidos
 * reservados, chamado quando a equipe abre o painel (pedidos/motoboy). O cron
 * da Vercel roda só 1x por dia; aqui a fila é liberada assim que a loja abre e
 * alguém da equipe está online. Throttled em 5 min (maybeProcessReservedQueue),
 * então chamadas repetidas são baratas. Exige ID token de admin/vendedor/motoboy.
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "sessão inválida" }, { status: 401 });

  const profile = await getAdminDb().collection("users").doc(decoded.uid).get();
  const role = profile.data()?.role;
  if (role !== "admin" && role !== "seller" && role !== "motoboy") {
    return NextResponse.json({ error: "acesso restrito à equipe" }, { status: 403 });
  }

  try {
    const result = await maybeProcessReservedQueue(new Date());
    return NextResponse.json({ ok: true, skipped: result === null, ...(result ?? {}) });
  } catch (err) {
    console.error("[orders-process-queue]", err);
    return NextResponse.json({ error: "falha ao processar a fila" }, { status: 500 });
  }
}
