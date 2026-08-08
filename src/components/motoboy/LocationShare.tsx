"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Satellite } from "lucide-react";
import { updateOrderMotoboyLocation, setOrderMotoboyPhone } from "@/lib/firebase/orders";
import { toast } from "@/stores/toastStore";

interface Props {
  orderId: string;
  /** Telefone do entregador — enviado uma vez para o cliente poder contatar. */
  phone?: string;
  /** Somente para entregas realmente em rota (out_for_delivery). */
  enabled: boolean;
}

const MIN_INTERVAL_MS = 15_000; // no mínimo a cada 15s, evita spam de gravação

/**
 * Compartilha a localização GPS REAL do entregador durante a entrega. Usa o
 * `watchPosition` do navegador e grava o último ponto em `order.motoboyLocation`
 * (com throttle de 15s). Enquanto desligado, nada é gravado — a tela do cliente
 * só mostra o mapa quando existem coordenadas de verdade.
 */
export function LocationShare({ orderId, phone, enabled }: Props) {
  const [sharing, setSharing] = useState(false);
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);
  const phoneSent = useRef(false);

  async function send(position: GeolocationPosition) {
    const now = Date.now();
    if (now - lastSent.current < MIN_INTERVAL_MS) return;
    lastSent.current = now;
    try {
      await updateOrderMotoboyLocation(orderId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
    } catch {
      // Falha de rede/regra: ignora silenciosamente, a próxima tentativa cobre.
    }
  }

  function start() {
    if (!("geolocation" in navigator)) {
      toast.error("Seu navegador não suporta localização.");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        send(pos);
        if (phone && !phoneSent.current) {
          phoneSent.current = true;
          setOrderMotoboyPhone(orderId, phone).catch(() => {});
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          toast.error("Permissão de localização negada. Libere o GPS nas configurações do navegador.");
        } else {
          toast.error("Não foi possível obter sua localização.");
        }
        stop();
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 },
    );
  }

  const stop = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setSharing(false);
  }, []);

  function toggle() {
    if (sharing) {
      stop();
      toast.success("Localização compartilhada desligada.");
    } else {
      setSharing(true);
      start();
      toast.success("Compartilhando sua localização. O cliente vê onde você está. 📡");
    }
  }

  // Para de compartilhar quando o pedido sai de rota / o componente sai da tela.
  useEffect(() => {
    if (!enabled && sharing) stop();
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [enabled, sharing, stop]);

  return (
    <button
      type="button"
      onClick={toggle}
      className={`flex items-center justify-center gap-2 flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
        sharing
          ? "bg-[var(--color-success)]/15 text-[var(--color-success)] border border-[var(--color-success)]/40"
          : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:text-[var(--color-neon-blue)]"
      }`}
    >
      {sharing ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
          </span>
          Compartilhando localização
        </>
      ) : (
        <>
          <Satellite className="w-4 h-4" />
          Compartilhar localização
        </>
      )}
    </button>
  );
}
