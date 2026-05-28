"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import {
  loginWithEmail,
  loginWithGoogle,
  registerWithEmail,
  logout as firebaseLogout,
  sendResetEmail,
} from "@/lib/firebase/auth";

export interface AuthError {
  message: string;
  code?: string;
}

function parseFirebaseError(error: unknown): AuthError {
  const e = error as { code?: string };
  const map: Record<string, string> = {
    "auth/user-not-found": "E-mail não encontrado.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/invalid-email": "E-mail inválido.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos.",
    "auth/popup-closed-by-user": "Login com Google cancelado.",
    "auth/network-request-failed": "Erro de conexão. Verifique sua internet.",
  };
  return {
    message: map[e.code ?? ""] ?? "Ocorreu um erro inesperado. Tente novamente.",
    code: e.code,
  };
}

export function useAuth() {
  const { user, loading, setUser } = useAuthStore();
  const router = useRouter();

  async function login(email: string, password: string) {
    try {
      const profile = await loginWithEmail(email, password);
      setUser(profile);
      redirectByRole(profile.role, router);
    } catch (err) {
      throw parseFirebaseError(err);
    }
  }

  async function loginGoogle() {
    try {
      const profile = await loginWithGoogle();
      setUser(profile);
      redirectByRole(profile.role, router);
    } catch (err) {
      throw parseFirebaseError(err);
    }
  }

  async function register(
    email: string,
    password: string,
    displayName: string,
    phone?: string,
    referralCode?: string
  ) {
    try {
      const profile = await registerWithEmail(email, password, displayName, phone, referralCode);
      setUser(profile);
      router.push("/");
    } catch (err) {
      throw parseFirebaseError(err);
    }
  }

  async function logout() {
    await firebaseLogout();
    setUser(null);
    router.push("/");
  }

  async function resetPassword(email: string) {
    try {
      await sendResetEmail(email);
    } catch (err) {
      throw parseFirebaseError(err);
    }
  }

  return { user, loading, login, loginGoogle, register, logout, resetPassword };
}

function redirectByRole(role: string, router: ReturnType<typeof useRouter>) {
  if (role === "admin") router.push("/admin");
  else if (role === "motoboy") router.push("/motoboy");
  else router.push("/");
}
