"use client";

import { motion } from "framer-motion";
import {
  Check, ClipboardList, CreditCard, Flame, Bike, Home,
} from "lucide-react";
import type { TrackingStep, TrackingStepKey } from "@/lib/orderTracking";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STEP_ICONS: Record<TrackingStepKey, React.ElementType> = {
  received: ClipboardList,
  payment_confirmed: CreditCard,
  preparing: Flame,
  out_for_delivery: Bike,
  delivered: Home,
};

/** Linha do tempo vertical da entrega. Cada etapa reflete o estado REAL do
 *  pedido (status, statusHistory e pagamento) — nada é simulado. */
export function TrackingTimeline({ steps }: { steps: TrackingStep[] }) {
  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.key];
        const isLast = i === steps.length - 1;
        return (
          <div key={step.key} className="flex gap-3.5">
            {/* Coluna do ícone + conector */}
            <div className="flex flex-col items-center">
              <motion.div
                initial={step.current ? { scale: 0.9 } : false}
                animate={step.current ? { scale: [0.95, 1.05, 0.95] } : undefined}
                transition={step.current ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : undefined}
                className={cn(
                  "relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all",
                  step.done && "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] shadow-[var(--shadow-neon-sm)]",
                  !step.done && step.current && "bg-[var(--color-neon-blue)]/20 text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)] shadow-[var(--shadow-neon-md)]",
                  !step.done && !step.current && "bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-muted)]",
                )}
              >
                {step.done ? (
                  <Check className="w-4 h-4" strokeWidth={3} />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {step.current && (
                  <span className="absolute inset-0 rounded-full border-2 border-[var(--color-neon-blue)] opacity-40 animate-ping" />
                )}
              </motion.div>
              {!isLast && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-7 my-1.5 transition-colors",
                    steps[i + 1].done ? "bg-[var(--color-neon-blue)]" : "bg-[var(--color-border)]",
                  )}
                />
              )}
            </div>

            {/* Conteúdo da etapa */}
            <div className={cn("min-w-0", isLast ? "" : "pb-7")}>
              <div className="flex items-center gap-2 flex-wrap">
                <p
                  className={cn(
                    "text-sm font-bold",
                    step.done || step.current ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]",
                  )}
                >
                  {step.label}
                </p>
                {step.done && !step.current && step.completedAt && (
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {formatDateTime(step.completedAt)}
                  </span>
                )}
                {step.done && <Check className="w-3.5 h-3.5 text-[var(--color-neon-blue)]" />}
              </div>

              {step.current && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-[var(--color-neon-blue)] mt-1"
                >
                  {step.activeText}
                </motion.p>
              )}

              {step.note && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  {step.note}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
