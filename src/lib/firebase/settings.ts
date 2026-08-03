import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_INSTALLMENT_FEES } from "@/lib/payments/installments";
import type { SiteSettings, BusinessHours } from "@/types";

/** Horários padrão de reserva do lounge (usados enquanto o admin não configura).
 *  Exportado para o admin e o site usarem o mesmo fallback. */
export const DEFAULT_LOUNGE_TIME_SLOTS = [
  "14:00", "15:00", "16:00", "17:00", "18:00",
  "19:00", "20:00", "21:00", "22:00", "23:00",
];

const DOC = doc(db, "settings", "site");

const DEFAULT_SETTINGS: SiteSettings = {
  sections: {
    hero: true,
    featuredProducts: true,
    lounge: true,
    events: true,
  },
  lounge: {
    timeSlots: DEFAULT_LOUNGE_TIME_SLOTS,
  },
  payment: {
    pixKey: "",
    pixName: "Shark Smokehouse",
    pixQrPayload: "",
    creditFeePercent: 0,
    debitFeePercent: 0,
    creditInstallmentFees: DEFAULT_INSTALLMENT_FEES,
  },
  cart: {
    freeShippingEnabled: true,
    freeShippingThreshold: 150,
  },
  promoPopup: {
    enabled: false,
    title: "",
    message: "",
    imageUrl: "",
    ctaLabel: "Quero aproveitar",
    linkUrl: "/catalog",
  },
  businessHours: {
    enabled: false,
    days: [null, null, null, null, null, null, null],
    closedMessage: "",
  },
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const snap = await getDoc(DOC);
  if (!snap.exists()) return DEFAULT_SETTINGS;
  const data = snap.data();
  return {
    sections: {
      hero: data.sections?.hero ?? true,
      featuredProducts: data.sections?.featuredProducts ?? true,
      lounge: data.sections?.lounge ?? true,
      events: data.sections?.events ?? true,
    },
    lounge: {
      timeSlots:
        Array.isArray(data.lounge?.timeSlots) && data.lounge.timeSlots.length > 0
          ? data.lounge.timeSlots
          : DEFAULT_LOUNGE_TIME_SLOTS,
    },
    payment: {
      pixKey: data.payment?.pixKey ?? DEFAULT_SETTINGS.payment.pixKey,
      pixName: data.payment?.pixName ?? DEFAULT_SETTINGS.payment.pixName,
      pixQrPayload: data.payment?.pixQrPayload ?? "",
      creditFeePercent: data.payment?.creditFeePercent ?? 0,
      debitFeePercent: data.payment?.debitFeePercent ?? 0,
      creditInstallmentFees:
        data.payment?.creditInstallmentFees ?? DEFAULT_INSTALLMENT_FEES,
    },
    cart: {
      freeShippingEnabled:
        data.cart?.freeShippingEnabled ?? DEFAULT_SETTINGS.cart.freeShippingEnabled,
      freeShippingThreshold:
        data.cart?.freeShippingThreshold ?? DEFAULT_SETTINGS.cart.freeShippingThreshold,
    },
    promoPopup: {
      enabled: data.promoPopup?.enabled ?? DEFAULT_SETTINGS.promoPopup.enabled,
      title: data.promoPopup?.title ?? "",
      message: data.promoPopup?.message ?? "",
      imageUrl: data.promoPopup?.imageUrl ?? "",
      ctaLabel: data.promoPopup?.ctaLabel ?? DEFAULT_SETTINGS.promoPopup.ctaLabel,
      linkUrl: data.promoPopup?.linkUrl ?? DEFAULT_SETTINGS.promoPopup.linkUrl,
    },
    businessHours: {
      enabled: data.businessHours?.enabled ?? false,
      days: normalizeBusinessDays(data.businessHours?.days),
      closedMessage: data.businessHours?.closedMessage ?? "",
    },
  };
}

/** Normaliza o array de horários para 7 posições (0 = domingo, 6 = sábado),
 *  mantendo apenas dias com horário válido (HH:MM). */
function normalizeBusinessDays(days?: unknown): BusinessHours["days"] {
  const out: BusinessHours["days"] = [null, null, null, null, null, null, null];
  if (!Array.isArray(days)) return out;
  days.slice(0, 7).forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const d = raw as { open?: unknown; close?: unknown };
    const open = typeof d.open === "string" ? d.open : "";
    const close = typeof d.close === "string" ? d.close : "";
    if (/^\d{2}:\d{2}$/.test(open) && /^\d{2}:\d{2}$/.test(close)) {
      out[i] = { open, close };
    }
  });
  return out;
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  await setDoc(DOC, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}
