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
import { minorBlock, formatBrDate, LEGAL_AGE } from "@/lib/age";
import type { UserProfile } from "@/types";

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
    "auth/cancelled-popup-request": "Login com Google cancelado.",
    "auth/popup-blocked": "O navegador bloqueou a janela de login. Permita pop-ups e tente de novo.",
    "auth/unauthorized-domain": "Este domínio não está autorizado para login. Avise o administrador.",
    "auth/operation-not-allowed": "Login com Google não está habilitado neste projeto.",
    "auth/network-request-failed": "Erro de conexão. Verifique sua internet.",
  };
  // Loga o código bruto para facilitar diagnóstico em produção.
  if (!e.code || !(e.code in map)) {
    console.error("Erro de autenticação não mapeado:", error);
  }
  return {
    message: map[e.code ?? ""] ?? "Ocorreu um erro inesperado. Tente novamente.",
    code: e.code,
  };
}

export function useAuth() {
  const { user, loading, setUser } = useAuthStore();
  const router = useRouter();

  /** Bloqueia o acesso de menores; desloga e lança erro com a data de liberação. */
  async function enforceAgeOrThrow(profile: UserProfile) {
    const block = minorBlock(profile);
    if (block.blocked) {
      await firebaseLogout();
      setUser(null);
      throw {
        message: `É necessário ter ${LEGAL_AGE} anos para usar a Shark. Sua conta será liberada em ${formatBrDate(block.until!)}.`,
        code: "age/minor",
      } as AuthError;
    }
  }

  async function login(email: string, password: string) {
    let profile: UserProfile;
    try {
      profile = await loginWithEmail(email, password);
    } catch (err) {
      throw parseFirebaseError(err);
    }
    await enforceAgeOrThrow(profile);
    setUser(profile);
    redirectByRole(profile.role, router);
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
    referralCode?: string,
    birthDate?: string,
    cpf?: string
  ) {
    let profile: UserProfile;
    try {
      profile = await registerWithEmail(email, password, displayName, phone, referralCode, birthDate, cpf);
    } catch (err) {
      throw parseFirebaseError(err);
    }
    // Conta criada; se for menor, bloqueia (com a data de liberação) e desloga.
    await enforceAgeOrThrow(profile);
    setUser(profile);
    router.push("/");
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
      // sendResetEmail já retorna uma mensagem amigável vinda da API.
      const message = err instanceof Error ? err.message : "Não foi possível enviar o e-mail.";
      throw { message } as AuthError;
    }
  }

  return { user, loading, login, loginGoogle, register, logout, resetPassword };
}

function redirectByRole(role: string, router: ReturnType<typeof useRouter>) {
  if (role === "admin") router.push("/admin");
  else if (role === "motoboy") router.push("/motoboy");
  else router.push("/");
}
