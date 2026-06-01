"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, ChevronDown, ChevronUp, ShoppingBag,
  Clock, CheckCircle, Truck, XCircle, AlertTriangle,
  MapPin, Calendar, CreditCard, ArrowRight, RefreshCw, Star, Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuthStore } from "@/stores/authStore";
import { getOrdersByCustomer } from "@/lib/firebase/orders";
import { createReview, getReviewsByCustomer } from "@/lib/firebase/reviews";
import { resolveOrderPayment } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_BADGE } from "@/lib/payments/labels";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Order, OrderStatus } from "@/types";

/* ── Status config ───────────────────────────────────────── */
const statusConfig: Record<OrderStatus, {
  label: string;
  badge: "default" | "warning" | "success" | "destructive" | "orange" | "purple" | "secondary";
  icon: React.ElementType;
  description: string;
  step: number;
}> = {
  received:         { label: "Recebido",          badge: "secondary",    icon: Clock,         description: "Pedido recebido, aguardando análise.",         step: 1 },
  analyzing:        { label: "Em Análise",         badge: "warning",      icon: Clock,         description: "Estamos verificando seu pedido.",              step: 2 },
  approved:         { label: "Aprovado",           badge: "default",      icon: CheckCircle,   description: "Pedido aprovado e sendo preparado.",            step: 3 },
  preparing:        { label: "Preparando",         badge: "purple",       icon: Package,       description: "Seu pedido está sendo preparado.",             step: 3 },
  out_for_delivery: { label: "Saiu para Entrega",  badge: "orange",       icon: Truck,         description: "Seu pedido está a caminho.",                   step: 4 },
  delivered:        { label: "Entregue",           badge: "success",      icon: CheckCircle,   description: "Pedido entregue com sucesso!",                  step: 5 },
  cancelled:        { label: "Cancelado",          badge: "destructive",  icon: XCircle,       description: "Este pedido foi cancelado.",                    step: 0 },
};

