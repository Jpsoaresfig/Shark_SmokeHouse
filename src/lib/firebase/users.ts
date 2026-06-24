import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, serverTimestamp,
  collection, getDocs, query, orderBy, limit, addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateReferralCode, registerReferralCode } from "./loyalty";
import { WELCOME_BONUS_POINTS } from "@/lib/loyalty/levels";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { cached, invalidate } from "@/lib/firebase/cache";
import { isOfLegalAge, legalAgeDate } from "@/lib/age";
import type { UserProfile, UserRole } from "@/types";

const COLLECTION = "users";
const ADMIN_EMAIL = "admin@shark.com";

export async function createUserProfile(
  uid: string,
  data: { email: string; displayName: string; phone?: string; birthDate?: string; cpf?: string }
): Promise<UserProfile> {
  const ref = doc(db, COLLECTION, uid);
  const isAdmin = data.email === ADMIN_EMAIL;
  // CPF é opcional, mas se vier deve ser válido (gate do Clube Shark).
  const cpf = data.cpf ? onlyDigits(data.cpf) : "";
  if (cpf && !isValidCpf(cpf)) throw new Error("CPF inválido.");
  // Every account gets a referral link, regardless of role.
  const referralCode = generateReferralCode();
  // Menor de idade: conta criada, mas bloqueada até completar 18 anos.
  const blockedUntil =
    data.birthDate && !isOfLegalAge(data.birthDate) ? legalAgeDate(data.birthDate) : undefined;
  const profile: Omit<UserProfile, "updatedAt"> & { createdAt: unknown; updatedAt: unknown } = {
    uid,
    email: data.email,
    displayName: data.displayName,
    phone: data.phone ?? "",
    role: (isAdmin ? "admin" : "customer") as UserRole,
    loyaltyPoints: isAdmin ? 0 : WELCOME_BONUS_POINTS,
    referralCode,
    addresses: [],
    ...(cpf ? { cpf } : {}),
    ...(data.birthDate ? { birthDate: data.birthDate } : {}),
    ...(blockedUntil ? { blockedUntil } : {}),
    createdAt: serverTimestamp() as unknown as string,
    updatedAt: serverTimestamp() as unknown as string,
  };
  await setDoc(ref, profile);
  if (referralCode) await registerReferralCode(uid, referralCode);
  // Lança o bônus de boas-vindas no ledger (não-admin) para que a validade de
  // 180 dias seja rastreável por lote — o saldo inicial já reflete esses pontos.
  if (!isAdmin && WELCOME_BONUS_POINTS > 0) {
    await addDoc(collection(db, "loyaltyTransactions"), {
      userId: uid,
      type: "welcome",
      points: WELCOME_BONUS_POINTS,
      reason: "Bônus de boas-vindas",
      createdAt: serverTimestamp(),
    });
  }
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

/**
 * Cria um cliente de balcão (walk-in) direto do PDV: apenas um registro em
 * `users` (sem conta de acesso / Firebase Auth) para vincular à venda, aparecer
 * na busca de clientes e no controle de "A Receber". Nome e telefone são
 * obrigatórios; e-mail e CPF são opcionais. Como não há login, não geramos
 * código de indicação nem bônus de boas-vindas.
 */
export async function createWalkInCustomer(data: {
  displayName: string;
  phone: string;
  email?: string;
  cpf?: string;
}): Promise<UserProfile> {
  const displayName = data.displayName.trim();
  const phone = (data.phone ?? "").trim();
  if (!displayName) throw new Error("Informe o nome do cliente.");
  if (!phone) throw new Error("Informe o telefone do cliente.");
  // CPF opcional, mas se vier deve ser válido (gate do Clube Shark).
  const cpf = data.cpf ? onlyDigits(data.cpf) : "";
  if (cpf && !isValidCpf(cpf)) throw new Error("CPF inválido.");
  // doc() sem id gera um id automático; usamos o próprio id como uid do perfil.
  const ref = doc(collection(db, COLLECTION));
  const profile = {
    uid: ref.id,
    email: (data.email ?? "").trim(),
    displayName,
    phone,
    role: "customer" as UserRole,
    loyaltyPoints: 0,
    addresses: [],
    ...(cpf ? { cpf } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  invalidate("users");
  return {
    ...profile,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as UserProfile;
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
  data: Partial<Pick<UserProfile, "displayName" | "phone" | "photoURL" | "addresses" | "cpf">>
): Promise<void> {
  const payload = { ...data };
  // CPF é opcional, mas se vier deve ser válido e é gravado só com dígitos.
  if (payload.cpf !== undefined) {
    const cpf = onlyDigits(payload.cpf);
    if (cpf && !isValidCpf(cpf)) throw new Error("CPF inválido.");
    payload.cpf = cpf;
  }
  await updateDoc(doc(db, COLLECTION, uid), {
    ...payload,
    updatedAt: serverTimestamp(),
  });
}

export async function getAllUsers(limitCount?: number, force = false): Promise<UserProfile[]> {
  return cached(`users:${limitCount ?? "all"}`, async () => {
    const q = limitCount
      ? query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(limitCount))
      : query(collection(db, COLLECTION), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserProfile);
  }, force);
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { role, updatedAt: serverTimestamp() });
  invalidate("users");
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
  invalidate("users");
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid));
  invalidate("users");
}

export async function createUserWithRole(
  email: string,
  password: string,
  displayName: string,
  phone: string,
  role: UserRole,
  commissionRate?: number,
  cpf?: string,
): Promise<UserProfile> {
  // CPF é opcional, mas se vier deve ser válido (gate do Clube Shark).
  const cpfDigits = cpf ? onlyDigits(cpf) : "";
  if (cpfDigits && !isValidCpf(cpfDigits)) throw new Error("CPF inválido.");
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
    // CPF só quando informado e válido.
    ...(cpfDigits ? { cpf: cpfDigits } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  if (referralCode) await registerReferralCode(uid, referralCode);
  invalidate("users");
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as UserProfile;
}
