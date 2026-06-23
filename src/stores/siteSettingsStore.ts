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

const DEFAULT_CART: SiteSettings["cart"] = {
  freeShippingEnabled: true,
  freeShippingThreshold: 150,
};

const DEFAULT_PROMO: SiteSettings["promoPopup"] = {
  enabled: false,
  title: "",
  message: "",
  imageUrl: "",
  ctaLabel: "Quero aproveitar",
  linkUrl: "/catalog",
};

interface SiteSettingsStore {
  sections: SiteSettings["sections"];
  payment: SiteSettings["payment"];
  cart: SiteSettings["cart"];
  promoPopup: SiteSettings["promoPopup"];
  loaded: boolean;
  load: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useSiteSettingsStore = create<SiteSettingsStore>((set) => ({
  sections: DEFAULT,
  payment: DEFAULT_PAYMENT,
  cart: DEFAULT_CART,
  promoPopup: DEFAULT_PROMO,
  loaded: false,
  load: async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const s = await getSiteSettings();
        set({ sections: s.sections, payment: s.payment, cart: s.cart, promoPopup: s.promoPopup, loaded: true });
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

/** Loads the site settings once and exposes the live `cart` config (frete grátis). */
export function useSiteCart() {
  const cart = useSiteSettingsStore((s) => s.cart);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return cart;
}

/** Loads the site settings once and exposes the live `promoPopup` config. */
export function usePromoPopup() {
  const promoPopup = useSiteSettingsStore((s) => s.promoPopup);
  const loaded = useSiteSettingsStore((s) => s.loaded);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return { promoPopup, loaded };
}
