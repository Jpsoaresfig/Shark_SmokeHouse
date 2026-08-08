"use client";

import { motion } from "framer-motion";
import {
  ClipboardList, CreditCard, Flame, Bike, CheckCircle,
  XCircle, Clock, Search, MessageCircle, Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrackingStatusMeta } from "@/lib/orderTracking";

const TONE_STYLES: Record<TrackingStatusMeta["tone"], string> = {
  neutral: "glass border-[var(--color-border)]",
  blue: "glass border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]/20",
  orange: "glass border-orange-500/30 bg-orange-500/10",
  success: "glass border-emerald-500/30 bg-emerald-500/10",
  destructive: "glass border-red-500/30 bg-red-500/10",
  warning: "glass border-amber-500/30 bg-amber-500/10",
};

const TONE_ICON: Record<TrackingStatusMeta["tone"], string> = {
  neutral: "text-[var(--color-text-secondary)]",
  blue: "text-[var(--color-neon-blue)]",
  orange: "text-orange-400",
  success: "text-emerald-400",
  destructive: "text-red-400",
  warning: "text-amber-400",
};

const ICONS: Record<TrackingStatusMeta["iconKey"], React.ElementType> = {
  received: ClipboardList,
  payment: CreditCard,
  preparing: Flame,
  delivery: Bike,
  delivered: CheckCircle,
  cancelled: XCircle,
  reserved: Clock,
  analyzing: Search,
  approved: CheckCircle,
  whatsapp: MessageCircle,
};

/** Card de destaque com o estado atual do pedido. */
export function TrackingStatusCard({ meta }: { meta: TrackingStatusMeta }) {
  const Icon = ICONS[meta.iconKey] ?? Package;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("rounded-2xl p-5", TONE_STYLES[meta.tone])}
    >
      <div className="flex items-start gap-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[var(--color-bg-overlay)] border border-[var(--color-border)]", TONE_ICON[meta.tone])}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-[var(--color-text-primary)] leading-tight">
            {meta.title}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {meta.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
