"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import {
  MapPin, MessageCircle, Truck, Sparkles,
  Anchor, Waves, Star, Package, Flame,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ── Animation helpers ───────────────────────────────────── */
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

/* ── Data ────────────────────────────────────────────────── */
const pillars = [
  {
    emoji: "🦈",
    title: "Atitude",
    desc: "Mais do que produtos — uma forma de viver. A Shark é postura, presença e personalidade em cada detalhe.",
    color: "border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]",
    glow: "text-[var(--color-neon-blue)]",
  },
  {
    emoji: "💎",
    title: "Curadoria",
    desc: "Seleção criteriosa de produtos importados e nacionais, escolhidos a dedo para quem entende e exige o melhor.",
    color: "border-purple-500/30 bg-purple-500/10",
    glow: "text-purple-400",
  },
  {
    emoji: "✨",
    title: "Rigor",
    desc: "Do charuto premium ao acessório, nada chega até você sem passar pelos nossos critérios de qualidade.",
    color: "border-amber-500/30 bg-amber-500/10",
    glow: "text-amber-400",
  },
];

const offerings = [
  { icon: Flame, label: "Tabacaria", desc: "Charutos, cigarros, narguilé e essências selecionadas", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  { icon: Package, label: "Headshop", desc: "Acessórios, grinders, papers, cachimbos e muito mais", color: "text-[var(--color-neon-blue)]", bg: "bg-[var(--color-neon-blue-glow)]", border: "border-[var(--color-neon-blue)]/20" },
  { icon: Sparkles, label: "Acessórios", desc: "Isqueiros, cortadores, cases e itens de colecionador", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  { icon: Truck, label: "Entrega Rápida", desc: "Pedidos pelo WhatsApp com entrega ágil em João Pessoa", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
];

const hashtags = [
  "#SharkSmokehouse", "#Tabacaria", "#Vibe",
  "#JoaoPessoa", "#Lounge", "#EstiloDeVida",
  "#SmokeShop",
];

/* ── Page ────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-4 pt-24 pb-20 overflow-hidden">
        {/* Background radial glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-neon-blue)] opacity-[0.04] blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-purple-600 opacity-[0.03] blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Eyebrow */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-eyebrow text-[var(--color-neon-blue)] mb-6"
          >
            <Anchor className="w-3 h-3 inline mr-1.5 align-middle" />
            Mangabeira — João Pessoa, PB
          </motion.p>

          {/* Display headline — Bodoni Moda */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-display text-[var(--color-text-primary)] mb-6"
          >
            Mais que uma{" "}
            <span
              className="italic"
              style={{
                background: "linear-gradient(135deg, #0095ff, #c9bfff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              tabacaria.
            </span>
            <br />
            <span className="text-[var(--color-text-secondary)]">Um novo nível.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed font-light mb-4"
          >
            Tudo o que você procura em uma tabacaria, em um só lugar. Variedade, qualidade
            e um ambiente preparado para proporcionar a melhor experiência. 💨🦈
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="text-eyebrow text-[var(--color-text-muted)] mb-10"
          >
            Atitude&nbsp;•&nbsp;Curadoria&nbsp;•&nbsp;Rigor
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button variant="premium" size="lg" asChild>
              <a
                href="https://wa.me/5583999020606?text=Ol%C3%A1%2C+vim+pelo+site+da+Shark+Smokehouse!"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4" />
                Peça no WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link href="/catalog">Ver Catálogo</Link>
            </Button>
          </motion.div>

          {/* Scroll hint */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          >
            <div className="w-px h-12 bg-gradient-to-b from-[var(--color-neon-blue)] to-transparent" />
          </motion.div>
        </div>
      </section>

      {/* ── MANIFESTO ────────────────────────────────────── */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[var(--color-neon-cyan)] opacity-[0.03] blur-[80px]" />
        </div>

        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-16">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-4">🌊 Nossa história</p>
            <h2 className="font-display text-headline text-[var(--color-text-primary)] leading-tight">
              A maré virou e o{" "}
              <span className="italic text-neon">tubarão</span>
              <br />chegou na área.
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6">
            <FadeIn delay={0.1}>
              <div className="glass rounded-2xl border border-[var(--color-border)] p-8 h-full">
                <div className="text-4xl mb-4">🦈</div>
                <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
                  Fundada em <strong className="text-[var(--color-text-primary)]">2024</strong> em João Pessoa,
                  a <strong className="text-[var(--color-text-primary)]">Shark Smokehouse</strong> não é
                  só uma tabacaria — é <strong className="text-[var(--color-neon-blue)]">atitude</strong>,{" "}
                  <strong className="text-[var(--color-neon-blue)]">curadoria</strong> e{" "}
                  <strong className="text-[var(--color-neon-blue)]">rigor</strong>.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="glass rounded-2xl border border-[var(--color-border)] p-8 h-full">
                <div className="text-4xl mb-4">🔥</div>
                <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed">
                  Produtos selecionados, ambiente diferenciado e aquela{" "}
                  <strong className="text-[var(--color-text-primary)]">vibe</strong> que só quem entende
                  vai reconhecer.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.3} className="md:col-span-2">
              <div className="glass rounded-2xl border border-[var(--color-neon-blue)]/20 bg-[var(--color-neon-blue-glow)] p-8 text-center">
                <Waves className="w-8 h-8 text-[var(--color-neon-blue)] mx-auto mb-4" />
                <p className="text-xl text-[var(--color-text-primary)] font-semibold leading-relaxed max-w-2xl mx-auto">
                  &ldquo;Aqui, cada detalhe foi pensado para proporcionar uma experiência única,
                  do atendimento aos produtos que fazem parte do seu momento.&rdquo;
                </p>
                <div className="flex items-center justify-center gap-2 mt-4 text-[var(--color-neon-blue)] text-sm font-medium">
                  <Anchor className="w-4 h-4" />
                  <span>Shark Smokehouse — João Pessoa, PB</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── PILLARS ──────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-4">
              <Star className="w-3 h-3 inline mr-1 align-middle" />
              Nossos pilares
            </p>
            <h2 className="font-display text-headline text-[var(--color-text-primary)]">
              O que nos define
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-5">
            {pillars.map((p, i) => (
              <FadeIn key={p.title} delay={i * 0.1}>
                <div
                  className={`rounded-2xl border p-8 text-center flex flex-col items-center gap-4 h-full transition-all hover:scale-[1.02] ${p.color}`}
                >
                  <span className="text-5xl">{p.emoji}</span>
                  <h3 className={`text-xl font-black ${p.glow}`}>{p.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{p.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── OFFERINGS ────────────────────────────────────── */}
      <section className="py-24 px-4 bg-[var(--color-bg-surface)]">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-14">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-4">💨 O que oferecemos</p>
            <h2 className="font-display text-headline text-[var(--color-text-primary)]">
              Tabacaria&nbsp;•&nbsp;Headshop&nbsp;•&nbsp;Acessórios
            </h2>
            <p className="text-[var(--color-text-muted)] mt-3 max-w-xl mx-auto font-light">
              Tudo em um só lugar para você curtir com qualidade.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {offerings.map((o, i) => {
              const Icon = o.icon;
              return (
                <FadeIn key={o.label} delay={i * 0.1}>
                  <div className={`rounded-2xl border p-6 flex flex-col items-center text-center gap-3 hover:scale-[1.03] transition-all ${o.bg} ${o.border}`}>
                    <div className={`w-12 h-12 rounded-xl ${o.bg} border ${o.border} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${o.color}`} />
                    </div>
                    <h3 className={`font-bold ${o.color}`}>{o.label}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{o.desc}</p>
                  </div>
                </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── LOCATION ─────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <FadeIn className="text-center mb-12">
            <p className="text-eyebrow text-[var(--color-text-muted)] mb-4">
              <MapPin className="w-3 h-3 inline mr-1 align-middle" />
              Onde estamos
            </p>
            <h2 className="font-display text-headline text-[var(--color-text-primary)]">
              João Pessoa, PB
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6 items-stretch">
            {/* Map placeholder / Address card */}
            <FadeIn delay={0.1}>
              <div className="glass rounded-2xl border border-[var(--color-border)] overflow-hidden h-full min-h-[260px] relative">
                <iframe
                  title="Shark Smokehouse — Localização"
                  src="https://www.google.com/maps?q=-7.1690894,-34.8423557&z=16&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0, filter: "invert(90%) hue-rotate(180deg)", minHeight: "260px" }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </FadeIn>

            {/* Address info */}
            <FadeIn delay={0.2} className="flex flex-col gap-4">
              <div className="glass rounded-2xl border border-[var(--color-border)] p-6 flex-1">
                <div className="flex items-start gap-3 mb-5">
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
                      Rua Comerciante Alfredo Ferreira da Rocha, 742<br />
                      Mangabeira — João Pessoa, PB<br />
                      CEP: 58055-540
                    </a>
                  </div>
                </div>

                <div className="h-px bg-[var(--color-border)] mb-5" />

                <div className="space-y-3">
                  {[
                    { day: "Segunda-feira", hours: "Fechado", closed: true },
                    { day: "Terça a Sexta", hours: "13h às 21h", closed: false },
                    { day: "Sábado e Domingo", hours: "14h às 21h", closed: false },
                    { day: "Lounge (Ter. a Dom.)", hours: "20h às 22h", closed: false },
                  ].map((item) => (
                    <div key={item.day} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">{item.day}</span>
                      <span className={item.closed ? "text-[var(--color-error)] font-medium" : "text-[var(--color-text-primary)] font-medium"}>
                        {item.hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="premium" size="lg" className="w-full" asChild>
                <a
                  href="https://wa.me/5583999020606?text=Ol%C3%A1%2C+vim+pelo+site+da+Shark+Smokehouse!"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-5 h-5" />
                  Peça pelo WhatsApp
                </a>
              </Button>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── COMING SOON ──────────────────────────────────── */}
      <section className="py-24 px-4 bg-[var(--color-bg-surface)] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] rounded-full bg-[var(--color-neon-blue)] opacity-[0.04] blur-[100px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative">
          <FadeIn>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="text-7xl mb-6 inline-block"
            >
              🦈
            </motion.div>

            <h2 className="font-display text-headline text-[var(--color-text-primary)] mb-4">
              Algo novo está
              <span
                className="italic"
                style={{
                  background: "linear-gradient(135deg, #0095ff, #c9bfff)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {" "}chegando…
              </span>
            </h2>

            <p className="text-[var(--color-text-secondary)] text-lg mb-8 max-w-xl mx-auto leading-relaxed">
              🔥 O melhor ainda vem por aí. Siga nossas redes e fique por dentro de tudo que a Shark
              está preparando para você.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-colors cursor-default"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://www.instagram.com/shark.smokehouse.ofc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent-pink)] hover:border-[var(--color-accent-pink)] hover:bg-pink-500/10 transition-all"
              >
                <span className="text-base">📸</span>
                Seguir no Instagram
              </a>
              <a
                href="https://wa.me/5583999020606?text=Ol%C3%A1%2C+quero+saber+mais+sobre+a+Shark+Smokehouse!"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl border border-[var(--color-success)]/30 bg-emerald-500/10 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-[var(--color-success)] transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── BOTTOM BAR ───────────────────────────────────── */}
      <div className="py-6 px-4 border-t border-[var(--color-border)] bg-[var(--color-bg-base)]">
        <p className="text-center text-xs text-[var(--color-text-muted)]">
          ⚠️&nbsp; Venda e consumo proibidos para menores de 18 anos. Fumar faz mal à saúde.
        </p>
      </div>

    </div>
  );
}
