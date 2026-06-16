"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  MessageCircle, MapPin, Phone, Clock, Anchor,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* Glifo do Instagram (lucide desta versão não exporta o ícone). */
function InstagramGlyph({ className = "" }: { className?: string }) {
  return <span className={`text-base font-bold leading-none ${className}`}>IG</span>;
}

/* ── Contato da loja ─────────────────────────────────────── */
const STORE_WHATSAPP = "558399020606"; // somente dígitos, com DDI
const WA_LINK = `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(
  "Olá, vim pelo site da Shark Smokehouse! Gostaria de mais informações.",
)}`;

/* ── Animation helper ────────────────────────────────────── */
function FadeIn({
  children,
  delay = 0,
  className = "",
  y = 24,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Canais de contato ───────────────────────────────────── */
const channels = [
  {
    icon: Phone,
    label: "Telefone",
    value: "(83) 9902-0606",
    href: "tel:+558399020606",
    color: "text-[var(--color-neon-blue)]",
    bg: "bg-[var(--color-neon-blue-glow)]",
    border: "border-[var(--color-neon-blue)]/20",
  },
  {
    icon: InstagramGlyph,
    label: "Instagram",
    value: "@shark_smokehouse_",
    href: "https://www.instagram.com/shark_smokehouse_",
    color: "text-[var(--color-accent-pink)]",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
  },
];

const hours = [
  { day: "Segunda-feira", value: "Fechado", closed: true },
  { day: "Terça a Quinta", value: "14h às 00h", closed: false },
  { day: "Sexta-feira", value: "14h às 02h", closed: false },
  { day: "Sábado", value: "12h às 02h", closed: false },
  { day: "Domingo", value: "12h às 23h", closed: false },
];

/* ── Página ──────────────────────────────────────────────── */
export default function ContactPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-neon-blue)] opacity-[0.04] blur-[120px]" />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-eyebrow text-[var(--color-neon-blue)] mb-5"
          >
            <Anchor className="w-3 h-3 inline mr-1.5 align-middle" />
            Fale Conosco
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-headline text-[var(--color-text-primary)] mb-5"
          >
            A gente responde{" "}
            <span className="italic text-neon">na hora.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto leading-relaxed font-light mb-8"
          >
            Tem dúvida, quer fazer um pedido ou só bater um papo? Chama a gente no WhatsApp. 💬🦈
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            <Button variant="premium" size="lg" asChild>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5" />
                Conversar no WhatsApp
              </a>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* ── CANAIS ───────────────────────────────────────── */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-3 gap-4">
          {channels.map((c, i) => {
            const Icon = c.icon;
            return (
              <FadeIn key={c.label} delay={i * 0.1}>
                <a
                  href={c.href}
                  target={c.href.startsWith("http") ? "_blank" : undefined}
                  rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className={`rounded-2xl border p-6 flex flex-col items-center text-center gap-3 h-full transition-all hover:scale-[1.03] ${c.bg} ${c.border}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 ${c.color}`} />
                  </div>
                  <h3 className={`font-bold ${c.color}`}>{c.label}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] break-all">{c.value}</p>
                </a>
              </FadeIn>
            );
          })}
        </div>
      </section>

      {/* ── ENDEREÇO + HORÁRIO ───────────────────────────── */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-6 items-stretch">
          {/* Endereço + mapa */}
          <FadeIn delay={0.1} className="flex flex-col gap-4">
            <div className="glass rounded-2xl border border-[var(--color-border)] overflow-hidden h-full min-h-[220px] relative">
              <iframe
                title="Shark Smokehouse — Localização"
                src="https://www.google.com/maps?q=-7.1690894,-34.8423557&z=16&output=embed"
                width="100%"
                height="100%"
                style={{ border: 0, filter: "invert(90%) hue-rotate(180deg)", minHeight: "220px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="absolute inset-0 w-full h-full"
              />
            </div>
            <div className="glass rounded-2xl border border-[var(--color-border)] p-6 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-[var(--color-neon-blue)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Endereço</p>
                <a
                  href="https://maps.app.goo.gl/P8ZJh4wtXAMu73et5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-[var(--color-text-secondary)] mt-1 leading-relaxed hover:text-[var(--color-neon-blue)] transition-colors"
                >
                  Avenida Alfredo Ferreira da Rocha, 742<br />
                  Mangabeira I — João Pessoa, PB<br />
                  CEP: 58055-540
                </a>
              </div>
            </div>
          </FadeIn>

          {/* Horários */}
          <FadeIn delay={0.2} className="flex flex-col gap-4">
            <div className="glass rounded-2xl border border-[var(--color-border)] p-6 flex-1">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5 text-[var(--color-neon-blue)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Horário de Funcionamento</p>
              </div>
              <div className="space-y-3">
                {hours.map((h) => (
                  <div key={h.day} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">{h.day}</span>
                    <span className={h.closed ? "text-[var(--color-error)] font-medium" : "text-[var(--color-text-primary)] font-medium"}>
                      {h.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="premium" size="lg" className="w-full" asChild>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5" />
                Conversar no WhatsApp
              </a>
            </Button>
          </FadeIn>
        </div>
      </section>

      {/* ── BOTTOM BAR ───────────────────────────────────── */}
      <div className="py-6 px-4 border-t border-[var(--color-border)] bg-[var(--color-bg-base)] mt-8">
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          ⚠️&nbsp; Venda e consumo proibidos para menores de 18 anos. Fumar faz mal à saúde.
        </p>
      </div>

    </div>
  );
}
