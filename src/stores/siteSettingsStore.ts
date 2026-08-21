"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { getSiteSettings, DEFAULT_VITRINE } from "@/lib/firebase/settings";
import { DEFAULT_INSTALLMENT_FEES } from "@/lib/payments/installments";
import { DEFAULT_LOUNGE_TIME_SLOTS } from "@/lib/firebase/settings";
import type { SiteSettings, VitrineContent } from "@/types";

const DEFAULT: SiteSettings["sections"] = {
  hero: true,
  featuredProducts: true,
  lounge: true,
  events: true,
};

const DEFAULT_LOUNGE: SiteSettings["lounge"] = {
  timeSlots: DEFAULT_LOUNGE_TIME_SLOTS,
  flavors: [],
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

const DEFAULT_BUSINESS_HOURS: SiteSettings["businessHours"] = {
  enabled: false,
  days: [null, null, null, null, null, null, null],
  closedMessage: "",
};

const DEFAULT_VITRINE_CONTENT: VitrineContent = DEFAULT_VITRINE;

interface SiteSettingsStore {
  sections: SiteSettings["sections"];
  lounge: SiteSettings["lounge"];
  payment: SiteSettings["payment"];
  cart: SiteSettings["cart"];
  promoPopup: SiteSettings["promoPopup"];
  businessHours: SiteSettings["businessHours"];
  vitrine: VitrineContent;
  loaded: boolean;
  load: () => Promise<void>;
}

let inFlight: Promise<void> | null = null;

export const useSiteSettingsStore = create<SiteSettingsStore>((set) => ({
  sections: DEFAULT,
  lounge: DEFAULT_LOUNGE,
  payment: DEFAULT_PAYMENT,
  cart: DEFAULT_CART,
  promoPopup: DEFAULT_PROMO,
  businessHours: DEFAULT_BUSINESS_HOURS,
  vitrine: DEFAULT_VITRINE_CONTENT,
  loaded: false,
  load: async () => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      try {
        const s = await getSiteSettings();
        set({ sections: s.sections, lounge: s.lounge, payment: s.payment, cart: s.cart, promoPopup: s.promoPopup, businessHours: s.businessHours, vitrine: s.vitrine ?? DEFAULT_VITRINE_CONTENT, loaded: true });
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

/** Loads the site settings once and exposes the live `lounge` config
 *  (horários disponíveis para reserva — editáveis na Agenda do Lounge). */
export function useSiteLounge() {
  const lounge = useSiteSettingsStore((s) => s.lounge);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return lounge;
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

/** Loads the site settings once and exposes the live `businessHours` config. */
export function useBusinessHours() {
  const businessHours = useSiteSettingsStore((s) => s.businessHours);
  const loaded = useSiteSettingsStore((s) => s.loaded);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return { businessHours, loaded };
}

/** Loads the site settings once and exposes the live `vitrine` content
 *  (texto institucional + contato da home/rodapé — editável em Site & Vitrine). */
export function useSiteVitrine(): VitrineContent {
  const vitrine = useSiteSettingsStore((s) => s.vitrine);
  const load = useSiteSettingsStore((s) => s.load);
  useEffect(() => {
    load();
  }, [load]);
  return vitrine;
}
