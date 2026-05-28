"use client";

import { motion } from "framer-motion";
import { Crown, Gift, Zap, Star, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const tiers = [
  {
    name: "Smoke",
    color: "from-zinc-600 to-zinc-400",
    textColor: "text-zinc-300",
    borderColor: "border-zinc-600/40",
    bgColor: "bg-zinc-500/5",
    icon: Star,
    pointsRequired: 0,
    benefits: ["5% de cashback", "Acesso antecipado a promoções", "Newsletter exclusiva"],
  },
  {
    name: "Ember",
    color: "from-amber-600 to-amber-400",
    textColor: "text-amber-300",
    borderColor: "border-amber-500/40",
    bgColor: "bg-amber-500/5",
    icon: Zap,
    pointsRequired: 500,
    benefits: ["10% de cashback", "Frete grátis em todos os pedidos", "Desconto no lounge", "Brinde mensal"],
    popular: true,
  },
  {
    name: "Inferno",
    color: "from-[var(--color-electric-blue)] to-[var(--color-neon-blue)]",
    textColor: "text-[var(--color-neon-blue)]",
    borderColor: "border-[var(--color-neon-blue)]/40",
    bgColor: "bg-[var(--color-neon-blue-glow)]",
    icon: Crown,
    pointsRequired: 2000,
    benefits: ["15% de cashback", "Acesso VIP ao lounge", "Personal shopper", "Eventos exclusivos", "Kit boas-vindas premium"],
  },
];

export function LoyaltySection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="warning" className="mb-4">
            <Crown className="w-3 h-3" />
            Programa Exclusivo
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-black text-[var(--color-text-primary)] mb-4">
            Clube de
            <span className="text-neon"> Fidelidade</span>
          </h2>
          <p className="text-[var(--color-text-secondary)] text-lg max-w-2xl mx-auto">
            Quanto mais você compra, mais você ganha. Suba de nível e desbloqueie benefícios exclusivos.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {tiers.map((tier, i) => {
            const Icon = tier.icon;
            return (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`relative rounded-2xl border ${tier.borderColor} ${tier.bgColor} p-6 ${tier.popular ? "ring-1 ring-[var(--color-neon-blue)]/30" : ""}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge variant="premium" className="text-xs">Mais Popular</Badge>
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <h3 className={`text-xl font-black ${tier.textColor} mb-1`}>{tier.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-4">
                  {tier.pointsRequired === 0 ? "Nível inicial" : `A partir de ${tier.pointsRequired} pontos`}
                </p>

                <ul className="space-y-2.5">
                  {tier.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${tier.color}`} />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-4 p-6 rounded-2xl glass border border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-[var(--color-neon-blue)]" />
              <div className="text-left">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">Comece a acumular pontos agora</p>
                <p className="text-xs text-[var(--color-text-muted)]">Cadastre-se e ganhe 100 pontos de boas-vindas</p>
              </div>
            </div>
            <Button variant="premium" asChild>
              <Link href="/register">
                Criar Conta Grátis
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
