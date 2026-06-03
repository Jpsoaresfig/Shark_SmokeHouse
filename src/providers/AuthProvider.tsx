"use client";

import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { resolveUserProfile, logout as firebaseLogout } from "@/lib/firebase/auth";
import { minorBlock } from "@/lib/age";
import { useAuthStore } from "@/stores/authStore";
import type { UserProfile } from "@/types";

function refreshSessionCookie(uid: string) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `shark_session=${uid}; path=/; expires=${expires}; SameSite=Lax`;
}

const CACHE_KEY = "shark_auth_profile";

function readCache(): UserProfile | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(CACHE_KEY) : null;
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch { return null; }
}

export function writeCache(profile: UserProfile | null) {
  try {
    if (!profile) localStorage.removeItem(CACHE_KEY);
    else localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading, setFirebaseReady } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    // Step 1 — instantly hydrate from cache so UI never shows loading on return visits
    // (exceto contas de menores bloqueadas — nunca hidrata uma sessão bloqueada).
    const cached = readCache();
    if (cached && !minorBlock(cached).blocked) {
      setUser(cached);
      setLoading(false);
    }

    // Step 2 — wait for Firebase to finish reading its IndexedDB persistence BEFORE
    // subscribing to auth state changes. This prevents onAuthStateChanged from firing
    // null before the persisted user is loaded, which was causing false logouts on
    // browser back navigation.
    auth.authStateReady().then(() => {
      if (!mounted) return;

      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (!mounted) return;

        // Firebase Auth has fully resolved — Firestore queries are now safe
        setFirebaseReady(true);

        // Aplica o perfil, mas desloga contas de menores ainda bloqueadas.
        const applyProfile = async (profile: UserProfile | null) => {
          if (profile && minorBlock(profile).blocked) {
            await firebaseLogout();
            if (!mounted) return;
            setUser(null);
            writeCache(null);
            return;
          }
          setUser(profile);
          writeCache(profile);
        };

        if (firebaseUser) {
          // Renew session cookie on every confirmed auth — keeps proxy happy
          refreshSessionCookie(firebaseUser.uid);

          if (cached?.uid === firebaseUser.uid) {
            // Cache matched — UI is already showing the right user, just refresh in bg
            setLoading(false);
            resolveUserProfile(firebaseUser).then(profile => {
              if (!mounted || !profile) return;
              applyProfile(profile);
            });
          } else {
            // Different user (or no cache) — must fetch Firestore profile
            const profile = await resolveUserProfile(firebaseUser);
            if (!mounted) return;
            await applyProfile(profile);
            setLoading(false);
          }
        } else {
          // Firebase confirmed: no authenticated user (definitive after authStateReady)
          setUser(null);
          writeCache(null);
          setLoading(false);
        }
      });
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
