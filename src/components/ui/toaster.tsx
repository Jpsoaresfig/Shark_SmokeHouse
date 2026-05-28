"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore, type ToastItem } from "@/stores/toastStore";

const DURATION = 5000;

const VARIANT_CONFIG = {
  success: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  error: {
    icon: XCircle,
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  info: {
    icon: Info,
    color: "text-[var(--color-neon-blue)]",
    border: "border-[var(--color-neon-blue)]/30",
    bg: "bg-[var(--color-neon-blue-glow)]",
  },
} as const;

function ToastEntry({ t }: { t: ToastItem }) {
  const { removeToast } = useToastStore();
  const cfg = VARIANT_CONFIG[t.variant];
  const Icon = cfg.icon;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(t.id), DURATION);
    return () => clearTimeout(timer);
  }, [t.id, removeToast]);

  return (
    <motion.div
      layout
      role="alert"
      aria-atomic="true"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.94, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={[
        "flex items-start gap-3 rounded-xl border p-4 w-80 max-w-[calc(100vw-2rem)]",
        "shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-md",
        "bg-[var(--color-bg-elevated)]",
        cfg.border,
        cfg.bg,
      ].join(" ")}
    >
      <Icon className={`w-5 h-5 ${cfg.color} mt-0.5 shrink-0`} />
      <div className="flex-1 min-w-0">
        {t.title && (
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5 leading-tight">
            {t.title}
          </p>
        )}
        <p
          className={`text-sm leading-snug ${
            t.title ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-primary)]"
          }`}
        >
          {t.message}
        </p>
      </div>
      <button
        onClick={() => removeToast(t.id)}
        aria-label="Fechar notificação"
        className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function Toaster() {
  const { toasts } = useToastStore();

  return (
    <div
      aria-label="Notificações"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2 sm:bottom-6 sm:right-6 pointer-events-none"
    >
      <AnimatePresence initial={false} mode="sync">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastEntry t={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
