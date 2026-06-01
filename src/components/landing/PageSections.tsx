"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { StoreProducts } from "@/components/landing/StoreProducts";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { LoungeSection } from "@/components/landing/LoungeSection";
import { EventsSection } from "@/components/landing/EventsSection";
import { useSiteSections } from "@/stores/siteSettingsStore";

export function PageSections() {
  const sections = useSiteSections();

  return (
    <>
      {sections.hero && <HeroSection />}
      <StoreProducts />
      {sections.featuredProducts && <FeaturedProducts />}
      {sections.events && <EventsSection />}
      {sections.lounge && <LoungeSection />}
    </>
  );
}
