import {
  doc, updateDoc, addDoc, getDocs, collection,
  query, where, orderBy, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LoyaltyTransaction, LoyaltyReward } from "@/types";

const POINTS_PER_REFERRAL = 200;

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SHARK-${suffix}`;
}

export async function processReferral(newUserId: string, referralCode: string): Promise<void> {
  const q = query(collection(db, "users"), where("referralCode", "==", referralCode));
  const snap = await getDocs(q);
  if (snap.empty) return;

  const referrerDoc = snap.docs[0];
  const referrerId = referrerDoc.id;
  if (referrerId === newUserId) return;

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

  await updateDoc(doc(db, "users", newUserId), {
    referredBy: referrerId,
    updatedAt: serverTimestamp(),
  });
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
  currentPoints: number
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
}
