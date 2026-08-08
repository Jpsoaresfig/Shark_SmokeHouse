"use client";

import { Bike, MessageCircle } from "lucide-react";
import { TrackingMap } from "@/components/orders/TrackingMap";
import { getInitials, formatDateTime } from "@/lib/utils";
import type { Order } from "@/types";

function phoneDigits(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (!d.startsWith("55")) d = `55${d}`;
  return d;
}

/** Card do entregador + mapa em tempo real (só quando há GPS real do motoboy). */
export function TrackingCourierCard({ order }: { order: Order }) {
  const { motoboyName, motoboyPhone, motoboyLocation } = order;

  return (
    <div className="space-y-3">
      <div className="glass rounded-2xl border border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-neon-blue)] shrink-0">
            {motoboyName ? getInitials(motoboyName) : <Bike className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
              {motoboyName ?? "Entregador"}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {motoboyLocation
                ? `Localização atualizada ${formatDateTime(motoboyLocation.updatedAt)}`
                : "Seu pedido está a caminho com o entregador."}
            </p>
          </div>
          {motoboyPhone && (
            <a
              href={`https://wa.me/${phoneDigits(motoboyPhone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--color-success)]/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      <TrackingMap location={motoboyLocation} />
    </div>
  );
}
