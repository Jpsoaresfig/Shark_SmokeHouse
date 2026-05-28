import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  collection, getDocs, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/types";

const COLLECTION = "users";
const ADMIN_EMAIL = "admin@shark.com";

export async function createUserProfile(
  uid: string,
  data: { email: string; displayName: string; phone?: string }
): Promise<UserProfile> {
  const ref = doc(db, COLLECTION, uid);
  const isAdmin = data.email === ADMIN_EMAIL;
  const profile: Omit<UserProfile, "updatedAt"> & { createdAt: unknown; updatedAt: unknown } = {
    uid,
    email: data.email,
    displayName: data.displayName,
    phone: data.phone ?? "",
    role: (isAdmin ? "admin" : "customer") as UserRole,
    loyaltyPoints: isAdmin ? 0 : 100,
    addresses: [],
    createdAt: serverTimestamp() as unknown as string,
    updatedAt: serverTimestamp() as unknown as string,
  };
  await setDoc(ref, profile);
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
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

export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, COLLECTION), orderBy("createdAt", "desc")));
  return snap.docs.map(d => d.data() as UserProfile);
}

export async function updateUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, COLLECTION, uid), { role, updatedAt: serverTimestamp() });
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, uid));
}

export async function createUserWithRole(
  email: string,
  password: string,
  displayName: string,
  phone: string,
  role: UserRole
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
  const profile = {
    uid,
    email,
    displayName,
    phone,
    role,
    loyaltyPoints: role === "customer" ? 100 : 0,
    addresses: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, profile);
  return { ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as UserProfile;
}
