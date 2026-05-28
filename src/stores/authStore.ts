"use client";

import { create } from "zustand";
import type { UserProfile } from "@/types";

interface AuthStore {
  user: UserProfile | null;
  loading: boolean;
  /** True only after Firebase Auth has confirmed the session via onAuthStateChanged.
   *  Use this to gate Firestore queries — the user may be in the store from
   *  localStorage cache before the Firebase Auth token is actually active. */
  firebaseReady: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setFirebaseReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  firebaseReady: false,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setFirebaseReady: (firebaseReady) => set({ firebaseReady }),
}));
