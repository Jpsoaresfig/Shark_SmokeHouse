"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { getSiteSettings } from "@/lib/firebase/settings";
import { DEFAULT_INSTALLMENT_FEES } from "@/lib/payments/installments";
import type { SiteSettings } from "@/types";

const DEFAULT: SiteSettings["sections"] = {
  hero: true,
  featuredProducts: true,
  lounge: true,
  events: true,
};

const DEFAULT_PAYMENT: SiteSettings["payment"] = {
  pixKey: "",
  pixName: "Shark Smokehouse",
  pixQrPayload: "",
  creditFeePercent: 0,
  debitFeePercent: 0,
  creditInstallmentFees: DEFAULT_INSTALLMENT_FEES,
};

interface SiteSettingsStore {
  sections: SiteSettings["sections"];
  payment: SiteSettings["payment"];
  loaded: boolean;
  load: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useSiteSettingsStore = create<SiteSettingsStore>((set) => ({
  sections: DEFAULT,
  payment: DEFAULT_PAYMENT,
  loaded: false,
  load: async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const s = await getSiteSettings();
        set({ sections: s.sections, payment: s.payment, loaded: true });
      } catch {
        set({ loaded: true });
      }
    })();
    return inFlight;
  },
}));

/** Loads the site settings once and exposes the live `sections` config. */
export function useSiteSections() {
  const sections = useSiteSettingsStore((s) => s.sections);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return sections;
}

/** Loads the site settings once and exposes the live `payment` config. */
export function useSitePayment() {
  const payment = useSiteSettingsStore((s) => s.payment);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return payment;
}
