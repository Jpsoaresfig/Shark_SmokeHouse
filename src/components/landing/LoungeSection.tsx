"use client";

import { motion } from "framer-motion";
import { Clock, ArrowRight, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  "Ambiente exclusivo e climatizado",
  "Mais de 50 opções de essências premium",
  "Bebidas selecionadas",
  "Atendimento personalizado",
  "Música ao vivo nas sextas e sábados",
  "Reserva de mesa garantida",
];

export function LoungeSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-bg-surface)] via-[var(--color-bg-elevated)] to-[var(--color-bg-surface)]" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, var(--color-neon-blue) 1px, transparent 0)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Visual */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            {/* Main card */}
            <div className="relative rounded-3xl border border-[var(--color-border)] overflow-hidden aspect-[4/3] bg-gradient-to-br from-[var(--color-bg-overlay)] to-[#0d0d25]">
              {/* Atmosphere */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="text-5xl sm:text-8xl font-black tracking-tighter mb-2"
                    style={{
                      background: "linear-gradient(135deg, var(--color-electric-blue), var(--color-neon-blue), var(--color-neon-cyan))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    LOUNGE
                  </div>
                  <p className="text-[var(--color-text-muted)] text-sm tracking-[0.3em] uppercase">
                    Premium Experience
                  </p>
                </div>
              </div>

              {/* Glow effect */}
              <div className="absolute inset-0"
                style={{ background: "radial-gradient(circle at 50% 60%, rgba(37,99,255,0.1) 0%, transparent 60%)" }}
              />
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--color-neon-blue)] to-transparent opacity-60" />
            </div>
          </motion.div>

          {/* Right — Content */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <Badge variant="purple" className="mb-4">Experiência Exclusiva</Badge>
            <h2 className="text-4xl sm:text-5xl font-black text-[var(--color-text-primary)] mb-4 leading-tight">
              Narguilé Lounge
              <br />
              <span className="text-neon">Premium</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] text-lg mb-8 leading-relaxed">
              Reserve sua mesa no ambiente mais sofisticado da cidade. Uma experiência sensorial completa para você e seus convidados.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {features.map((feature, i) => (
                <motion.div
                  key={feature}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2.5"
                >
                  <CheckCircle className="w-4 h-4 text-[var(--color-success)] shrink-0" />
                  <span className="text-sm text-[var(--color-text-secondary)]">{feature}</span>
                </motion.div>
              ))}
            </div>

            {/* Hours */}
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] mb-8 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
              <Clock className="w-4 h-4 text-[var(--color-neon-blue)]" />
              <span>Aberto de <strong className="text-[var(--color-text-primary)]">Terça a Domingo</strong>, das <strong className="text-[var(--color-text-primary)]">14h às 02h</strong></span>
            </div>

            <div className="flex gap-3">
              <Button variant="premium" size="lg" asChild>
                <Link href="/lounge">
                  Agendar Mesa
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/about">Saiba Mais</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
