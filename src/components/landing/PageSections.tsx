"use client";

import { useEffect, useState } from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { LoungeSection } from "@/components/landing/LoungeSection";
import { LoyaltySection } from "@/components/landing/LoyaltySection";
import { EventsSection } from "@/components/landing/EventsSection";
import { getSiteSettings } from "@/lib/firebase/settings";
import type { SiteSettings } from "@/types";

const DEFAULT: SiteSettings["sections"] = {
  hero: true,
  featuredProducts: true,
  lounge: true,
  loyalty: true,
  events: true,
};

export function PageSections() {
  const [sections, setSections] = useState<SiteSettings["sections"]>(DEFAULT);

  useEffect(() => {
    getSiteSettings().then((s) => setSections(s.sections));
  }, []);

  return (
    <>
      {sections.hero && <HeroSection />}
      {sections.featuredProducts && <FeaturedProducts />}
      {sections.lounge && <LoungeSection />}
      {sections.events && <EventsSection />}
      {sections.loyalty && <LoyaltySection />}
    </>
  );
}
