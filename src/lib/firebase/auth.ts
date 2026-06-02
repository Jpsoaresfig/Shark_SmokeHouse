import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createUserProfile, getUserProfile, ensureReferralCode } from "./users";
import { processReferral } from "./loyalty";
import type { UserProfile } from "@/types";

const ADMIN_EMAIL = "admin@shark.com";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
  phone?: string,
  referralCode?: string
): Promise<UserProfile> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName });
  const profile = await createUserProfile(user.uid, { email, displayName, phone });
  setSessionCookie(user.uid);
  if (referralCode) {
    // Don't block/fail registration if the referral can't be processed,
    // but surface the reason instead of swallowing it silently.
    processReferral(user.uid, referralCode).catch((err) => {
      console.error("Falha ao processar indicação:", err);
    });
  }
  return profile;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserProfile> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  let profile = await getUserProfile(user.uid);
  if (!profile) {
    profile = await createUserProfile(user.uid, {
      email: user.email!,
      displayName: user.displayName ?? (email === ADMIN_EMAIL ? "Admin" : "Usuário"),
    });
  } else if (email === ADMIN_EMAIL && profile.role !== "admin") {
    await updateDoc(doc(db, "users", user.uid), { role: "admin", updatedAt: serverTimestamp() });
    profile = { ...profile, role: "admin" };
  }
  profile = await ensureReferralCode(profile);
  setSessionCookie(user.uid);
  return profile;
}

export async function loginWithGoogle(): Promise<UserProfile> {
  const { user } = await signInWithPopup(auth, googleProvider);
  let profile = await getUserProfile(user.uid);
  if (!profile) {
    profile = await createUserProfile(user.uid, {
      email: user.email!,
      displayName: user.displayName ?? "Usuário",
    });
  } else {
    profile = await ensureReferralCode(profile);
  }
  setSessionCookie(user.uid);
  return profile;
}

export async function logout(): Promise<void> {
  await signOut(auth);
  clearSessionCookie();
}

export async function sendResetEmail(email: string): Promise<void> {
  // Usa nosso e-mail customizado (HTML da marca via Resend) em vez do template
  // padrão do Firebase. O link de redefinição é gerado no servidor (Admin SDK).
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Não foi possível enviar o e-mail de redefinição.");
  }
}

export async function resolveUserProfile(firebaseUser: User): Promise<UserProfile | null> {
  let profile = await getUserProfile(firebaseUser.uid);
  if (profile) {
    profile = await ensureReferralCode(profile);
    setSessionCookie(firebaseUser.uid);
  }
  return profile;
}

function setSessionCookie(uid: string) {
  if (typeof document === "undefined") return;
  // 30-day session, renewed on every auth resolution
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `shark_session=${uid}; path=/; expires=${expires}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "shark_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
