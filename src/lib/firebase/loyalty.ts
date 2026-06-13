import {
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs, collection,
  query, where, orderBy, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createOrder } from "@/lib/firebase/orders";
import { invalidate } from "@/lib/firebase/cache";
import { computeOrderPointsForItems } from "@/lib/loyalty/levels";
import type { LoyaltyTransaction, LoyaltyReward, Order } from "@/types";

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SHARK-${suffix}`;
}

/** Normaliza um código de convite digitado/colado (link ou código puro). */
export function normalizeReferralCode(raw: string): string {
  const trimmed = raw.trim();
  // Aceita colar o link inteiro (…/register?ref=SHARK-XXXX) ou só o código.
  const fromUrl = trimmed.match(/[?&]ref=([^&\s]+)/i);
  const code = (fromUrl ? fromUrl[1] : trimmed).toUpperCase();
  return code;
}

/**
 * Public lookup so a brand-new user can resolve a referral code → referrer uid
 * without querying the (private) users collection. Each user registers their own
 * mapping at signup. Doc id = the referral code itself.
 */
export async function registerReferralCode(uid: string, referralCode: string): Promise<void> {
  await setDoc(doc(db, "referralCodes", referralCode), { uid });
}

/**
 * Registra o vínculo indicador → indicado no momento do cadastro do indicado.
 *
 * IMPORTANTE: NÃO credita pontos aqui. Pela regra do Clube Shark (Task 3.2), a
 * bonificação ao indicador só é liberada quando o indicado conclui a 1ª compra
 * PAGA. Esta função apenas valida o código e PERSISTE a amarração de forma
 * idempotente — deve ser AGUARDADA (await) antes de qualquer navegação, senão a
 * gravação é cancelada pelo redirect e o vínculo se perde (era o bug da 3.1).
 *
 * Retorna o uid do indicador quando a indicação é válida e foi registrada.
 */
export async function recordReferral(
  newUserId: string,
  rawReferralCode: string,
): Promise<string | null> {
  const referralCode = normalizeReferralCode(rawReferralCode);
  if (!referralCode) return null;

  const codeSnap = await getDoc(doc(db, "referralCodes", referralCode));
  if (!codeSnap.exists()) return null;

  const referrerId = codeSnap.data().uid as string | undefined;
  // Código inexistente, malformado ou auto-indicação → ignora silenciosamente.
  if (!referrerId || referrerId === newUserId) return null;

  // Idempotência: se já houver indicação registrada para este indicado, não
  // sobrescreve (impede re-vínculo ou troca de indicador).
  const existing = await getDoc(doc(db, "referrals", newUserId));
  if (existing.exists()) return existing.data().referrerId ?? null;

  // 1) Amarração no próprio perfil do indicado (consulta rápida no cliente).
  await updateDoc(doc(db, "users", newUserId), {
    referredBy: referrerId,
    updatedAt: serverTimestamp(),
  });

  // 2) Registro canônico da indicação, PENDENTE de bonificação. A Task 3.2
  //    promove para "qualified" e credita os pontos na 1ª compra paga.
  await setDoc(doc(db, "referrals", newUserId), {
    referrerId,
    referredUserId: newUserId,
    code: referralCode,
    status: "pending",
    pointsAwarded: 0,
    createdAt: serverTimestamp(),
  });

  return referrerId;
}

/**
 * Credita os pontos de uma compra concluída, aplicando a engine do Clube Shark:
 *  - taxa por nível atual do cliente (Baby/Hunter/Predatory/Megalodon);
 *  - identificação obrigatória: sem CPF preenchido, NÃO computa pontos;
 *  - base elegível = preço × quantidade de cada item (frete e resgates não pontuam);
 *  - "Pontos em Dobro" (Task 3.5): cada item aplica seu `pointsMultiplier` (1 ou 2)
 *    congelado na compra.
 *
 * Recalcula a TAXA no momento do crédito (lê o perfil atual) para refletir o nível
 * vigente; o multiplicador de campanha vem do snapshot do item. Retorna os pontos
 * efetivamente creditados (0 = sem CPF ou sem base elegível).
 */
export async function awardPurchasePointsForOrder(order: Order): Promise<number> {
  if (order.isRedemption) return 0;

  const userSnap = await getDoc(doc(db, "users", order.customerId));
  const user = userSnap.exists() ? userSnap.data() : null;
  const cpfPresent = !!(user?.cpf && String(user.cpf).trim());

  const points = computeOrderPointsForItems({
    items: order.items.map((i) => ({
      reais: i.price * i.quantity,
      multiplier: i.pointsMultiplier,
    })),
    currentPoints: (user?.loyaltyPoints as number) ?? 0,
    cpfPresent,
  });
  if (points <= 0) return 0;

  await addLoyaltyPoints(
    order.customerId,
    points,
    `Compra #${order.id.slice(-6).toUpperCase()}`,
    "earned",
  );
  return points;
}

