"use client";

import { MapPin, ExternalLink } from "lucide-react";
import { formatTimeAgo } from "@/lib/timeAgo";
import type { DeliveryLocation } from "@/types";

function isValid(loc: DeliveryLocation): boolean {
  return (
    typeof loc.lat === "number" && Number.isFinite(loc.lat) &&
    typeof loc.lng === "number" && Number.isFinite(loc.lng)
  );
}

/**
 * Mapa da localização do entregador. Só renderiza quando existem coordenadas
 * GPS REAIS reportadas pelo motoboy (`order.motoboyLocation`) — nunca simula.
 * Usa o embed público do Google Maps (sem chave) para exibir o ponto e um link
 * para abrir no app.
 */
export function TrackingMap({ location }: { location?: DeliveryLocation }) {
  if (!location || !isValid(location)) return null;

  const { lat, lng } = location;
  const embedUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const openUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)]">
      <div className="relative">
        <iframe
          title="Localização do entregador"
          src={embedUrl}
          className="w-full h-52 border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg-base)]/85 backdrop-blur border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
          <MapPin className="w-3 h-3 text-[var(--color-neon-blue)]" />
          {formatTimeAgo(location.updatedAt)}
        </span>
      </div>
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]/20 hover:bg-[var(--color-neon-blue-glow)]/40 transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Abrir no Google Maps
      </a>
    </div>
  );
}
