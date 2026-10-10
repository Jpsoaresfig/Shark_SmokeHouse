import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/coupons/usage — quantas vezes um CPF já usou um cupom.
 *
 * A contagem por CPF precisa ler resgates de OUTRAS contas (é isso que impede
 * burlar o limite criando outra conta), mas `couponRedemptions` guarda CPFs e
 * não pode ser legível por qualquer cliente. Então a contagem roda aqui, com o
 * Admin SDK, e só o número volta. Exige usuário autenticado (ID token).
 */
export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const { couponId, cpf } = (body ?? {}) as { couponId?: unknown; cpf?: unknown };
  if (typeof couponId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(couponId)) {
    return NextResponse.json({ error: "couponId inválido" }, { status: 400 });
  }
  const cpfDigits = typeof cpf === "string" ? cpf.replace(/\D/g, "") : "";
  if (cpfDigits.length !== 11) return NextResponse.json({ count: 0 });

  try {
    const snap = await getAdminDb()
      .collection("couponRedemptions")
      .where("couponId", "==", couponId)
      .where("cpf", "==", cpfDigits)
      .count()
      .get();
    return NextResponse.json({ count: snap.data().count });
  } catch {
    return NextResponse.json({ error: "Falha ao consultar o cupom." }, { status: 500 });
  }
}
