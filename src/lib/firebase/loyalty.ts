import {
  doc, getDoc, setDoc, updateDoc, addDoc, getDocs, collection,
  query, where, orderBy, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { createOrder } from "@/lib/firebase/orders";
import type { LoyaltyTransaction, LoyaltyReward } from "@/types";

/** Points the referrer earns for each friend who signs up with their link. */
const POINTS_PER_REFERRAL = 200;
/** Bonus the newly-referred user earns (on top of the welcome points). */
const POINTS_REFERRED_BONUS = 100;

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SHARK-${suffix}`;
}

/**
 * Public lookup so a brand-new user can resolve a referral code → referrer uid
 * without querying the (private) users collection. Each user registers their own
 * mapping at signup. Doc id = the referral code itself.
 */
export async function registerReferralCode(uid: string, referralCode: string): Promise<void> {
  await setDoc(doc(db, "referralCodes", referralCode), { uid });
}

export async function processReferral(newUserId: string, referralCode: string): Promise<void> {
  const codeSnap = await getDoc(doc(db, "referralCodes", referralCode));
  if (!codeSnap.exists()) return;

  const referrerId = codeSnap.data().uid as string | undefined;
  if (!referrerId || referrerId === newUserId) return;

  // Referrer earns points for the indication.
  await updateDoc(doc(db, "users", referrerId), {
    loyaltyPoints: increment(POINTS_PER_REFERRAL),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "loyaltyTransactions"), {
    userId: referrerId,
    type: "referral",
    points: POINTS_PER_REFERRAL,
    reason: "Indicação de amigo",
    referredUserId: newUserId,
    createdAt: serverTimestamp(),
  });

  // The new user also earns a bonus and records who referred them.
  await updateDoc(doc(db, "users", newUserId), {
    referredBy: referrerId,
    loyaltyPoints: increment(POINTS_REFERRED_BONUS),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "loyaltyTransactions"), {
    userId: newUserId,
    type: "referral",
    points: POINTS_REFERRED_BONUS,
    reason: "Bônus por indicação",
    createdAt: serverTimestamp(),
  });
}

/** Credits a customer the loyalty points earned from a delivered order. */
export async function awardPurchasePoints(
  userId: string,
  points: number,
  orderId: string,
): Promise<void> {
  if (!points || points <= 0) return;
  await addLoyaltyPoints(userId, points, `Compra #${orderId.slice(-6).toUpperCase()}`, "earned");
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
