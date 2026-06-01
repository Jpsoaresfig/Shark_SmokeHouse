"use client";

import { useState } from "react";
import { Crown, Gift, Star, Sparkles, UserPlus, Users, ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";

/* ── Níveis reais do clube (espelham os tiers do perfil) ──────────────
   Benefícios são placeholders de marketing — serão definidos com os donos. */
const TIERS = [
  {
    name: "Bronze",
    color: "#cd7f32",
    glow: "rgba(205,127,50,0.12)",
    pointsRequired: 0,
    benefits: ["5% de cashback", "Acesso antecipado a promoções", "Newsletter exclusiva"],
  },
  {
    name: "Prata",
    color: "#c0c0c0",
    glow: "rgba(192,192,192,0.12)",
    pointsRequired: 500,
    benefits: ["10% de cashback", "Frete grátis nos pedidos", "Desconto no lounge", "Brinde mensal"],
    popular: true,
  },
  {
    name: "Ouro",
    color: "#ffd700",
    glow: "rgba(255,215,0,0.12)",
    pointsRequired: 1000,
    benefits: ["12% de cashback", "Personal shopper", "Eventos exclusivos"],
  },
  {
    name: "Diamante",
    color: "#00d4ff",
    glow: "rgba(0,212,255,0.12)",
    pointsRequired: 2500,
    benefits: ["15% de cashback", "Acesso VIP ao lounge", "Kit boas-vindas premium", "Eventos exclusivos"],
  },
];

const HOW_IT_WORKS = [
  { icon: UserPlus, label: "Ganhe 100 pontos só por se cadastrar" },
  { icon: ShoppingBag, label: "Acumule pontos a cada compra que fizer" },
  { icon: Users, label: "Indique amigos e ganhe 200 pontos por cadastro" },
  { icon: Gift, label: "Troque seus pontos por recompensas exclusivas" },
];

export function LoyaltyProgramModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="group flex items-center gap-2.5 w-full sm:w-auto justify-center rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--color-warning)] hover:bg-[var(--color-warning)]/15 hover:border-[var(--color-warning)]/50 transition-all">
          <Crown className="w-4 h-4 shrink-0" />
          Conheça nosso programa exclusivo
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <Badge variant="warning" className="w-fit mb-1">
            <Crown className="w-3 h-3" />
            Programa Exclusivo
          </Badge>
          <DialogTitle className="text-2xl font-black">
            Clube de <span className="text-neon">Fidelidade</span>
          </DialogTitle>
          <DialogDescription>
            Quanto mais você compra, mais você ganha. Suba de nível e desbloqueie benefícios exclusivos.
          </DialogDescription>
        </DialogHeader>

        {/* Como funciona */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[var(--color-neon-blue)]" />
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Como funciona</h3>
          </div>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {HOW_IT_WORKS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <span className="w-7 h-7 rounded-lg bg-[var(--color-neon-blue-glow)] flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />
                </span>
                <span className="leading-snug">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Níveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="relative rounded-2xl border p-4"
              style={{
                borderColor: `${tier.color}40`,
                background: `radial-gradient(ellipse at top right, ${tier.glow}, transparent 70%), var(--color-bg-elevated)`,
              }}
            >
              {tier.popular && (
                <div className="absolute -top-2.5 right-3">
                  <Badge variant="premium" className="text-[10px]">Mais Popular</Badge>
                </div>
              )}

              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${tier.color}1f`, border: `1px solid ${tier.color}40` }}
                >
                  <Sparkles className="w-5 h-5" style={{ color: tier.color }} />
                </div>
                <div className="min-w-0">
                  <h4 className="text-base font-black" style={{ color: tier.color }}>{tier.name}</h4>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {tier.pointsRequired === 0 ? "Nível inicial" : `A partir de ${tier.pointsRequired.toLocaleString("pt-BR")} pts`}
                  </p>
                </div>
              </div>

              <ul className="space-y-2">
                {tier.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Star className="w-3 h-3 shrink-0" style={{ color: tier.color }} />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-xs text-[var(--color-text-muted)] text-center mt-5">
          Comece a acumular agora — seus pontos aparecem aqui no seu perfil. 🦈
        </p>
      </DialogContent>
    </Dialog>
  );
}
