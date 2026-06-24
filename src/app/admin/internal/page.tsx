"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Package, Plus, Pencil, Trash2, Search, Boxes, Wallet, TrendingUp,
  ArrowDown, ArrowUp, RefreshCw, Wrench, CircleDollarSign, CheckCircle,
  User, Ban, Lock, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { formatCurrency, formatDateTime, slugify } from "@/lib/utils";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/firebase/products";
import { getStockMovements, addStockMovement } from "@/lib/firebase/inventory";
import { getCategories } from "@/lib/firebase/categories";
import {
  getReceivables, registerSalePayment, markSalePaid, cancelSale,
} from "@/lib/firebase/sales";
import { SALE_PAYMENT_STATUS_LABELS, SALE_PAYMENT_STATUS_BADGE } from "@/lib/payments/labels";
import { saleOutstanding, saleStatus } from "@/lib/sales/helpers";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Product, StockMovement, MovementType, Category, Sale, SalePaymentMethod } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v === "string") return new Date(v);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(0);
}

/** "12,50" / "12.50" → número (0 quando inválido). */
function parseMoney(v: string): number {
  const n = parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

const MOVEMENT_CONFIG: Record<MovementType, { label: string; icon: React.ElementType; color: string; badge: "success" | "destructive" | "default" | "warning" }> = {
  in:         { label: "Entrada", icon: ArrowDown, color: "text-emerald-400", badge: "success" },
  out:        { label: "Saída",   icon: ArrowUp,   color: "text-red-400",     badge: "destructive" },
  adjustment: { label: "Ajuste",  icon: RefreshCw, color: "text-blue-400",    badge: "default" },
  loss:       { label: "Perda",   icon: Wrench,    color: "text-amber-400",   badge: "warning" },
};

const PAYMENT_OPTIONS: { value: SalePaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "credit", label: "Crédito" },
  { value: "debit", label: "Débito" },
];

const EMPTY_PRODUCT = {
  name: "", sku: "", category: "", price: "", costPrice: "",
  stock: "0", minStock: "5", active: true,
};

type Tab = "products" | "stock" | "receivables";

