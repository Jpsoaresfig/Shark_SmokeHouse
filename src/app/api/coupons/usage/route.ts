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
 *
 * CPF consultado: qualquer CPF válido de 11 dígitos, de propósito. O checkout
 * envia o CPF DIGITADO no formulário, que pode ser novo (1ª compra) ou diferente
 * do perfil (o pedido atualiza o perfil depois), e o PDV do vendedor consulta o
 * CPF do cliente do balcão. Restringir ao CPF do perfil quebraria esses fluxos.
 * O risco é baixo: a resposta é só um número (usos daquele cupom por aquele
 * CPF), nunca dados pessoais, e exige conhecer o código do cupom e o CPF. O
 * limite real continua garantido no servidor na criação do pedido.
 */

/** Doc ids de cupom: o que normalizeCouponCode produz (maiúsculas, sem espaços,
 *  acentos permitidos — ex.: "VERÃO10"). Barra é proibida (separador de path no
 *  Firestore), assim como "."/".." e ids reservados "__…__". */
function isValidCouponId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length < 1 || id.length > 128) return false;
  if (/[\s/\u0000-\u001f\u007f]/u.test(id)) return false;
  if (id === "." || id === "..") return false;
  if (/^__.*__$/.test(id)) return false;
  return true;
}

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
  if (!isValidCouponId(couponId)) {
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
