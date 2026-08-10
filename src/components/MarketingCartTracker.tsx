"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { trackMarketingCartSession, clearMarketingCartSession } from "@/lib/firebase/marketing";

/**
 * Pluga a automação de carrinho abandonado: enquanto um usuário logado tem
 * itens no carrinho, registra a "sessão de carrinho" (throttled a 1/min pelo
 * próprio trackMarketingCartSession) para o cron de marketing disparar o
 * lembrete. Quando o carrinho é esvaziado, remove a sessão para não gerar
 * lembrete falso. Sem pop-ups, sem mudança de rota, invisível para o cliente.
 */
export function MarketingCartTracker() {
  const uid = useAuthStore((s) => s.user?.uid ?? "");
  const itemCount = useCartStore((s) => s.itemCount);
  const subtotal = useCartStore((s) => s.subtotal);
  const lastKey = useRef("");

  useEffect(() => {
    if (!uid) return;
    const key = `${itemCount}:${subtotal}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    if (itemCount <= 0) {
      void clearMarketingCartSession(uid);
    } else {
      void trackMarketingCartSession(uid, itemCount, subtotal);
    }
  }, [uid, itemCount, subtotal]);

  return null;
}
