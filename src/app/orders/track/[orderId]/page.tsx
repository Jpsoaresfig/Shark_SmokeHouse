"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Package, Radio, Truck, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/authStore";
import { subscribeOrder } from "@/lib/firebase/orders";
import {
  getTrackingSteps,
  getTrackingStatusMeta,
  getCancelReason,
} from "@/lib/orderTracking";
import { TrackingStatusCard } from "@/components/orders/TrackingStatusCard";
import { TrackingTimeline } from "@/components/orders/TrackingTimeline";
import { TrackingCourierCard } from "@/components/orders/TrackingCourierCard";
import { TrackingOrderSummary } from "@/components/orders/TrackingOrderSummary";
import { Button } from "@/components/ui/button";
import type { Order } from "@/types";

export default function TrackOrderPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId ?? "";
  const { user, loading: authLoading, firebaseReady } = useAuthStore();

  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Escuta em tempo real o pedido. As regras do Firestore só liberam a leitura
  // ao dono do pedido (e admin/seller/motoboy do pedido) — logo, um pedido que
  // não pertence ao usuário logado cai aqui como erro de permissão. O onSnapshot
  // notifica via callbacks (assíncrono), sem setState no corpo do efeito.
  useEffect(() => {
    if (!firebaseReady || !user) return;
    const unsub = subscribeOrder(
      orderId,
      (snap) => { setOrder(snap); setError(null); },
      (err) => {
        console.error("[track] falha ao escutar pedido", err);
        setOrder(null);
        setError("Não foi possível acessar este pedido.");
      },
    );
    return () => unsub();
  }, [firebaseReady, user, orderId]);

  /* ── Estados de carregamento / acesso ── */
  if (authLoading || !firebaseReady || order === undefined) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4">
        <div className="max-w-md mx-auto flex justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Faça login para acompanhar</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Acesse sua conta para rastrear seus pedidos.</p>
          <Button variant="premium" asChild>
            <Link href={`/login?redirect=/orders/track/${orderId}`}>Entrar na conta</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (order === null || error) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Pedido não encontrado</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            {error ?? "O pedido que você procura não existe ou não pertence à sua conta."}
          </p>
          <Button variant="secondary" asChild>
            <Link href="/orders"><ArrowLeft className="w-4 h-4" /> Voltar para Meus Pedidos</Link>
          </Button>
        </div>
      </div>
    );
  }

  const steps = getTrackingSteps(order);
  const meta = getTrackingStatusMeta(order);
  const isActive = order.status !== "delivered" && order.status !== "cancelled";
  const showCourier = order.status === "out_for_delivery" && Boolean(order.motoboyName);
  const cancelReason = getCancelReason(order);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-md mx-auto">
        {/* Voltar */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mb-5"
        >
          <ArrowLeft className="w-4 h-4" /> Meus Pedidos
        </Link>

        {/* Status em destaque */}
        <TrackingStatusCard meta={meta} />

        {/* Pedido cancelado: motivo, quando houver */}
        {order.status === "cancelled" && cancelReason && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-[var(--color-text-secondary)] mt-3"
          >
            <span className="font-semibold text-red-400">Motivo: </span>
            {cancelReason}
          </motion.div>
        )}

        {/* Linha do tempo (escondida em pedidos cancelados — não faz sentido) */}
        {order.status !== "cancelled" && (
          <div className="glass rounded-2xl border border-[var(--color-border)] p-5 mt-4">
            <div className="flex items-center gap-1.5 mb-4">
              <Radio className="w-4 h-4 text-[var(--color-neon-blue)]" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Acompanhamento
              </h2>
              {isActive && (
                <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-success)]">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-success)]" />
                  </span>
                  Ao vivo
                </span>
              )}
            </div>
            <TrackingTimeline steps={steps} />
          </div>
        )}

        {/* Entregador + mapa (apenas quando há motoboy real em rota) */}
        {showCourier && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Truck className="w-4 h-4 text-[var(--color-neon-blue)]" />
              <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Entregador
              </h2>
            </div>
            <TrackingCourierCard order={order} />
          </div>
        )}

        {/* Resumo do pedido */}
        <div className="mt-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--color-text-secondary)] mb-2.5 flex items-center gap-1.5">
            <Home className="w-4 h-4 text-[var(--color-neon-blue)]" /> Detalhes do pedido
          </h2>
          <TrackingOrderSummary order={order} />
        </div>

        {order.status === "delivered" && (
          <p className="text-center text-xs text-[var(--color-text-muted)] mt-6">
            Obrigado pela preferência! Avalie seu pedido em <Link href="/orders" className="text-[var(--color-neon-blue)] underline underline-offset-4">Meus Pedidos</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
