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

/** WhatsApp oficial usado quando o admin ainda não preencheu o telefone. */
const FALLBACK_STORE_WHATSAPP = "5583999020606";

/** Só dígitos com DDI 55 (ou "" se o texto não formar um telefone BR). */
function storePhoneDigits(phone: string): string {
  let d = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length === 12 || d.length === 13 ? d : "";
}

/** Contato da loja vindo de Site & Vitrine (editável no admin), com fallback
 *  para o número oficial — evita telefone fixo espalhado pelo código. */
export function useStoreContact() {
  const vitrine = useSiteVitrine();
  const digits = storePhoneDigits(vitrine.phone) || FALLBACK_STORE_WHATSAPP;
  const display = vitrine.phone?.trim() || "(83) 99902-0606";
  return {
    digits,
    display,
    tel: `tel:+${digits}`,
    waLink: (message?: string) =>
      `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`,
  };
}

/** Linhas de horário ("Dia: horário") do texto livre de Site & Vitrine. */
export function parseHourLines(text: string): { day: string; value: string; closed: boolean }[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf(":");
      // "Ter – Sex: 13h às 21h" → dia + horário; sem ":" → linha inteira no valor.
      const day = i > 0 ? line.slice(0, i).trim() : "";
      const value = i > 0 ? line.slice(i + 1).trim() : line;
      return { day, value, closed: /fechad/i.test(value) };
    });
}
