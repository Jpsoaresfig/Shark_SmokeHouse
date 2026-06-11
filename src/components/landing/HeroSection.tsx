"use client";

import { motion } from "framer-motion";
import { ArrowRight, Flame, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { useSiteSections } from "@/stores/siteSettingsStore";

const featuresData = [
  { title: "Catálogo Completo",      desc: "Tudo o que você procura em um só lugar" },
  { title: "Produtos Selecionados",  desc: "Qualidade e variedade para sua melhor experiência" },
  { title: "Compra Rápida",          desc: "Encontre o que procura em poucos cliques" },
  { title: "Atendimento Humanizado", desc: "Suporte rápido quando você precisar" },
];

export function HeroSection() {
  const sections = useSiteSections();
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#08080f] via-[#0a0f1e] to-[#08080f]" />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(0,149,255,0.07) 0%, transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(201,191,255,0.04) 0%, transparent 70%)" }}
      />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(var(--color-neon-blue) 1px, transparent 1px), linear-gradient(90deg, var(--color-neon-blue) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Floating accent */}
      <div className="animate-float absolute top-24 right-16 w-16 h-16 border border-[var(--color-neon-blue)]/15 bg-[var(--color-neon-blue)]/5 hidden lg:flex items-center justify-center">
        <Flame className="w-6 h-6 text-[var(--color-neon-blue)]/40" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-8 pt-28 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex justify-center mb-10">
            <Logo variant="black" size="xl" asLink={false} />
          </div>

          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-eyebrow text-[var(--color-neon-blue)] mb-6"
          >
            Tabacaria Premium — João Pessoa, PB
          </motion.p>

          {/* Display headline — Bodoni Moda serif */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-display text-[var(--color-text-primary)] mb-4"
          >
            Eleve sua
            <span
              className="block italic"
              style={{
                background: "linear-gradient(135deg, #0095ff, #c9bfff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Experiência.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto mb-10 leading-relaxed font-light"
          >
            Uma seleção especial de produtos para transformar qualquer ocasião
            em uma experiência memorável.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Button variant="premium" size="xl" asChild>
              <Link href="/catalog">
                Explorar Catálogo
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            {sections.lounge && (
              <Button variant="outline" size="xl" asChild>
                <Link href="/lounge">
                  <Play className="w-4 h-4" />
                  Agendar Lounge
                </Link>
              </Button>
            )}
          </motion.div>

          {/* Features row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-px border border-[var(--color-border)] bg-[var(--color-border)] max-w-4xl mx-auto overflow-hidden"
          >
            {featuresData.map((feature) => (
              <div
                key={feature.title}
                className="bg-[var(--color-bg-elevated)] px-5 py-5 text-center"
              >
                <p className="text-sm font-bold text-[var(--color-neon-blue)] mb-1 font-display">
                  {feature.title}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--color-bg-base)] to-transparent" />
    </section>
  );
}