/* ── Progress bar ────────────────────────────────────────── */
function OrderProgress({ status }: { status: OrderStatus }) {
  if (status === "cancelled") return null;
  const currentStep = statusConfig[status].step;
  const steps = [
    { step: 1, label: "Recebido" },
    { step: 2, label: "Análise" },
    { step: 3, label: "Preparando" },
    { step: 4, label: "Entrega" },
    { step: 5, label: "Entregue" },
  ];
  return (
    <div className="py-4">
      <div className="flex items-center gap-0">
        {steps.map((s, i) => {
          const done = currentStep >= s.step;
          const active = currentStep === s.step;
          return (
            <div key={s.step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done
                    ? "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] shadow-[var(--shadow-neon-sm)]"
                    : "bg-[var(--color-bg-overlay)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                } ${active ? "ring-2 ring-[var(--color-neon-blue)]/30 ring-offset-2 ring-offset-[var(--color-bg-elevated)]" : ""}`}>
                  {done && currentStep > s.step ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    s.step
                  )}
                </div>
                <span className={`text-[10px] whitespace-nowrap ${done ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${
                  currentStep > s.step ? "bg-[var(--color-neon-blue)]" : "bg-[var(--color-border)]"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Order card ──────────────────────────────────────────── */
/* ── Bloco de avaliação do pedido ────────────────────────── */
function ReviewBlock({ order, reviewedRating, onReviewed }: {
  order: Order;
  reviewedRating?: number;
  onReviewed?: (orderId: string, rating: number) => void;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  /* Já avaliado — mostra a nota dada */
  if (reviewedRating) {
    return (
      <div className="p-4 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Sua avaliação</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} className={`w-5 h-5 ${n <= reviewedRating ? "text-[var(--color-warning)] fill-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`} />
          ))}
          <span className="ml-2 text-sm text-[var(--color-success)] font-medium flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Avaliação enviada
          </span>
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (rating < 1) { toast.error("Escolha uma nota de 1 a 5 estrelas."); return; }
    setSaving(true);
    try {
      await createReview({
        orderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success("Avaliação enviada. Obrigado! 🦈");
      onReviewed?.(order.id, rating);
    } catch (err) {
      console.error("[review] createReview", err);
      toast.error("Não foi possível enviar a avaliação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
      <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Avaliar pedido</h4>
      <div className="flex items-center gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="p-0.5"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          >
            <Star className={`w-7 h-7 transition-colors ${n <= (hover || rating) ? "text-[var(--color-warning)] fill-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="Conte como foi sua experiência (opcional)"
        className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none mb-3"
      />
      <Button variant="premium" size="sm" onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Star className="w-4 h-4" /> Enviar avaliação</>}
      </Button>
    </div>
  );
}

function OrderCard({ order, index, reviewedRating, onReviewed }: {
  order: Order;
  index: number;
  reviewedRating?: number;
  onReviewed?: (orderId: string, rating: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[order.status];
  const StatusIcon = cfg.icon;
  const isActive = !["delivered", "cancelled"].includes(order.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className={`rounded-2xl border bg-[var(--color-bg-elevated)] overflow-hidden transition-all duration-200 ${
        isActive
          ? "border-[var(--color-neon-blue)]/40 shadow-[0_0_0_1px_rgba(0,212,255,0.08)]"
          : "border-[var(--color-border)]"
      }`}
    >
      {/* Card header — always visible */}
      <button
        className="w-full text-left p-5 hover:bg-[var(--color-bg-overlay)] transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Order number + date */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              order.status === "delivered"
                ? "bg-emerald-500/10 border border-emerald-500/20"
                : order.status === "cancelled"
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20"
            }`}>
              <StatusIcon className={`w-5 h-5 ${
                order.status === "delivered" ? "text-emerald-400"
                  : order.status === "cancelled" ? "text-[var(--color-error)]"
                  : "text-[var(--color-neon-blue)]"
              }`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-[var(--color-text-primary)]">
                  Pedido #{order.id.slice(-6).toUpperCase()}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1 text-[10px] text-[var(--color-neon-blue)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-neon-blue)] animate-pulse" />
                    Em andamento
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mt-0.5">
                <Calendar className="w-3 h-3" />
                {formatDateTime(order.createdAt)}
              </div>
            </div>
          </div>

          {/* Status + total + chevron */}
          <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
            {order.awaitingConfirmation ? (
              <Badge variant="warning" className="text-xs shrink-0">
                <Clock className="w-3 h-3" />
                Aguardando sua confirmação
              </Badge>
            ) : (
              <Badge variant={cfg.badge} className="text-xs shrink-0">
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </Badge>
            )}
            <span className="text-base font-bold text-[var(--color-neon-blue)] whitespace-nowrap">
              {formatCurrency(order.total)}
            </span>
            {expanded
              ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 hidden sm:block" />
              : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0 hidden sm:block" />
            }
          </div>
        </div>

        {/* Progress bar — shown in header when active */}
        {isActive && <OrderProgress status={order.status} />}
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <Separator />
            <div className="p-5 space-y-5">

              {/* Status description */}
              <div className={`flex items-start gap-3 p-3.5 rounded-xl ${
                order.status === "cancelled"
                  ? "bg-red-500/10 border border-red-500/20"
                  : "bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/20"
              }`}>
                <StatusIcon className={`w-4 h-4 mt-0.5 shrink-0 ${
                  order.status === "cancelled" ? "text-[var(--color-error)]" : "text-[var(--color-neon-blue)]"
                }`} />
                <p className={`text-sm ${
                  order.status === "cancelled" ? "text-[var(--color-error)]" : "text-[var(--color-neon-blue)]"
                }`}>
                  {cfg.description}
                </p>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                  Itens do pedido
                </h4>
                <div className="space-y-2.5">
                  {order.items.map((item) => (
                    <div key={item.productId} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-overlay)]">
                      {/* Product image */}
                      <div className="w-12 h-12 rounded-lg bg-[var(--color-bg-hover)] overflow-hidden shrink-0 relative">
                        {item.image ? (
                          <Image src={item.image} alt={item.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{item.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {item.quantity}x · {formatCurrency(item.price)} cada
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)] whitespace-nowrap">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Totals */}
                <div className="p-4 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] space-y-2">
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Resumo</h4>
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Entrega</span>
                    <span className={order.deliveryFee === 0 ? "text-[var(--color-success)]" : ""}>
                      {order.deliveryFee === 0 ? "Grátis" : formatCurrency(order.deliveryFee)}
                    </span>
                  </div>
                  {order.discount ? (
                    <div className="flex justify-between text-sm text-[var(--color-success)]">
                      <span>Desconto</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  ) : null}
                  <Separator />
                  <div className="flex justify-between font-bold text-[var(--color-text-primary)]">
                    <span>Total</span>
                    <span className="text-[var(--color-neon-blue)]">{formatCurrency(order.total)}</span>
                  </div>
                  {(() => {
                    const pay = resolveOrderPayment(order);
                    return (
                      <div className="flex items-center gap-1.5 pt-1 text-xs text-[var(--color-text-muted)]">
                        <CreditCard className="w-3.5 h-3.5" />
                        {PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
                        <Badge variant={PAYMENT_STATUS_BADGE[pay.status] ?? "secondary"} className="text-[10px] ml-1">
                          {PAYMENT_STATUS_LABELS[pay.status] ?? pay.status}
                        </Badge>
                      </div>
                    );
                  })()}
                </div>

                {/* Delivery address */}
                {order.deliveryAddress && (
                  <div className="p-4 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
                    <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Endereço de entrega
                    </h4>
                    <address className="not-italic text-sm text-[var(--color-text-secondary)] space-y-0.5">
                      <p className="font-medium text-[var(--color-text-primary)]">
                        {order.deliveryAddress.street}, {order.deliveryAddress.number}
                        {order.deliveryAddress.complement && ` — ${order.deliveryAddress.complement}`}
                      </p>
                      <p>{order.deliveryAddress.neighborhood}</p>
                      <p>{order.deliveryAddress.city}, {order.deliveryAddress.state}</p>
                      <p>{order.deliveryAddress.zipCode}</p>
                    </address>
                  </div>
                )}
              </div>

              {/* Status history */}
              {order.statusHistory?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
                    Histórico
                  </h4>
                  <div className="space-y-2">
                    {[...order.statusHistory].reverse().map((h, i) => {
                      const hCfg = statusConfig[h.status];
                      const HIcon = hCfg?.icon ?? Clock;
                      return (
                        <div key={i} className="flex items-start gap-3 text-sm">
                          <div className="w-6 h-6 rounded-full bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 mt-0.5">
                            <HIcon className="w-3 h-3 text-[var(--color-text-muted)]" />
                          </div>
                          <div className="flex-1">
                            <span className="font-medium text-[var(--color-text-primary)]">{hCfg?.label ?? h.status}</span>
                            {h.note && <span className="text-[var(--color-text-muted)]"> — {h.note}</span>}
                            <p className="text-xs text-[var(--color-text-muted)]">{formatDateTime(h.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="p-3 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)]">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Observações</p>
                  <p className="text-sm text-[var(--color-text-secondary)]">{order.notes}</p>
                </div>
              )}

              {/* Avaliação — só para pedidos entregues */}
              {order.status === "delivered" && (
                <ReviewBlock order={order} reviewedRating={reviewedRating} onReviewed={onReviewed} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Filter tabs ─────────────────────────────────────────── */
type FilterValue = "all" | "active" | "delivered" | "cancelled";

const filters: { value: FilterValue; label: string }[] = [
  { value: "all",       label: "Todos" },
  { value: "active",    label: "Em andamento" },
  { value: "delivered", label: "Entregues" },
  { value: "cancelled", label: "Cancelados" },
];

function filterOrders(orders: Order[], f: FilterValue): Order[] {
  if (f === "active")    return orders.filter(o => !["delivered","cancelled"].includes(o.status));
  if (f === "delivered") return orders.filter(o => o.status === "delivered");
  if (f === "cancelled") return orders.filter(o => o.status === "cancelled");
  return orders;
}

/* ── Page ────────────────────────────────────────────────── */
export default function OrdersPage() {
  const { user, loading: authLoading, firebaseReady } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewed, setReviewed] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ords, revs] = await Promise.all([
        getOrdersByCustomer(user.uid),
        // Não bloqueia a lista se as regras de reviews ainda não foram publicadas.
        getReviewsByCustomer(user.uid).catch(() => []),
      ]);
      setOrders(ords);
      setReviewed(Object.fromEntries(revs.map((r) => [r.orderId, r.rating])));
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Wait for Firebase Auth to be confirmed before querying Firestore
  useEffect(() => { if (firebaseReady) load(); }, [firebaseReady, load]);

  const filtered = filterOrders(orders, filter);

  const counts = {
    all:       orders.length,
    active:    orders.filter(o => !["delivered","cancelled"].includes(o.status)).length,
    delivered: orders.filter(o => o.status === "delivered").length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
  };

  /* not logged in */
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Faça login para ver seus pedidos</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">Acesse sua conta para visualizar o histórico completo.</p>
          <Button variant="premium" asChild>
            <Link href="/login?redirect=/orders">Entrar na conta <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Meus Pedidos</h1>
            {!loading && (
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                {orders.length} pedido{orders.length !== 1 ? "s" : ""} no histórico
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)] transition-all disabled:opacity-40"
            title="Atualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-6">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                filter === f.value
                  ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-neon-sm)]"
                  : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-neon-blue)]/40"
              }`}
            >
              {f.label}
              {counts[f.value] > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  filter === f.value
                    ? "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                    : "bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)]"
                }`}>
                  {counts[f.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Skeleton */}
        {(loading || authLoading) && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
                <div className="flex items-center gap-4">
                  <div className="skeleton w-10 h-10 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-40 rounded" />
                    <div className="skeleton h-3 w-28 rounded" />
                  </div>
                  <div className="skeleton h-6 w-24 rounded-full" />
                  <div className="skeleton h-5 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !authLoading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4 text-center"
          >
            <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
              {filter === "all"
                ? <ShoppingBag className="w-9 h-9 text-[var(--color-text-muted)]" />
                : <AlertTriangle className="w-9 h-9 text-[var(--color-text-muted)]" />
              }
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)] mb-1">
                {filter === "all" ? "Você ainda não fez nenhum pedido" : `Nenhum pedido ${
                  filter === "active" ? "em andamento" : filter === "delivered" ? "entregue" : "cancelado"
                }`}
              </p>
              <p className="text-sm text-[var(--color-text-muted)]">
                {filter === "all"
                  ? "Explore nosso catálogo e faça seu primeiro pedido."
                  : "Tente outro filtro para ver mais pedidos."
                }
              </p>
            </div>
            {filter === "all" && (
              <Button variant="premium" asChild>
                <Link href="/catalog">
                  Explorar Catálogo
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            )}
          </motion.div>
        )}

        {/* Orders list */}
        {!loading && !authLoading && filtered.length > 0 && (
          <div className="space-y-4">
            {filtered.map((order, i) => (
              <OrderCard
                key={order.id}
                order={order}
                index={i}
                reviewedRating={reviewed[order.id]}
                onReviewed={(id, rating) => setReviewed((prev) => ({ ...prev, [id]: rating }))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
