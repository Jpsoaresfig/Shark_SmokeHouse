"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  ShoppingBag, Clock, CheckCircle, Truck, AlertTriangle, Package, CreditCard, Star, MessageCircle,
  Bell, BellOff, Search, X, Banknote,
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
import { subscribeOrders, updateOrderStatus, markOrderPointsAwarded, updatePaymentStatus } from "@/lib/firebase/orders";
import { useNewOrderAlerts } from "@/hooks/useNewOrderAlerts";
import { awardPurchasePoints } from "@/lib/firebase/loyalty";
import { resolveOrderPayment } from "@/lib/payments";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_BADGE } from "@/lib/payments/labels";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Order, OrderStatus, PaymentStatus } from "@/types";

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

/** Monta o link do WhatsApp do cliente com a mensagem de aviso de entrega pronta. */
function waNotifyLink(phone: string, name: string, kind: "out_for_delivery" | "delivered", orderId: string) {
  const digits = phone.replace(/\D/g, "");
  const full = digits.startsWith("55") ? digits : `55${digits}`;
  const ref = `#${orderId.slice(-6).toUpperCase()}`;
  const firstName = (name || "").trim().split(" ")[0] || "tudo bem";
  const text = kind === "out_for_delivery"
    ? `Olá ${firstName}! 🦈 Seu pedido ${ref} da Shark Smokehouse saiu para entrega e chega já já. Qualquer coisa, é só responder por aqui!`
    : `Olá ${firstName}! 🦈 Seu pedido ${ref} foi entregue. Esperamos que aproveite — obrigado por comprar com a Shark Smokehouse! 💨`;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

export default function AdminOrders() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>("analyzing");
  const [note, setNote] = useState("");
  const [updating, setUpdating] = useState(false);
  const [payNote, setPayNote] = useState("");
  const [payingStatus, setPayingStatus] = useState<PaymentStatus | null>(null);
  const { soundOn, toggleSound, announce } = useNewOrderAlerts();

  // Escuta os pedidos em tempo real: a lista atualiza sozinha (sem refresh) e
  // cada pedido novo dispara toast + som + notificação do sistema.
  useEffect(() => {
    const unsub = subscribeOrders(
      300,
      (list, added) => {
        setOrders(list);
        setLoading(false);
        announce(added);
      },
      () => {
        toast.error("Não foi possível carregar os pedidos.");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [announce]);

  function openOrder(order: Order) {
    setSelected(order);
    setNewStatus(NEXT_STATUS[order.status] ?? order.status);
    setNote("");
    setPayNote("");
  }

  /* Abre automaticamente o pedido indicado na URL (?order=<id>),
     ex.: ao clicar num pedido recente no dashboard. Roda só uma vez. */
  const urlHandledRef = useRef(false);
  useEffect(() => {
    if (urlHandledRef.current || loading || orders.length === 0) return;
    urlHandledRef.current = true;
    const id = new URLSearchParams(window.location.search).get("order");
    if (!id) return;
    const match = orders.find(o => o.id === id);
    if (match) openOrder(match);
  }, [loading, orders]);

  /** Baixa financeira manual (ou estorno/cancelamento) do pagamento do pedido. */
  async function handlePaymentStatus(status: PaymentStatus) {
    if (!selected) return;
    setPayingStatus(status);
    try {
      await updatePaymentStatus(selected.id, status, {
        by: user?.uid,
        note: payNote.trim() || undefined,
      });
      toast.success("Status de pagamento atualizado!");
      setSelected(null);
      // A lista se atualiza sozinha pela escuta em tempo real (subscribeOrders).
    } catch {
      toast.error("Erro ao atualizar o pagamento. Tente novamente.");
    } finally {
      setPayingStatus(null);
    }
  }

  async function handleUpdateStatus() {
    if (!selected) return;
    setUpdating(true);
    try {
      await updateOrderStatus(selected.id, newStatus, note || undefined);

      // Credit loyalty points once the order is delivered (guarded against double-award).
      if (
        newStatus === "delivered" &&
        !selected.pointsAwarded &&
        (selected.pointsEarned ?? 0) > 0
      ) {
        await awardPurchasePoints(selected.customerId, selected.pointsEarned!, selected.id);
        await markOrderPointsAwarded(selected.id);
        toast.success(`Pedido entregue! ${selected.pointsEarned!.toLocaleString("pt-BR")} pontos creditados ao cliente.`);
      } else {
        toast.success("Status do pedido atualizado!");
      }

      setSelected(null);
      // A lista se atualiza sozinha pela escuta em tempo real (subscribeOrders).
    } catch {
      toast.error("Erro ao atualizar o pedido. Tente novamente.");
    } finally {
      setUpdating(false);
    }
  }

  // Busca por código do pedido (ex.: LTU5U00C), nome ou telefone do cliente.
  // O "código" é o final do id; tiramos um "#" inicial caso o admin cole assim.
  const q = search.trim().toLowerCase().replace(/^#/, "");
  const qDigits = q.replace(/\D/g, "");
  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (!q) return true;
    return (
      o.id.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      (qDigits.length >= 3 && (o.customerPhone ?? "").replace(/\D/g, "").includes(qDigits))
    );
  });

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

        {/* Status ao vivo + controle de som dos alertas de pedido novo */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--color-success)] opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
            </span>
            Ao vivo · novos pedidos aparecem aqui automaticamente
          </div>
          <button
            onClick={toggleSound}
            title={soundOn ? "Desligar som de pedido novo" : "Ligar som de pedido novo"}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors ${
              soundOn
                ? "bg-[var(--color-neon-blue)]/10 text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/30"
                : "bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] border border-[var(--color-border)]"
            }`}
          >
            {soundOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            {soundOn ? "Som ligado" : "Som desligado"}
          </button>
        </div>

        {/* Busca por código do pedido, nome ou telefone */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código (ex.: LTU5U00C), nome ou telefone…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] pl-9 pr-9 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-base)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

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
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {order.createdAt ? formatDateTime(order.createdAt) : "—"}
                            {" · "}{order.items.length} item{order.items.length !== 1 ? "s" : ""}
                          </p>
                          {order.awaitingConfirmation && (
                            <Badge variant="warning" className="text-xs">
                              <Clock className="w-3 h-3" />
                              Aguardando confirmação
                            </Badge>
                          )}
                          {order.isRedemption && (
                            <Badge variant="purple" className="text-xs">
                              <Star className="w-3 h-3" />
                              Resgate · {order.pointsRedeemed ?? 0} pts
                            </Badge>
                          )}
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
              {selected.awaitingConfirmation && (
                <div className="flex items-center gap-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2.5 text-sm text-[var(--color-warning)]">
                  <Clock className="w-4 h-4 shrink-0" />
                  Aguardando o cliente confirmar a compra pelo WhatsApp.
                </div>
              )}
              {selected.isRedemption && (
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/30 px-3 py-2.5 text-sm text-purple-300">
                  <Star className="w-4 h-4 shrink-0" />
                  Pedido resgatado com <strong>{selected.pointsRedeemed ?? 0} pontos</strong> de fidelidade (sem cobrança em dinheiro).
                </div>
              )}
              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Itens</p>
                <div className="space-y-2">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">
                        {item.quantity}× {item.name}
                        {item.color ? <span className="text-[var(--color-text-muted)]"> · {item.color}</span> : null}
                      </span>
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
                {(() => {
                  // cardFee gravado nos pedidos novos; nos antigos, deriva pela diferença
                  // para o resumo sempre fechar (subtotal + frete + cartão − desconto = total).
                  const cardFee = selected.cardFee ?? Math.round(
                    (selected.total - selected.subtotal - selected.deliveryFee + (selected.discount ?? 0)) * 100,
                  ) / 100;
                  if (Math.abs(cardFee) < 0.01) return null;
                  return (
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-muted)]">{cardFee > 0 ? "Acréscimo cartão" : "Desconto cartão"}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {cardFee > 0 ? "+" : "−"}{formatCurrency(Math.abs(cardFee))}
                      </span>
                    </div>
                  );
                })()}
                {selected.discount ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Desconto</span>
                    <span className="text-[var(--color-success)]">−{formatCurrency(selected.discount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-bold mt-1">
                  <span className="text-[var(--color-text-primary)]">Total</span>
                  <span className="text-[var(--color-neon-blue)]">{formatCurrency(selected.total)}</span>
                </div>
              </div>

              {/* Entrega ou retirada */}
              {(() => {
                const addr = selected.deliveryAddress;
                const pickup = !addr || addr.id === "pickup" || addr.label === "Retirada na loja" || !addr.street;
                return (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      {pickup ? <Package className="w-3.5 h-3.5" /> : <Truck className="w-3.5 h-3.5" />}
                      {pickup ? "Retirada na loja" : "Entrega"}
                    </p>
                    {pickup ? (
                      <p className="text-sm text-[var(--color-text-secondary)]">
                        Cliente vai retirar o pedido no balcão da loja.
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                        {addr.street}, {addr.number}{addr.complement ? `, ${addr.complement}` : ""}<br />
                        {addr.neighborhood} — {addr.city}/{addr.state}
                        {addr.zipCode ? <> · {addr.zipCode}</> : null}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Observações do pedido (inclui o troco, quando pagamento na entrega) */}
              {selected.notes && (
                <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2.5">
                  <Banknote className="w-4 h-4 shrink-0 mt-0.5 text-[var(--color-warning)]" />
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wider mb-0.5">Observações</p>
                    <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{selected.notes}</p>
                  </div>
                </div>
              )}

              {/* Pagamento — gestão financeira manual */}
              {(() => {
                const pay = resolveOrderPayment(selected);
                const settled = pay.status === "paid" || pay.status === "cancelled" || pay.status === "refunded";
                return (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5" /> Pagamento
                    </p>
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--color-text-secondary)]">
                          {PAYMENT_METHOD_LABELS[pay.method] ?? pay.method}
                        </span>
                        <Badge variant={PAYMENT_STATUS_BADGE[pay.status] ?? "secondary"} className="text-xs">
                          {PAYMENT_STATUS_LABELS[pay.status] ?? pay.status}
                        </Badge>
                      </div>
                      {pay.paidAt && (
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Confirmado em {formatDateTime(pay.paidAt)}
                        </p>
                      )}

                      {/* Histórico financeiro */}
                      {pay.history?.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {pay.history.slice().reverse().map((ev, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                              <span className="text-[var(--color-text-secondary)]">
                                {PAYMENT_STATUS_LABELS[ev.status] ?? ev.status}
                              </span>
                              <span>· {ev.timestamp ? formatDateTime(ev.timestamp) : ""}</span>
                              {ev.note && <span className="truncate">· {ev.note}</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Ações de baixa */}
                      {!settled && (
                        <div className="pt-2 space-y-2">
                          <input
                            value={payNote}
                            onChange={e => setPayNote(e.target.value)}
                            placeholder="Observação do pagamento (opcional)"
                            className={inputCls}
                          />
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="premium"
                              size="sm"
                              onClick={() => handlePaymentStatus("paid")}
                              disabled={payingStatus !== null}
                            >
                              {payingStatus === "paid"
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><CheckCircle className="w-3.5 h-3.5" /> Confirmar pagamento</>}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handlePaymentStatus("cancelled")}
                              disabled={payingStatus !== null}
                            >
                              Cancelar pagamento
                            </Button>
                          </div>
                        </div>
                      )}
                      {pay.status === "paid" && (
                        <div className="pt-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handlePaymentStatus("refunded")}
                            disabled={payingStatus !== null}
                          >
                            {payingStatus === "refunded"
                              ? <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                              : "Estornar"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

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

              {/* Avisar o cliente no WhatsApp (mensagem pronta, 1 clique) */}
              {selected.customerPhone && selected.status !== "cancelled" && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Avisar cliente no WhatsApp</p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={waNotifyLink(selected.customerPhone, selected.customerName, "out_for_delivery", selected.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-xs font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 transition-colors"
                    >
                      <Truck className="w-3.5 h-3.5" /> Saiu para entrega
                    </a>
                    <a
                      href={waNotifyLink(selected.customerPhone, selected.customerName, "delivered", selected.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 h-9 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Pedido chegou
                    </a>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> Abre o WhatsApp com a mensagem pronta — você só confirma o envio.
                  </p>
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
