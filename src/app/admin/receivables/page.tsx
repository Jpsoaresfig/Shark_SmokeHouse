"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CircleDollarSign, Search, ChevronDown, ChevronUp, User, CalendarClock,
  Wallet, Ban, CheckCircle, History,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatCurrency } from "@/lib/utils";
import {
  getReceivables, registerSalePayment, markSalePaid, cancelSale,
  SALE_PAYMENT_LABELS as PAYMENT_LABELS,
} from "@/lib/firebase/sales";
import { SALE_PAYMENT_STATUS_LABELS, SALE_PAYMENT_STATUS_BADGE } from "@/lib/payments/labels";
import { saleReceivedAmount, saleOutstanding, saleStatus } from "@/lib/sales/helpers";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Sale, SalePaymentMethod } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v === "string") return new Date(v);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(0);
}

function parseMoney(v: string): number {
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Vencida? Date.now() fica encapsulado aqui (fora do render) para o React Compiler. */
function isOverdue(due: Date | null): boolean {
  return due ? due.getTime() < Date.now() : false;
}

const PAYMENT_OPTIONS: { value: SalePaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

type StatusFilter = "all" | "pending" | "partial";

export default function AdminReceivables() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [queryText, setQueryText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  /* Diálogos de recebimento / cancelamento */
  const [payTarget, setPayTarget] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<SalePaymentMethod>("cash");
  const [paySaving, setPaySaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      setItems(await getReceivables(force));
    } catch {
      toast.error("Não foi possível carregar as contas a receber.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return items.filter((s) => {
      if (statusFilter !== "all" && saleStatus(s) !== statusFilter) return false;
      if (!q) return true;
      return (s.customerName ?? "").toLowerCase().includes(q)
        || s.id.toLowerCase().includes(q);
    });
  }, [items, queryText, statusFilter]);

  const totals = useMemo(() => {
    let outstanding = 0, received = 0;
    for (const s of filtered) { outstanding += saleOutstanding(s); received += saleReceivedAmount(s); }
    return { outstanding, received, count: filtered.length };
  }, [filtered]);

  function openPayDialog(sale: Sale) {
    setPayTarget(sale);
    setPayAmount(saleOutstanding(sale).toFixed(2).replace(".", ","));
    setPayMethod(sale.paymentMethod);
  }

  async function handleRegisterPayment() {
    if (!payTarget || !user) return;
    const amount = parseMoney(payAmount);
    if (!(amount > 0)) { toast.error("Informe um valor válido."); return; }
    setPaySaving(true);
    try {
      await registerSalePayment(payTarget.id, { amount, method: payMethod, receivedBy: user.uid });
      toast.success("Recebimento registrado.");
      setPayTarget(null);
      setPayAmount("");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar.");
    } finally {
      setPaySaving(false);
    }
  }

  async function handleSettle(sale: Sale) {
    if (!user) return;
    setSettlingId(sale.id);
    try {
      await markSalePaid(sale.id, user.uid);
      toast.success("Cobrança quitada.");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível quitar.");
    } finally {
      setSettlingId(null);
    }
  }

  async function handleCancel() {
    if (!cancelTarget || !user) return;
    if (!cancelReason.trim()) { toast.error("Informe o motivo."); return; }
    setCancelSaving(true);
    try {
      await cancelSale(cancelTarget.id, cancelReason.trim(), user.uid);
      toast.success("Cobrança cancelada — estoque estornado.");
      setCancelTarget(null);
      setCancelReason("");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar.");
    } finally {
      setCancelSaving(false);
    }
  }

  const STATUS_TABS: { v: StatusFilter; label: string }[] = [
    { v: "all", label: "Todas" },
    { v: "pending", label: "Pendentes" },
    { v: "partial", label: "Parciais" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Contas a Receber"
          subtitle="Vendas fiadas e parciais aguardando pagamento."
        />

        {/* Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <CircleDollarSign className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(totals.outstanding)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Total a receber</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-neon-blue-glow)] flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4 text-[var(--color-neon-blue)]" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(totals.received)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Já recebido (parcial)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                <CircleDollarSign className="w-4 h-4 text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-black text-[var(--color-text-primary)]">{totals.count}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Cobranças em aberto</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Buscar por cliente ou nº da venda..."
                className={inputCls + " pl-9"}
              />
            </div>
            <div className="flex gap-1.5">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setStatusFilter(t.v)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                    statusFilter === t.v
                      ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-14 gap-2">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
              <p className="text-sm text-[var(--color-text-muted)]">Nenhuma conta a receber. Tudo em dia! 🎉</p>
            </CardContent>
          </Card>
        ) : (
          <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {filtered.map((sale, i) => {
              const isOpen = expanded === sale.id;
              const due = sale.dueDate ? toDate(sale.dueDate) : null;
              const overdue = isOverdue(due);
              return (
                <motion.div
                  key={sale.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                >
                  <Card>
                    <CardContent className="p-0">
                      <button
                        onClick={() => setExpanded(isOpen ? null : sale.id)}
                        className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--color-bg-hover)] transition-colors rounded-xl"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                              {sale.customerName || "Cliente não vinculado"}
                            </span>
                            <Badge variant={SALE_PAYMENT_STATUS_BADGE[saleStatus(sale)]} className="text-[10px]">
                              {SALE_PAYMENT_STATUS_LABELS[saleStatus(sale)]}
                            </Badge>
                            {overdue && (
                              <Badge variant="destructive" className="text-[10px]">Vencida</Badge>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            #{sale.id.slice(-8).toUpperCase()} · {toDate(sale.createdAt).toLocaleDateString("pt-BR")}
                            {due && <> · <CalendarClock className="inline w-3 h-3 -mt-0.5" /> vence {due.toLocaleDateString("pt-BR")}</>}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-amber-400">{formatCurrency(saleOutstanding(sale))}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">de {formatCurrency(sale.total)}</p>
                        </div>
                        {isOpen
                          ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                          : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-2">
                              {/* Resumo financeiro */}
                              <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-[var(--color-bg-overlay)] py-2">
                                  <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(sale.total)}</p>
                                  <p className="text-[10px] text-[var(--color-text-muted)]">Total</p>
                                </div>
                                <div className="rounded-lg bg-[var(--color-bg-overlay)] py-2">
                                  <p className="text-sm font-bold text-[var(--color-neon-blue)]">{formatCurrency(saleReceivedAmount(sale))}</p>
                                  <p className="text-[10px] text-[var(--color-text-muted)]">Recebido</p>
                                </div>
                                <div className="rounded-lg bg-[var(--color-bg-overlay)] py-2">
                                  <p className="text-sm font-bold text-amber-400">{formatCurrency(saleOutstanding(sale))}</p>
                                  <p className="text-[10px] text-[var(--color-text-muted)]">A receber</p>
                                </div>
                              </div>

                              {/* Itens */}
                              <div className="space-y-1">
                                {sale.items.map((item) => (
                                  <div key={item.productId + (item.variationId ?? "")} className="flex items-center justify-between text-sm">
                                    <span className="text-[var(--color-text-secondary)] truncate">
                                      {item.productName}
                                      {item.variationName && <span className="text-[var(--color-neon-blue)] ml-1">· {item.variationName}</span>}
                                    </span>
                                    <span className="text-[var(--color-text-muted)] shrink-0 ml-2">{item.quantity} × {formatCurrency(item.price)}</span>
                                  </div>
                                ))}
                              </div>

                              {/* Histórico de recebimentos */}
                              {sale.payments && sale.payments.length > 0 && (
                                <div className="pt-1.5 border-t border-[var(--color-border)]/60">
                                  <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] mb-1">
                                    <History className="w-3.5 h-3.5" /> Recebimentos
                                  </p>
                                  {sale.payments.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                                      <span>{toDate(p.receivedAt).toLocaleDateString("pt-BR")} · {PAYMENT_LABELS[p.method]}</span>
                                      <span className="font-medium text-[var(--color-neon-blue)]">+{formatCurrency(p.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {sale.notes && (
                                <p className="text-xs text-[var(--color-text-muted)]">Obs.: {sale.notes}</p>
                              )}

                              {/* Ações */}
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  onClick={() => openPayDialog(sale)}
                                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--color-neon-blue)]/40 bg-[var(--color-neon-blue-glow)] text-xs font-medium text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)]/20 transition-colors"
                                >
                                  <CircleDollarSign className="w-3.5 h-3.5" /> Receber parcial
                                </button>
                                <button
                                  onClick={() => handleSettle(sale)}
                                  disabled={settlingId === sale.id}
                                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                                >
                                  {settlingId === sale.id
                                    ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                    : <><CheckCircle className="w-3.5 h-3.5" /> Quitar total</>}
                                </button>
                                {isAdmin && (
                                  <button
                                    onClick={() => { setCancelTarget(sale); setCancelReason(""); }}
                                    className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                                  >
                                    <Ban className="w-3.5 h-3.5" /> Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Diálogo: recebimento parcial */}
      <Dialog open={!!payTarget} onOpenChange={(v) => { if (!paySaving && !v) { setPayTarget(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-neon-blue)]">
              <CircleDollarSign className="w-5 h-5" /> Registrar recebimento
            </DialogTitle>
            <DialogDescription>
              {payTarget && (
                <>{payTarget.customerName ?? "Cliente"} · em aberto <strong className="text-amber-400">{formatCurrency(saleOutstanding(payTarget))}</strong>.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Valor recebido — R$</label>
              <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Forma</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPayMethod(opt.value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                      payMethod === opt.value
                        ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setPayTarget(null); setPayAmount(""); }} disabled={paySaving}>Cancelar</Button>
            <Button variant="premium" onClick={handleRegisterPayment} disabled={paySaving || !(parseMoney(payAmount) > 0)}>
              {paySaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: cancelar cobrança */}
      <Dialog open={!!cancelTarget} onOpenChange={(v) => { if (!cancelSaving && !v) { setCancelTarget(null); setCancelReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Ban className="w-5 h-5" /> Cancelar cobrança
            </DialogTitle>
            <DialogDescription>
              {cancelTarget && (
                <>Venda #{cancelTarget.id.slice(-8).toUpperCase()} ({formatCurrency(cancelTarget.total)}). O estoque será estornado e os pontos revertidos.
                {saleReceivedAmount(cancelTarget) > 0 && (
                  <> Havia <strong className="text-amber-400">{formatCurrency(saleReceivedAmount(cancelTarget))}</strong> recebido — registre a devolução, se houver.</>
                )}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Motivo</label>
            <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex.: desistência do cliente..." className={inputCls} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setCancelTarget(null); setCancelReason(""); }} disabled={cancelSaving}>Voltar</Button>
            <Button variant="default" className="bg-red-500 hover:bg-red-600 text-white border-0" onClick={handleCancel} disabled={cancelSaving || !cancelReason.trim()}>
              {cancelSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Cancelar cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
