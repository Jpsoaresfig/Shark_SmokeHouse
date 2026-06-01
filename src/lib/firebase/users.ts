import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp,
  collection, getDocs, query, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateReferralCode, registerReferralCode } from "./loyalty";
import type { UserProfile, UserRole } from "@/types";

const COLLECTION = "users";
const ADMIN_EMAIL = "admin@shark.com";

export async function createUserProfile(
  uid: string,
  data: { email: string; displayName: string; phone?: string }
): Promise<UserProfile> {
  const ref = doc(db, COLLECTION, uid);
  const isAdmin = data.email === ADMIN_EMAIL;
  // Every account gets a referral link, regardless of role.
  const referralCode = generateReferralCode();
  const profile: Omit<UserProfile, "updatedAt"> & { createdAt: unknown; updatedAt: unknown } = {
    uid,
    email: data.email,
    displayName: data.displayName,
    phone: data.phone ?? "",
    role: (isAdmin ? "admin" : "customer") as UserRole,
    loyaltyPoints: isAdmin ? 0 : 100,
    referralCode,
    addresses: [],
    createdAt: serverTimestamp() as unknown as string,
    updatedAt: serverTimestamp() as unknown as string,
  };
  await setDoc(ref, profile);
  if (referralCode) await registerReferralCode(uid, referralCode);
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/**
 * Backfills the referral setup for older accounts:
 *  - generates a referral code if the profile has none;
 *  - ALWAYS makes sure the public `referralCodes/{code}` lookup exists, since an
 *    earlier write may have failed (e.g. before the rules were deployed).
 * Wrapped in try/catch so a transient permission error never breaks login.
 */
export async function ensureReferralCode(profile: UserProfile): Promise<UserProfile> {
  let referralCode = profile.referralCode;
  try {
    if (!referralCode) {
      referralCode = generateReferralCode();
      await updateDoc(doc(db, COLLECTION, profile.uid), { referralCode, updatedAt: serverTimestamp() });
    }
    const mapRef = doc(db, "referralCodes", referralCode);
    const mapSnap = await getDoc(mapRef);
    if (!mapSnap.exists()) {
      await setDoc(mapRef, { uid: profile.uid });
    }
  } catch (err) {
    console.error("Falha ao garantir código de indicação:", err);
  }
  return { ...profile, referralCode };
}

export async function updateUserProfile(
  uid: string,
  data: Partial<Pick<UserProfile, "displayName" | "phone" | "photoURL" | "addresses">>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllUsers(limitCount?: number): Promise<UserProfile[]> {
  const q = limitCount
    ? query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(limitCount))
    : query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as UserProfile);
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { role, updatedAt: serverTimestamp() });
}

/**
 * Define/atualiza a % de comissão de um vendedor. Passar `undefined` ou `null`
 * remove a comissão (vendedor sem comissão).
 */
export async function updateUserCommission(
  uid: string,
  commissionRate: number | null | undefined,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), {
    commissionRate: commissionRate == null ? deleteField() : commissionRate,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid));
}

export async function createUserWithRole(
  email: string,
  password: string,
  displayName: string,
  phone: string,
  role: UserRole,
  commissionRate?: number,
): Promise<UserProfile> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    }
  );
  if (!res.ok) {
    const err = await res.json();
    const msgMap: Record<string, string> = {
      EMAIL_EXISTS: "Este e-mail já está cadastrado.",
      INVALID_EMAIL: "E-mail inválido.",
      WEAK_PASSWORD: "A senha deve ter pelo menos 6 caracteres.",
    };
    throw new Error(msgMap[err.error?.message] ?? "Erro ao criar usuário.");
  }
  const { localId: uid } = await res.json();
  const ref = doc(db, COLLECTION, uid);
  // Every account gets a referral link, regardless of role.
  const referralCode = generateReferralCode();
  const profile = {
    uid,
    email,
    displayName,
    phone,
    role,
    loyaltyPoints: role === "customer" ? 100 : 0,
    referralCode,
    addresses: [],
    // Comissão só para vendedor e quando informada (Firestore rejeita undefined).
    ...(role === "seller" && commissionRate != null ? { commissionRate } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  if (referralCode) await registerReferralCode(uid, referralCode);
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as UserProfile;
}
