"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import {
  playNewOrderChime, requestNotificationPermission, showSystemNotification, unlockAudio,
} from "@/lib/notify";
import type { Order } from "@/types";

const SOUND_KEY = "admin:orders:sound";

/**
 * Alertas de "pedido novo" para as telas do admin (dashboard e lista de
 * pedidos). Cuida da permissão de notificação, de destravar o áudio no
 * primeiro clique e da preferência de som (compartilhada entre as telas via
 * localStorage). Use `announce(added)` com os pedidos recém-chegados que vêm
 * do `subscribeOrders`.
 */
export function useNewOrderAlerts() {
  const [soundOn, setSoundOn] = useState(
    () => typeof window === "undefined" || localStorage.getItem(SOUND_KEY) !== "off",
  );
  const soundOnRef = useRef(soundOn);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);

  // Pede permissão de notificação e "destrava" o áudio no primeiro clique
  // (exigência dos navegadores para poder tocar som depois).
  useEffect(() => {
    requestNotificationPermission();
    const unlock = () => { unlockAudio(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock);
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn(prev => {
      const next = !prev;
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      if (next) { unlockAudio(); playNewOrderChime(); } // testa/destrava ao ligar
      return next;
    });
  }, []);

  /** Dispara toast + notificação do sistema + som para cada pedido novo. */
  const announce = useCallback((added: Order[]) => {
    if (added.length === 0) return;
    for (const o of added) {
      const ref = `#${o.id.slice(-6).toUpperCase()}`;
      const desc = `${ref} — ${o.customerName} · ${formatCurrency(o.total)}`;
      toast.success(desc, "🦈 Pedido novo!");
      showSystemNotification("🦈 Pedido novo na Shark!", desc);
    }
    if (soundOnRef.current) playNewOrderChime();
  }, []);

  return { soundOn, toggleSound, announce };
}
