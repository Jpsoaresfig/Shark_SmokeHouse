"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Bike, MapPin, Phone, MessageCircle, Package, Truck, CheckCircle,
  Banknote, Clock, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { subscribeOrdersByMotoboy, updateOrderStatus } from "@/lib/firebase/orders";
import { resolveOrderPayment } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS } from "@/lib/payments/labels";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Order, OrderStatus } from "@/types";

const STATUS_LABEL: Partial<Record<OrderStatus, { label: string; badge: "secondary" | "warning" | "default" | "purple" | "orange" | "success" | "destructive" }>> = {
  received:         { label: "Recebido",        badge: "secondary" },
  analyzing:        { label: "Em Análise",       badge: "warning" },
  approved:         { label: "Aprovado",         badge: "default" },
  preparing:        { label: "Preparando",       badge: "purple" },
  out_for_delivery: { label: "Em rota",          badge: "orange" },
  delivered:        { label: "Entregue",         badge: "success" },
  cancelled:        { label: "Cancelado",        badge: "destructive" },
};

/** Link do Google Maps para navegar até o endereço do pedido. */
function mapsLink(o: Order) {
  const a = o.deliveryAddress;
  const q = `${a.street}, ${a.number} - ${a.neighborhood}, ${a.city} - ${a.state}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.startsWith("55") ? digits : `55${digits}`}`;
}

function isPickup(o: Order) {
  const a = o.deliveryAddress;
  return !a || a.id === "pickup" || a.label === "Retirada na loja" || !a.street;
}

