"use client";

import { motion } from "framer-motion";
import { Truck, Sparkles } from "lucide-react";
import { useSiteCart } from "@/stores/siteSettingsStore";
import { useAuthStore } from "@/stores/authStore";
import { getLevel } from "@/lib/loyalty/levels";
import { formatCurrency } from "@/lib/utils";

/**
 * Vantagens exibidas no carrinho:
 *  1. Barra de progresso de FRETE GRÁTIS — só aparece se o dono ligou em
 *     Configurações (useSiteCart). O frete é de fato zerado no checkout quando
 *     o subtotal atinge o limite.
 *  2. Estimativa de pontos do Clube Shark (mesma engine do checkout).
 * Reutilizado na página do carrinho e no drawer lateral.
 */
export function CartPerks({ subtotal }: { subtotal: number }) {
  const { freeShippingEnabled, freeShippingThreshold } = useSiteCart();
  const user = useAuthStore((s) => s.user);

  const showFreeShipping = freeShippingEnabled && freeShippingThreshold > 0;
  const qualifies = showFreeShipping && subtotal >= freeShippingThreshold;
  const remaining = Math.max(0, freeShippingThreshold - subtotal);
  const pct = showFreeShipping
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 0;

  // Taxa do nível do cliente logado; visitante usa o nível inicial como incentivo.
  const rate = getLevel(user?.loyaltyPoints ?? 0).earnRate;
  const estPoints = Math.round(subtotal * rate);

  if (subtotal <= 0) return null;

  return (
    <div className="space-y-2.5">
      {showFreeShipping && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs leading-snug">
            <Truck
              className={`w-4 h-4 shrink-0 ${
                qualifies ? "text-[var(--color-success)]" : "text-[var(--color-neon-blue)]"
              }`}
            />
            {qualifies ? (
              <span className="font-semibold text-[var(--color-success)]">
                Você ganhou frete grátis! 🎉
              </span>
            ) : (
              <span className="text-[var(--color-text-secondary)]">
                Faltam{" "}
                <span className="font-bold text-[var(--color-text-primary)]">
                  {formatCurrency(remaining)}
                </span>{" "}
                para <span className="font-semibold text-[var(--color-neon-blue)]">FRETE GRÁTIS</span>
              </span>
            )}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
            <motion.div
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", damping: 20, stiffness: 120 }}
              className={`h-full rounded-full ${
                qualifies ? "bg-[var(--color-success)]" : "bg-[var(--color-neon-blue)]"
              }`}
            />
          </div>
        </div>
      )}

      {estPoints > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-neon-blue)] shrink-0" />
          {user ? (
            <span>
              Você vai ganhar{" "}
              <span className="font-semibold text-[var(--color-neon-blue)]">~{estPoints} pontos</span>{" "}
              no Clube Shark
            </span>
          ) : (
            <span>
              Ganhe{" "}
              <span className="font-semibold text-[var(--color-neon-blue)]">~{estPoints} pontos</span>{" "}
              no Clube Shark
            </span>
          )}
        </div>
      )}
    </div>
  );
}
