import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { createUserProfile, getUserProfile } from "./users";
import type { UserProfile } from "@/types";

const ADMIN_EMAIL = "admin@shark.com";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string,
  phone?: string
): Promise<UserProfile> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(user, { displayName });
  const profile = await createUserProfile(user.uid, { email, displayName, phone });
  setSessionCookie(user.uid);
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
  }
  setSessionCookie(user.uid);
  return profile;
}

export async function logout(): Promise<void> {
  await signOut(auth);
  clearSessionCookie();
}

export async function sendResetEmail(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email, {
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`,
  });
}

export async function resolveUserProfile(firebaseUser: User): Promise<UserProfile | null> {
  const profile = await getUserProfile(firebaseUser.uid);
  if (profile) setSessionCookie(firebaseUser.uid);
  return profile;
}

function setSessionCookie(uid: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `shark_session=${uid}; path=/; expires=${expires}; SameSite=Lax`;
}

function clearSessionCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "shark_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}