export default function MotoboyPage() {
  const { user, loading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const allowed = user && (user.role === "motoboy" || user.role === "admin");

  useEffect(() => {
    if (!allowed) return;
    const unsub = subscribeOrdersByMotoboy(
      user.uid,
      (list) => { setOrders(list); setLoading(false); },
      () => {
        toast.error("Não foi possível carregar as entregas.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [allowed, user?.uid]);

  async function setStatus(order: Order, status: OrderStatus) {
    setUpdatingId(order.id);
    try {
      await updateOrderStatus(
        order.id,
        status,
        status === "delivered" ? "Entrega confirmada pelo motoboy" : "Motoboy saiu para entrega",
      );
      toast.success(status === "delivered" ? "Entrega confirmada! 🛵" : "Boa rota! Pedido em rota de entrega.");
    } catch {
      toast.error("Erro ao atualizar o pedido. Tente novamente.");
    } finally {
      setUpdatingId(null);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen pt-32 px-4 flex flex-col items-center text-center gap-3">
        <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
        <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Acesso restrito</h1>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
          Esta área é exclusiva para entregadores. Faça login com uma conta de motoboy.
        </p>
      </div>
    );
  }

  const active = orders.filter(o => o.status !== "delivered" && o.status !== "cancelled");
  const done = orders.filter(o => o.status === "delivered" || o.status === "cancelled");
  const shown = tab === "active" ? active : done;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-[var(--color-neon-blue-glow)] border border-[var(--color-neon-blue)]/30 flex items-center justify-center">
            <Bike className="w-5 h-5 text-[var(--color-neon-blue)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Minhas Entregas</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              Olá, {user.displayName?.split(" ")[0]} · {active.length} entrega{active.length !== 1 ? "s" : ""} pendente{active.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)] mb-5 mt-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
          </span>
          Ao vivo · novas entregas atribuídas a você aparecem aqui automaticamente
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("active")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "active" ? "bg-[var(--color-neon-blue)] text-white" : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
          >
            Pendentes ({active.length})
          </button>
          <button
            onClick={() => setTab("done")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "done" ? "bg-[var(--color-neon-blue)] text-white" : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
          >
            Concluídas ({done.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : shown.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Bike className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">
                {tab === "active" ? "Nenhuma entrega pendente no momento." : "Nenhuma entrega concluída ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {shown.map((order, i) => {
              const cfg = STATUS_LABEL[order.status] ?? { label: order.status, badge: "secondary" as const };
              const pay = resolveOrderPayment(order);
              const collectOnDelivery = pay.status === "due_on_delivery";
              const pickup = isPickup(order);
              const busy = updatingId === order.id;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                >
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      {/* Top: código + status + total */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[var(--color-text-primary)]">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <Badge variant={cfg.badge} className="text-xs">{cfg.label}</Badge>
                        </div>
                        <span className="text-sm font-bold text-[var(--color-neon-blue)]">
                          {formatCurrency(order.total)}
                        </span>
                      </div>

                      {/* Cobrança na entrega — destaque pro motoboy */}
                      {collectOnDelivery && order.status !== "cancelled" && (
                        <div className="flex items-center gap-2.5 rounded-xl bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-3">
                          <Banknote className="w-5 h-5 text-[var(--color-warning)] shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-[var(--color-warning)]">
                              Cobrar na entrega: {formatCurrency(order.total)}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
                            </p>
                          </div>
                        </div>
                      )}
                      {pay.status === "paid" && (
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-success)]">
                          <CheckCircle className="w-3.5 h-3.5" /> Pedido já pago — só entregar
                        </div>
                      )}

                      {/* Cliente */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{order.customerName}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {order.createdAt ? formatDateTime(order.createdAt) : ""}
                          </p>
                        </div>
                        {order.customerPhone && (
                          <div className="flex items-center gap-2">
                            <a
                              href={`tel:${order.customerPhone.replace(/\D/g, "")}`}
                              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" /> Ligar
                            </a>
                            <a
                              href={waLink(order.customerPhone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--color-success)]/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Endereço */}
                      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          {pickup ? <Package className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                          {pickup ? "Retirada na loja" : "Endereço de entrega"}
                        </p>
                        {pickup ? (
                          <p className="text-sm text-[var(--color-text-secondary)]">
                            Cliente retira no balcão — sem entrega.
                          </p>
                        ) : (
                          <>
                            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                              {order.deliveryAddress.street}, {order.deliveryAddress.number}
                              {order.deliveryAddress.complement ? `, ${order.deliveryAddress.complement}` : ""}<br />
                              {order.deliveryAddress.neighborhood} — {order.deliveryAddress.city}/{order.deliveryAddress.state}
                              {order.deliveryAddress.zipCode ? <> · {order.deliveryAddress.zipCode}</> : null}
                            </p>
                            <a
                              href={mapsLink(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-2 px-3 h-9 rounded-lg bg-[var(--color-neon-blue)]/10 border border-[var(--color-neon-blue)]/30 text-xs font-semibold text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)]/20 transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5" /> Abrir rota no Maps
                            </a>
                          </>
                        )}
                      </div>

                      {/* Itens */}
                      <div>
                        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
                          Itens ({order.items.length})
                        </p>
                        <div className="space-y-1">
                          {order.items.map((item, j) => (
                            <p key={j} className="text-sm text-[var(--color-text-secondary)]">
                              {item.quantity}× {item.name}
                              {item.color ? <span className="text-[var(--color-text-muted)]"> · {item.color}</span> : null}
                            </p>
                          ))}
                        </div>
                      </div>

                      {/* Observações (inclui troco) */}
                      {order.notes && (
                        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2.5">
                          <Clock className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
                          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{order.notes}</p>
                        </div>
                      )}

                      {/* Ações */}
                      {order.status !== "delivered" && order.status !== "cancelled" && (
                        <div className="flex gap-2 pt-1">
                          {order.status !== "out_for_delivery" ? (
                            <Button
                              variant="secondary"
                              className="flex-1"
                              onClick={() => setStatus(order, "out_for_delivery")}
                              disabled={busy}
                            >
                              {busy
                                ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                : <><Truck className="w-4 h-4" /> Saí para entrega</>}
                            </Button>
                          ) : (
                            <Button
                              variant="premium"
                              className="flex-1"
                              onClick={() => setStatus(order, "delivered")}
                              disabled={busy}
                            >
                              {busy
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><CheckCircle className="w-4 h-4" /> Entregue</>}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
