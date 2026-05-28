import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SiteSettings } from "@/types";

const DOC = doc(db, "settings", "site");

const DEFAULT_SETTINGS: SiteSettings = {
  sections: {
    hero: true,
    featuredProducts: true,
    lounge: true,
    events: true,
    loyalty: true,
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
      loyalty: data.sections?.loyalty ?? true,
    },
  };
}

export async function updateSiteSettings(settings: SiteSettings): Promise<void> {
  await setDoc(DOC, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
}