export default function AdminInternalArea() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const isAdmin = user?.role === "admin";

  /* ── Acesso restrito: SOMENTE admin. Vendedor é redirecionado. ── */
  useEffect(() => {
    if (!authLoading && user && !isAdmin) router.replace("/admin/seller");
  }, [authLoading, user, isAdmin, router]);

  const [tab, setTab] = useState<Tab>("products");

  /* ── Dados ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Cadastro/edição de produto interno ── */
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Movimentação de estoque ── */
  const [moveForm, setMoveForm] = useState({ productId: "", type: "in" as MovementType, quantity: "1", reason: "" });
  const [moveSaving, setMoveSaving] = useState(false);

  /* ── Contas a receber ── */
  const [receivables, setReceivables] = useState<Sale[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [payTarget, setPayTarget] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<SalePaymentMethod>("cash");
  const [paySaving, setPaySaving] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Sale | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSaving, setCancelSaving] = useState(false);

  const internalProducts = useMemo(
    () => products.filter(p => p.internal === true),
    [products],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, cats, movs] = await Promise.all([
        getProducts(true), getCategories(), getStockMovements(),
      ]);
      setProducts(prods);
      setCategories(cats);
      setMovements(movs);
    } catch {
      toast.error("Não foi possível carregar a área interna.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReceivables = useCallback(async (force = false) => {
    setRecLoading(true);
    try {
      setReceivables(await getReceivables(force));
    } catch {
      toast.error("Não foi possível carregar as contas a receber.");
    } finally {
      setRecLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "receivables") loadReceivables(); }, [tab, loadReceivables]);

  /* ── Indicadores do estoque interno ── */
  const stockStats = useMemo(() => {
    let units = 0, cost = 0, sale = 0;
    for (const p of internalProducts) {
      const qty = p.stock ?? 0;
      units += qty;
      cost += qty * (p.costPrice ?? 0);
      sale += qty * (p.price ?? 0);
    }
    return { units, cost, sale };
  }, [internalProducts]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return internalProducts;
    return internalProducts.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false),
    );
  }, [internalProducts, search]);

  /* ── Produto: abrir form ── */
  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_PRODUCT, category: categories[0]?.slug ?? "" });
    setFormOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      category: p.category ?? "",
      price: p.price ? String(p.price).replace(".", ",") : "",
      costPrice: p.costPrice ? String(p.costPrice).replace(".", ",") : "",
      stock: String(p.stock ?? 0),
      minStock: String(p.minStock ?? 5),
      active: p.active,
    });
    setFormOpen(true);
  }

  async function handleSaveProduct() {
    const name = form.name.trim();
    const price = parseMoney(form.price);
    if (!name) { toast.error("Informe o nome do produto."); return; }
    if (!(price > 0)) { toast.error("Informe um preço de venda válido."); return; }
    setSaving(true);
    try {
      const cost = parseMoney(form.costPrice);
      const stock = Math.max(0, parseInt(form.stock || "0", 10) || 0);
      const minStock = Math.max(0, parseInt(form.minStock || "0", 10) || 0);
      const base = {
        name,
        category: form.category || "",
        price,
        stock,
        minStock,
        active: form.active,
        internal: true as const,
        ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
        ...(cost > 0 ? { costPrice: cost } : {}),
      };
      if (editing) {
        await updateProduct(editing.id, base);
        toast.success("Produto interno atualizado.");
      } else {
        await createProduct({
          ...base,
          slug: slugify(name),
          description: "",
          images: [],
          tags: [],
        } as Omit<Product, "id" | "createdAt" | "updatedAt">);
        toast.success("Produto interno cadastrado.");
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar o produto.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast.success("Produto removido.");
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Não foi possível remover o produto.");
    } finally {
      setDeleting(false);
    }
  }

  /* ── Estoque: registrar movimentação ── */
  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    const qty = Math.max(1, parseInt(moveForm.quantity || "0", 10) || 0);
    const product = internalProducts.find(p => p.id === moveForm.productId);
    if (!product) { toast.error("Selecione um produto."); return; }
    if (!moveForm.reason.trim()) { toast.error("Informe o motivo."); return; }
    setMoveSaving(true);
    try {
      await addStockMovement({
        productId: product.id,
        productName: product.name,
        type: moveForm.type,
        quantity: qty,
        reason: moveForm.reason.trim(),
        userId: user!.uid,
      });
      toast.success("Movimentação registrada.");
      setMoveForm({ productId: "", type: "in", quantity: "1", reason: "" });
      await load();
    } catch {
      toast.error("Não foi possível registrar a movimentação.");
    } finally {
      setMoveSaving(false);
    }
  }

  /* ── Recebíveis ── */
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
      setPayTarget(null); setPayAmount("");
      await loadReceivables(true);
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
      await loadReceivables(true);
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
      setCancelTarget(null); setCancelReason("");
      await loadReceivables(true);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível cancelar.");
    } finally {
      setCancelSaving(false);
    }
  }

  const recTotals = useMemo(() => {
    let outstanding = 0;
    for (const s of receivables) outstanding += saleOutstanding(s);
    return { outstanding, count: receivables.length };
  }, [receivables]);

  /* Guarda de acesso — não renderiza nada para não-admin (evita flash). */
  if (user && !isAdmin) return null;

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "products", label: "Produtos", icon: Package },
    { key: "stock", label: "Estoque", icon: Boxes },
    { key: "receivables", label: "A Receber", icon: CircleDollarSign },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Produtos Ocultos"
          subtitle="Área interna — visível somente para o admin. Cadastro, estoque e recebíveis."
        />

        {/* Selo de área restrita */}
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
          <Lock className="w-4 h-4 shrink-0" />
          <span>Estes produtos <strong>não aparecem na loja</strong> — uso interno do admin (estoque + PDV).</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[var(--color-border)]">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === key
                  ? "border-[var(--color-neon-blue)] text-[var(--color-neon-blue)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ── PRODUTOS ── */}
            {tab === "products" && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar produto interno..."
                      className={inputCls + " pl-9"}
                    />
                  </div>
                  <Button variant="premium" onClick={openCreate}>
                    <Plus className="w-4 h-4" /> Novo produto interno
                  </Button>
                </div>

                {filteredProducts.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center py-14 gap-2">
                      <EyeOff className="w-8 h-8 text-[var(--color-text-muted)]" />
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {internalProducts.length === 0
                          ? "Nenhum produto interno cadastrado ainda."
                          : "Nenhum produto encontrado para a busca."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <motion.div className="grid gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    {filteredProducts.map(p => (
                      <Card key={p.id}>
                        <CardContent className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
                            <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-[var(--color-text-primary)] truncate">{p.name}</span>
                              {!p.active && <Badge variant="secondary">Inativo</Badge>}
                              {p.stock <= p.minStock && <Badge variant="warning">Estoque baixo</Badge>}
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {formatCurrency(p.price)}
                              {p.costPrice ? ` · custo ${formatCurrency(p.costPrice)}` : ""}
                              {p.sku ? ` · SKU ${p.sku}` : ""}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-[var(--color-text-primary)]">{p.stock} un.</p>
                            <p className="text-[11px] text-[var(--color-text-muted)]">mín: {p.minStock}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => openEdit(p)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
                              aria-label="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              aria-label="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* ── ESTOQUE ── */}
            {tab === "stock" && (
              <div className="space-y-6">
                {/* Indicadores */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: "Estoque (custo)", value: formatCurrency(stockStats.cost), icon: Wallet, color: "text-amber-400", bg: "bg-amber-500/10" },
                    { label: "Valor de venda", value: formatCurrency(stockStats.sale), icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                    { label: "Quantidade total", value: `${stockStats.units.toLocaleString("pt-BR")} un.`, icon: Boxes, color: "text-[var(--color-neon-blue)]", bg: "bg-[var(--color-neon-blue-glow)]" },
                  ].map(card => {
                    const Icon = card.icon;
                    return (
                      <Card key={card.label}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-5 h-5 ${card.color}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{card.value}</p>
                            <p className="text-xs text-[var(--color-text-muted)]">{card.label}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Lista de estoque */}
                  <div className="lg:col-span-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Estoque dos produtos internos</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-2">
                        {internalProducts.length === 0 ? (
                          <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Nenhum produto interno cadastrado.</p>
                        ) : (
                          <div className="divide-y divide-[var(--color-border)]">
                            {internalProducts.map(p => (
                              <div key={p.id} className="flex items-center justify-between py-2.5">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{p.name}</p>
                                  <p className="text-xs text-[var(--color-text-muted)]">SKU: {p.sku || "—"}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {p.stock <= p.minStock ? <Badge variant="warning">Crítico</Badge> : <Badge variant="success">OK</Badge>}
                                  <span className="text-sm font-bold text-[var(--color-text-primary)] w-16 text-right">{p.stock} un.</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Movimentações recentes (somente dos produtos internos) */}
                        {(() => {
                          const internalIds = new Set(internalProducts.map(p => p.id));
                          const recent = movements.filter(m => internalIds.has(m.productId)).slice(0, 8);
                          if (recent.length === 0) return null;
                          return (
                            <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                              <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Movimentações recentes</p>
                              <div className="space-y-1.5">
                                {recent.map(m => {
                                  const cfg = MOVEMENT_CONFIG[m.type];
                                  const Icon = cfg.icon;
                                  const positive = m.type === "in" || m.type === "adjustment";
                                  return (
                                    <div key={m.id} className="flex items-center gap-2 text-xs">
                                      <Icon className={`w-3.5 h-3.5 shrink-0 ${cfg.color}`} />
                                      <span className="text-[var(--color-text-secondary)] truncate flex-1">{m.productName} · {m.reason}</span>
                                      <span className="text-[var(--color-text-muted)] shrink-0">{m.createdAt ? formatDateTime(m.createdAt) : ""}</span>
                                      <span className={`font-bold shrink-0 ${positive ? "text-emerald-400" : "text-red-400"}`}>{positive ? "+" : "-"}{m.quantity}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Form de movimentação */}
                  <Card className="lg:sticky lg:top-28 h-fit">
                    <CardHeader className="pb-0">
                      <CardTitle className="text-base">Registrar movimentação</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <form onSubmit={handleMovement} className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Produto *</label>
                          <select
                            value={moveForm.productId}
                            onChange={e => setMoveForm(f => ({ ...f, productId: e.target.value }))}
                            className={inputCls}
                            required
                          >
                            <option value="">Selecionar produto</option>
                            {internalProducts.map(p => (
                              <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Tipo *</label>
                          <select
                            value={moveForm.type}
                            onChange={e => setMoveForm(f => ({ ...f, type: e.target.value as MovementType }))}
                            className={inputCls}
                          >
                            {(Object.keys(MOVEMENT_CONFIG) as MovementType[]).map(t => (
                              <option key={t} value={t}>{MOVEMENT_CONFIG[t].label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Quantidade *</label>
                          <input
                            type="number" min="1"
                            value={moveForm.quantity}
                            onChange={e => setMoveForm(f => ({ ...f, quantity: e.target.value }))}
                            className={inputCls}
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Motivo *</label>
                          <input
                            value={moveForm.reason}
                            onChange={e => setMoveForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="Ex.: Compra do fornecedor..."
                            className={inputCls}
                            required
                          />
                        </div>
                        <Button type="submit" variant="premium" className="w-full" disabled={moveSaving || !moveForm.productId || !moveForm.reason.trim()}>
                          {moveSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Registrar"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* ── A RECEBER ── */}
            {tab === "receivables" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                        <CircleDollarSign className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{formatCurrency(recTotals.outstanding)}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Total a receber</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                        <CircleDollarSign className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xl font-black text-[var(--color-text-primary)]">{recTotals.count}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Cobranças em aberto</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {recLoading ? (
                  <div className="flex justify-center py-16">
                    <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
                  </div>
                ) : receivables.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center py-14 gap-2">
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                      <p className="text-sm text-[var(--color-text-muted)]">Nenhuma conta a receber. Tudo em dia! 🎉</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {receivables.map(sale => (
                      <Card key={sale.id}>
                        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                <User className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                {sale.customerName || "Cliente não vinculado"}
                              </span>
                              <Badge variant={SALE_PAYMENT_STATUS_BADGE[saleStatus(sale)]} className="text-[10px]">
                                {SALE_PAYMENT_STATUS_LABELS[saleStatus(sale)]}
                              </Badge>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                              #{sale.id.slice(-8).toUpperCase()} · {toDate(sale.createdAt).toLocaleDateString("pt-BR")}
                              {sale.dueDate && <> · vence {toDate(sale.dueDate).toLocaleDateString("pt-BR")}</>}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-amber-400">{formatCurrency(saleOutstanding(sale))}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)]">de {formatCurrency(sale.total)}</p>
                          </div>
                          <div className="flex flex-wrap gap-2 shrink-0">
                            <button
                              onClick={() => openPayDialog(sale)}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-[var(--color-neon-blue)]/40 bg-[var(--color-neon-blue-glow)] text-xs font-medium text-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue)]/20 transition-colors"
                            >
                              <CircleDollarSign className="w-3.5 h-3.5" /> Receber
                            </button>
                            <button
                              onClick={() => handleSettle(sale)}
                              disabled={settlingId === sale.id}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                            >
                              {settlingId === sale.id
                                ? <div className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                                : <><CheckCircle className="w-3.5 h-3.5" /> Quitar</>}
                            </button>
                            <button
                              onClick={() => { setCancelTarget(sale); setCancelReason(""); }}
                              className="flex items-center gap-1.5 px-3 h-8 rounded-lg border border-red-500/30 bg-red-500/10 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                            >
                              <Ban className="w-3.5 h-3.5" /> Cancelar
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Diálogo: cadastro/edição de produto interno */}
      <Dialog open={formOpen} onOpenChange={(v) => { if (!saving) setFormOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-neon-blue)]">
              <Package className="w-5 h-5" /> {editing ? "Editar produto interno" : "Novo produto interno"}
            </DialogTitle>
            <DialogDescription>
              Produto de uso interno — não aparece na loja, só no estoque e no PDV.
            </DialogDescription>
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Código de barras / SKU</label>
              <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="Opcional" className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
                <option value="">Sem categoria</option>
                {categories.map(c => <option key={c.id} value={c.slug}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Preço de venda (R$) *</label>
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} inputMode="decimal" placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Custo (R$)</label>
              <input value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} inputMode="decimal" placeholder="Opcional" className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Estoque {editing ? "" : "inicial"}</label>
              <input value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} type="number" min="0" className={inputCls} />
              {editing && <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Para entradas/saídas com histórico, use a aba Estoque.</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Estoque mínimo</label>
              <input value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))} type="number" min="0" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 accent-[var(--color-neon-blue)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">Ativo (disponível para venda no PDV)</span>
            </label>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary" disabled={saving}>Cancelar</Button>
            </DialogClose>
            <Button variant="premium" onClick={handleSaveProduct} disabled={saving || !form.name.trim() || !(parseMoney(form.price) > 0)}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editing ? "Salvar" : "Cadastrar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: excluir produto */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!deleting && !v) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" /> Excluir produto
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && <>Remover <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="default" className="bg-red-500 hover:bg-red-600 text-white border-0" onClick={handleDeleteProduct} disabled={deleting}>
              {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo: recebimento parcial */}
      <Dialog open={!!payTarget} onOpenChange={(v) => { if (!paySaving && !v) { setPayTarget(null); setPayAmount(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--color-neon-blue)]">
              <CircleDollarSign className="w-5 h-5" /> Registrar recebimento
            </DialogTitle>
            <DialogDescription>
              {payTarget && <>{payTarget.customerName ?? "Cliente"} · em aberto <strong className="text-amber-400">{formatCurrency(saleOutstanding(payTarget))}</strong>.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Valor recebido — R$</label>
              <input value={payAmount} onChange={e => setPayAmount(e.target.value)} inputMode="decimal" placeholder="0,00" className={inputCls} autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Forma</label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAYMENT_OPTIONS.map(opt => (
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
              {cancelTarget && <>Venda #{cancelTarget.id.slice(-8).toUpperCase()} ({formatCurrency(cancelTarget.total)}). O estoque será estornado e os pontos revertidos.</>}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Motivo</label>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Ex.: desistência do cliente..." className={inputCls} autoFocus />
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
