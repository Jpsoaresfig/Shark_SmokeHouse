import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_INSTALLMENT_FEES } from "@/lib/payments/installments";
import type { SiteSettings } from "@/types";

const DOC = doc(db, "settings", "site");

const DEFAULT_SETTINGS: SiteSettings = {
  sections: {
    hero: true,
    featuredProducts: true,
    lounge: true,
    events: true,
  },
  payment: {
    pixKey: "",
    pixName: "Shark Smokehouse",
    pixQrPayload: "",
    creditFeePercent: 0,
    debitFeePercent: 0,
    creditInstallmentFees: DEFAULT_INSTALLMENT_FEES,
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
    payment: {
      pixKey: data.payment?.pixKey ?? DEFAULT_SETTINGS.payment.pixKey,
      pixName: data.payment?.pixName ?? DEFAULT_SETTINGS.payment.pixName,
      pixQrPayload: data.payment?.pixQrPayload ?? "",
      creditFeePercent: data.payment?.creditFeePercent ?? 0,
      debitFeePercent: data.payment?.debitFeePercent ?? 0,
      creditInstallmentFees:
        data.payment?.creditInstallmentFees ?? DEFAULT_INSTALLMENT_FEES,
    },
  };
}

export async function updateSiteSettings(settings: Partial<SiteSettings>): Promise<void> {
  await setDoc(DOC, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}
