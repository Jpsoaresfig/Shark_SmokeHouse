"use client";

import { motion } from "framer-motion";
import { Clock, MapPin, MessageCircle } from "lucide-react";
import { useSiteVitrine } from "@/stores/siteSettingsStore";

const MAPS_URL = "https://maps.app.goo.gl/P8ZJh4wtXAMu73et5";
const WHATSAPP_URL = "https://wa.me/5583999020606";

/**
 * Bloco institucional da vitrine (página inicial): texto da casa, endereço,
 * telefone e horários. Todo o conteúdo é editável pelo admin em Site & Vitrine
 * e cai no padrão da casa quando não configurado.
 */
export function VitrineInfo() {
  const vitrine = useSiteVitrine();
  const hourLines = vitrine.hours
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-1 md:grid-cols-3 gap-px border border-[var(--color-border)] bg-[var(--color-border)] overflow-hidden"
        >
          {/* Sobre */}
          <div className="bg-[var(--color-bg-elevated)] p-7 md:col-span-1">
            <p className="text-eyebrow text-[var(--color-neon-blue)] mb-4">Sobre Nós</p>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed font-light">
              {vitrine.about}
            </p>
          </div>

          {/* Visite a loja */}
          <div className="bg-[var(--color-bg-elevated)] p-7">
            <p className="text-eyebrow text-[var(--color-neon-blue)] mb-4">Visite a Loja</p>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] transition-colors leading-relaxed"
            >
              <MapPin className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0 mt-0.5" />
              <span>{vitrine.address}</span>
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-success)] transition-colors mt-3"
            >
              <MessageCircle className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
              <span>{vitrine.phone}</span>
            </a>
          </div>

          {/* Horários */}
          <div className="bg-[var(--color-bg-elevated)] p-7">
            <p className="text-eyebrow text-[var(--color-neon-blue)] mb-4">Horários</p>
            <ul className="space-y-1.5">
              {hourLines.map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)] leading-relaxed"
                >
                  <Clock className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0 mt-0.5" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
