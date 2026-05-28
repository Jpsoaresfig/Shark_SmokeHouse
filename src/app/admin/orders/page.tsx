"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Clock, CheckCircle, Truck, AlertTriangle, Package,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getOrders, updateOrderStatus } from "@/lib/firebase/orders";
import { toast } from "@/stores/toastStore";
import type { Order, OrderStatus } from "@/types";

const STATUS_CONFIG: Record<OrderStatus, { label: string; badge: "secondary" | "warning" | "default" | "purple" | "orange" | "success" | "destructive"; icon: React.ElementType }> = {
  received:         { label: "Recebido",         badge: "secondary",    icon: Clock },
  analyzing:        { label: "Em Análise",        badge: "warning",     icon: Clock },
  approved:         { label: "Aprovado",          badge: "default",     icon: CheckCircle },
  preparing:        { label: "Preparando",        badge: "purple",      icon: Package },
  out_for_delivery: { label: "Saiu p/ Entrega",   badge: "orange",      icon: Truck },
  delivered:        { label: "Entregue",          badge: "success",     icon: CheckCircle },
  cancelled:        { label: "Cancelado",         badge: "destructive", icon: AlertTriangle },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as OrderStatus[];
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  received: "analyzing",
  analyzing: "approved",
  approved: "preparing",
  preparing: "out_for_delivery",
  out_for_delivery: "delivered",
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("analyzing");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await getOrders());
    } catch {
      toast.error("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openOrder(order: Order) {
    setSelected(order);
    setNewStatus(NEXT_STATUS[order.status] ?? order.status);
    setNote("");
  }

  async function handleUpdateStatus() {
    if (!selected) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selected.id, newStatus, note || undefined);
      toast.success("Status do pedido atualizado!");
      setSelected(null);
      await load();
    } catch {
      toast.error("Erro ao atualizar o pedido. Tente novamente.");
    } finally {
      setUpdating(false);
    }
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);

  const counts = ALL_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter(o => o.status === s).length;
    return acc;
  }, {} as Record<OrderStatus, number>);

  const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Pedidos"
          subtitle={`${orders.length} pedido${orders.length !== 1 ? "s" : ""} no total`}
        />

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === "all" ? "bg-[var(--color-neon-blue)] text-white" : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
          >
            Todos ({orders.length})
          </button>
          {ALL_STATUSES.map(s => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${filter === s ? "bg-[var(--color-neon-blue)] text-white" : "bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
              >
                {cfg.label} ({counts[s]})
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingBag className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">Nenhum pedido encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {filtered.map((order, i) => {
                const cfg = STATUS_CONFIG[order.status];
                const Icon = cfg.icon;
                return (
                  <div key={order.id}>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 py-3 cursor-pointer hover:bg-[var(--color-bg-overlay)] rounded-xl px-2 -mx-2 transition-colors"
                      onClick={() => openOrder(order)}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[var(--color-bg-overlay)] flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4 text-[var(--color-text-muted)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                            #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">—</span>
                          <span className="text-sm text-[var(--color-text-secondary)] truncate">{order.customerName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {order.createdAt ? formatDateTime(order.createdAt) : "—"}
                            {" · "}{order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </p>
                          <Badge variant={cfg.badge} className="sm:hidden text-xs">
                            <Icon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <Badge variant={cfg.badge} className="hidden sm:flex">
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                        <span className="text-sm font-bold text-[var(--color-neon-blue)] whitespace-nowrap">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </motion.div>
                    {i < filtered.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Order detail modal */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido #{selected?.id.slice(-6).toUpperCase()}</DialogTitle>
            <DialogDescription>{selected?.customerName} · {selected?.customerPhone}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5">
              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Itens</p>
                <div className="space-y-2">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">{item.quantity}× {item.name}</span>
                      <span className="text-[var(--color-text-primary)] font-medium">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="mt-3 mb-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="text-[var(--color-text-secondary)]">{formatCurrency(selected.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Entrega</span>
                  <span className="text-[var(--color-text-secondary)]">{formatCurrency(selected.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold mt-1">
                  <span className="text-[var(--color-text-primary)]">Total</span>
                  <span className="text-[var(--color-neon-blue)]">{formatCurrency(selected.total)}</span>
                </div>
              </div>

              {/* Status history */}
              {selected.statusHistory?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Histórico</p>
                  <div className="space-y-1.5">
                    {selected.statusHistory.slice().reverse().map((ev, i) => {
                      const cfg = STATUS_CONFIG[ev.status];
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Badge variant={cfg.badge} className="text-xs">{cfg.label}</Badge>
                          <span className="text-[var(--color-text-muted)]">{ev.timestamp ? formatDateTime(ev.timestamp) : ""}</span>
                          {ev.note && <span className="text-[var(--color-text-secondary)]">· {ev.note}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Update status */}
              {selected.status !== "delivered" && selected.status !== "cancelled" && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Atualizar status</p>
                  <div className="space-y-3">
                    <select value={newStatus} onChange={e => setNewStatus(e.target.value as OrderStatus)} className={inputCls}>
                      {ALL_STATUSES.map(s => (
                        <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                      ))}
                    </select>
                    <input
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      placeholder="Observação (opcional)"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Fechar</Button>
            </DialogClose>
            {selected && selected.status !== "delivered" && selected.status !== "cancelled" && (
              <Button variant="premium" onClick={handleUpdateStatus} disabled={updating}>
                {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Atualizar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
