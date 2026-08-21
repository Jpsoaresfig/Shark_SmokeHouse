"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { VitrineInfo } from "@/components/landing/VitrineInfo";
import { StoreProducts } from "@/components/landing/StoreProducts";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { LoungeSection } from "@/components/landing/LoungeSection";
import { EventsSection } from "@/components/landing/EventsSection";
import { BusinessHoursBanner } from "@/components/landing/BusinessHoursBanner";
import { useSiteSections } from "@/stores/siteSettingsStore";

export function PageSections() {
  const sections = useSiteSections();

  return (
    <>
      <BusinessHoursBanner />
      {sections.hero && <HeroSection />}
      {/* Sobre a casa + endereço, telefone e horários (editáveis em Site & Vitrine). */}
      <VitrineInfo />
      {/* Destaque primeiro (vitrine comercial), depois o catálogo completo. */}
      {sections.featuredProducts && <FeaturedProducts />}
      <StoreProducts />
      {sections.events && <EventsSection />}
      {sections.lounge && <LoungeSection />}
    </>
  );
}
