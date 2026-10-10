import { NextResponse, type NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resgate de recompensa do Clube Shark — executado NO SERVIDOR (Admin SDK).
 *
 * Antes o resgate era todo client-side: o cliente podia criar um pedido
 * `isRedemption` (total 0, pago) sem debitar pontos, ou disputar o saldo com
 * dois resgates simultâneos. Aqui, numa única transação:
 *   1. valida o idToken (Bearer) — o uid vem do token, nunca do corpo;
 *   2. relê saldo e produto (ativo, custo em pontos > 0, estoque > 0);
 *   3. debita os pontos, baixa 1 do estoque, grava o lançamento "redeemed" e
 *      cria o pedido de resgate para o admin entregar.
 * Tudo ou nada: sem pontos/estoque suficientes nada é gravado.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return NextResponse.json({ error: "não autorizado" }, { status: 401 });

  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "sessão inválida" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { rewardId?: unknown } | null;
  const rewardId = typeof body?.rewardId === "string" ? body.rewardId.trim() : "";
  if (!rewardId || rewardId.length > 128 || rewardId.includes("/")) {
    return NextResponse.json({ error: "recompensa inválida" }, { status: 400 });
  }

  const uid = decoded.uid;
  const db = getAdminDb();
  const userRef = db.collection("users").doc(uid);
  const productRef = db.collection("products").doc(rewardId);
  const ledgerRef = db.collection("loyaltyTransactions").doc();
  const orderRef = db.collection("orders").doc();

  try {
    const result = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const productSnap = await tx.get(productRef);
      if (!userSnap.exists) throw new RedeemError("Perfil não encontrado", 404);
      if (!productSnap.exists) throw new RedeemError("Recompensa indisponível", 409);

      const user = userSnap.data() ?? {};
      const product = productSnap.data() ?? {};
      const cost = Math.round(Number(product.loyaltyPoints) || 0);
      const stock = Number(product.stock) || 0;
      if (product.active === false || cost <= 0 || stock <= 0) {
        throw new RedeemError("Recompensa indisponível", 409);
      }
      const balance = Number(user.loyaltyPoints) || 0;
      if (balance < cost) throw new RedeemError("Pontos insuficientes", 409);

      const name = String(product.name ?? "Recompensa");
      const image = Array.isArray(product.images) && typeof product.images[0] === "string"
        && /^https?:\/\//.test(product.images[0]) ? product.images[0] : "";
      const now = new Date().toISOString();

      tx.update(userRef, {
        loyaltyPoints: FieldValue.increment(-cost),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.update(productRef, {
        stock: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.set(ledgerRef, {
        userId: uid,
        type: "redeemed",
        points: -cost,
        reason: `Resgate: ${name}`,
        rewardId,
        orderId: orderRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
      // Mesmo formato do createOrder do cliente (pedido pago com pontos, sem
      // nova baixa de estoque — já baixado acima).
      tx.set(orderRef, {
        motoboyId: null,
        motoboyName: null,
        customerId: uid,
        customerName: String(user.displayName ?? "").trim() || "Cliente",
        customerPhone: String(user.phone ?? "").trim(),
        items: [{ productId: rewardId, name, price: 0, image, quantity: 1 }],
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
        status: "received",
        paymentMethod: "loyalty",
        paymentStatus: "paid",
        payment: {
          method: "loyalty",
          provider: "manual",
          status: "paid",
          amount: 0,
          paidAt: now,
          history: [{ status: "paid", timestamp: now, note: "Resgate por pontos de fidelidade" }],
        },
        deliveryAddress: {
          id: "pickup",
          label: "Retirada na loja",
          street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "",
        },
        notes: `Resgate de recompensa — ${cost} pontos`,
        statusHistory: [{ status: "received", timestamp: now, note: "Pedido gerado por resgate de pontos" }],
        pointsEarned: 0,
        isRedemption: true,
        pointsRedeemed: cost,
        stockApplied: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { pointsCost: cost, balance: balance - cost, orderId: orderRef.id };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RedeemError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[loyalty] falha no resgate:", err);
    return NextResponse.json({ error: "Não foi possível concluir o resgate." }, { status: 500 });
  }
}

class RedeemError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
