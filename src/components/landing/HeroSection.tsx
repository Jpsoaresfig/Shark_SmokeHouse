"use client";

import { motion } from "framer-motion";
import { ArrowRight, Star, Flame, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/ui/Logo";

const statsData = [
  { value: "500+", label: "Produtos Premium" },
  { value: "5★", label: "Avaliação Média" },
  { value: "2h", label: "Entrega Expressa" },
  { value: "10k+", label: "Clientes Satisfeitos" },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#08080f] via-[#0a0f1e] to-[#08080f]" />

      {/* Radial glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,255,0.08) 0%, transparent 70%)" }}
      />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(0,212,255,0.05) 0%, transparent 70%)" }}
      />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(var(--color-neon-blue) 1px, transparent 1px), linear-gradient(90deg, var(--color-neon-blue) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Floating elements — CSS-animated, no JS overhead */}
      <div className="animate-float absolute top-24 right-16 w-20 h-20 rounded-2xl border border-[var(--color-neon-blue)]/20 bg-[var(--color-neon-blue-glow)] hidden lg:flex items-center justify-center">
        <Flame className="w-8 h-8 text-[var(--color-neon-blue)]/60" />
      </div>

      <div className="animate-float-alt absolute bottom-32 left-16 w-14 h-14 rounded-xl border border-[var(--color-accent-orange)]/20 bg-orange-500/5 hidden lg:flex items-center justify-center">
        <Star className="w-6 h-6 text-orange-400/40" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="flex justify-center mb-8">
            <Logo variant="black" size="xl" asLink={false} />
          </div>

          <Badge variant="premium" className="mb-6 text-xs px-4 py-1.5">
            <Flame className="w-3 h-3" />
            Tabacaria Premium do Brasil
          </Badge>

          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-none tracking-tight mb-6">
            <span className="block text-[var(--color-text-primary)]">Eleve sua</span>
            <span
              className="block"
              style={{
                background: "linear-gradient(135deg, var(--color-electric-blue), var(--color-neon-blue), var(--color-neon-cyan))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Experiência
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            A seleção mais exclusiva de charutos, narguilés e acessórios premium.
            Uma experiência que vai além do produto — é um lifestyle.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Button variant="premium" size="xl" asChild>
              <Link href="/catalog">
                Explorar Catálogo
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="xl" asChild>
              <Link href="/lounge">
                <Play className="w-4 h-4" />
                Agendar Lounge
              </Link>
            </Button>
          </div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {statsData.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="glass rounded-2xl p-5 text-center"
              >
                <p className="text-2xl font-black text-neon mb-1">{stat.value}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--color-bg-base)] to-transparent" />
    </section>
  );
}