export async function addLoyaltyPoints(
  uid: string,
  points: number,
  reason: string,
  type: LoyaltyTransaction["type"] = "earned"
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    loyaltyPoints: increment(points),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "loyaltyTransactions"), {
    userId: uid,
    type,
    points,
    reason,
    createdAt: serverTimestamp(),
  });
}

/**
 * Ajuste manual de pontos pelo admin (PDV/balcão — Task 3.4). `points` é assinado:
 * positivo credita, negativo debita. Registra o motivo e o autor (`by`) no ledger
 * para auditoria. O crédito positivo entra na validade de 180 dias como qualquer
 * outro lote. Quem chama deve impedir débito maior que o saldo (UI), para não
 * deixar o saldo negativo.
 */
export async function adjustLoyaltyPoints(
  uid: string,
  points: number,
  reason: string,
  by?: string,
): Promise<void> {
  if (!points) return;
  await updateDoc(doc(db, "users", uid), {
    loyaltyPoints: increment(points),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "loyaltyTransactions"), {
    userId: uid,
    type: "adjustment",
    points,
    reason: reason.trim() || (points > 0 ? "Crédito manual" : "Débito manual"),
    ...(by ? { by } : {}),
    createdAt: serverTimestamp(),
  });
  invalidate("users");
}

export async function getLoyaltyTransactions(uid: string): Promise<LoyaltyTransaction[]> {
  const q = query(
    collection(db, "loyaltyTransactions"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoyaltyTransaction));
}

export async function getLoyaltyRewards(): Promise<LoyaltyReward[]> {
  const q = query(
    collection(db, "products"),
    where("active", "==", true),
    where("loyaltyPoints", ">", 0),
    orderBy("loyaltyPoints", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.shortDescription || data.description || "",
      image: data.images?.[0] ?? undefined,
      pointsCost: data.loyaltyPoints,
      stock: data.stock ?? 0,
      active: data.active,
      createdAt: data.createdAt,
    } as LoyaltyReward;
  });
}

export async function redeemReward(
  uid: string,
  reward: LoyaltyReward,
  currentPoints: number,
  customer?: { name?: string; phone?: string },
): Promise<void> {
  if (currentPoints < reward.pointsCost) throw new Error("Pontos insuficientes");
  if (reward.stock <= 0) throw new Error("Recompensa indisponível");

  await updateDoc(doc(db, "users", uid), {
    loyaltyPoints: increment(-reward.pointsCost),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "products", reward.id), {
    stock: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "loyaltyTransactions"), {
    userId: uid,
    type: "redeemed",
    points: -reward.pointsCost,
    reason: `Resgate: ${reward.name}`,
    rewardId: reward.id,
    createdAt: serverTimestamp(),
  });
  invalidate("products"); // estoque da recompensa baixou
  invalidate("users");    // pontos do cliente mudaram

  // Gera um pedido para o admin acompanhar/entregar o resgate — como se fosse uma
  // compra, mas paga com pontos. Não baixa estoque de novo (isRedemption: true).
  const rewardImage =
    reward.image && /^https?:\/\//.test(reward.image) ? reward.image : "";
  const now = new Date().toISOString();
  await createOrder({
    customerId: uid,
    customerName: customer?.name?.trim() || "Cliente",
    customerPhone: customer?.phone?.trim() || "",
    items: [{
      productId: reward.id,
      name: reward.name,
      price: 0,
      image: rewardImage,
      quantity: 1,
    }],
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
    notes: `Resgate de recompensa — ${reward.pointsCost} pontos`,
    statusHistory: [{
      status: "received",
      timestamp: new Date().toISOString(),
      note: "Pedido gerado por resgate de pontos",
    }],
    pointsEarned: 0,
    isRedemption: true,
    pointsRedeemed: reward.pointsCost,
  });
}
