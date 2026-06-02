"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Minus, Trash2, Search, ShoppingCart,
  History, Download, Receipt, TrendingUp, Package,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { getProducts } from "@/lib/firebase/products";
import { getSales, createSale, exportSalesCSV } from "@/lib/firebase/sales";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import type { Product, ProductVariation, Sale, SaleItem, SalePaymentMethod } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v === "string") return new Date(v);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(0);
}

const PAYMENT_OPTIONS: { value: SalePaymentMethod; label: string; color: string }[] = [
  { value: "cash", label: "Dinheiro", color: "text-emerald-400" },
  { value: "pix", label: "Pix", color: "text-[var(--color-neon-blue)]" },
  { value: "card", label: "Cartão", color: "text-purple-400" },
];

const PAYMENT_LABELS: Record<SalePaymentMethod, string> = {
  cash: "Dinheiro",
  pix: "Pix",
  card: "Cartão",
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminSales() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"new" | "history">("new");

  /* ── Products catalogue ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState("");

  /* ── Current sale ── */
  const [items, setItems] = useState<SaleItem[]>([]);
  const [payment, setPayment] = useState<SalePaymentMethod>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  /* ── History ── */
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const all = await getProducts();
      setProducts(all.filter(p => p.active));
    } catch {
      toast.error("Não foi possível carregar os produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadHistory = useCallback(async (start?: string, end?: string) => {
    setLoadingHistory(true);
    try {
      setSales(await getSales(
        start ? new Date(start) : undefined,
        end ? new Date(end) : undefined,
      ));
    } catch {
      toast.error("Não foi possível carregar o histórico de vendas.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => {
    if (tab === "history") loadHistory(startDate, endDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  /* ── Derived ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      (p.variations ?? []).some(v => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
    );
  }, [products, search]);

  /* ── Leitor de código de barras (só na aba de venda) ──
     Bipou → procura o produto pelo SKU exato e adiciona ao carrinho.
     Não achou → joga o código no campo de busca para o vendedor conferir. */
  useBarcodeScanner((code) => {
    const target = code.toLowerCase();
    // 1) tenta achar uma VARIAÇÃO pelo código de barras.
    for (const p of products) {
      const v = p.variations?.find(vr => vr.sku && vr.sku.toLowerCase() === target);
      if (v) {
        if (v.stock <= 0) {
          toast.error(`"${p.name} - ${v.name}" está sem estoque.`);
          return;
        }
        addItem(p, v);
        setSearch("");
        toast.success(`${p.name} - ${v.name} adicionado.`);
        return;
      }
    }
    // 2) produto simples pelo SKU.
    const match = products.find(p => p.sku && p.sku.toLowerCase() === target);
    if (!match) {
      setSearch(code);
      toast.error(`Nenhum produto com o código ${code}.`);
      return;
    }
    if (match.stock <= 0) {
      toast.error(`"${match.name}" está sem estoque.`);
      return;
    }
    addItem(match);
    setSearch("");
    toast.success(`${match.name} adicionado.`);
  }, { enabled: tab === "new" });

  const total = useMemo(() =>
    items.reduce((s, i) => s + i.subtotal, 0), [items]);

  const historyTotal = useMemo(() =>
    sales.reduce((s, sale) => s + sale.total, 0), [sales]);

  /* ── Item management ──
     Cada linha é identificada por produto + variação (productId + variationId).
     Produtos com grade são adicionados por variação; simples, direto. */
  function lineStock(product: Product, variationId?: string): number {
    if (variationId) return product.variations?.find(v => v.id === variationId)?.stock ?? 0;
    return product.stock;
  }

  function addItem(product: Product, variation?: ProductVariation) {
    const vId = variation?.id ?? "";
    const stock = variation ? variation.stock : product.stock;
    const label = variation ? `${product.name} - ${variation.name}` : product.name;
    const current = items.find(i => i.productId === product.id && (i.variationId ?? "") === vId)?.quantity ?? 0;
    if (current >= stock) {
      toast.error(`Estoque insuficiente para "${label}" (disponível: ${stock} un).`);
      return;
    }
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.id && (i.variationId ?? "") === vId);
      if (existing) {
        return prev.map(i =>
          i.productId === product.id && (i.variationId ?? "") === vId
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
            : i
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        sku: variation?.sku ?? product.sku,
        category: product.category,
        price: product.price,
        quantity: 1,
        subtotal: product.price,
        ...(variation ? { variationId: variation.id, variationName: variation.name } : {}),
      }];
    });
  }

  function changeQty(productId: string, variationId: string | undefined, delta: number) {
    const vId = variationId ?? "";
    if (delta > 0) {
      const product = products.find(p => p.id === productId);
      const item = items.find(i => i.productId === productId && (i.variationId ?? "") === vId);
      const stock = product ? lineStock(product, variationId) : 0;
      if (item && item.quantity >= stock) {
        const label = item.variationName ? `${item.productName} - ${item.variationName}` : item.productName;
        toast.error(`Estoque máximo de "${label}": ${stock} un.`);
        return;
      }
    }
    setItems(prev =>
      prev
        .map(i => {
          if (!(i.productId === productId && (i.variationId ?? "") === vId)) return i;
          const qty = Math.max(0, i.quantity + delta);
          return { ...i, quantity: qty, subtotal: qty * i.price };
        })
        .filter(i => i.quantity > 0)
    );
  }

  function removeItem(productId: string, variationId?: string) {
    const vId = variationId ?? "";
    setItems(prev => prev.filter(i => !(i.productId === productId && (i.variationId ?? "") === vId)));
  }

  /* ── Save sale ── */
  async function handleSave() {
    if (!items.length || !user) return;
    // Trava final: bloqueia a venda se algum item exceder o estoque atual.
    const over = items.find(i => {
      const p = products.find(pp => pp.id === i.productId);
      return !p || i.quantity > lineStock(p, i.variationId);
    });
    if (over) {
      const p = products.find(pp => pp.id === over.productId);
      const stock = p ? lineStock(p, over.variationId) : 0;
      const label = over.variationName ? `${over.productName} - ${over.variationName}` : over.productName;
      toast.error(`Estoque insuficiente para "${label}" (disponível: ${stock} un).`);
      return;
    }
    setSaving(true);
    setSavedId(null);
    try {
      const id = await createSale({
        sellerId: user.uid,
        sellerName: user.displayName ?? "Vendedor",
        items,
        total,
        paymentMethod: payment,
        notes: notes.trim() || undefined,
      });
      setSavedId(id.slice(-8).toUpperCase());
      toast.success("Venda registrada com sucesso!");
      setItems([]);
      setNotes("");
      setPayment("cash");
      await loadProducts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[createSale]", err);
      toast.error(`Erro ao registrar venda: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  /* ── Export ── */
  function handleExport() {
    try {
      const label = startDate && endDate
        ? `vendas_${startDate}_${endDate}`
        : `vendas_${new Date().toISOString().slice(0, 10)}`;
      exportSalesCSV(sales, `${label}.csv`);
      toast.success(`${sales.length} venda${sales.length !== 1 ? "s" : ""} exportada${sales.length !== 1 ? "s" : ""}!`);
    } catch {
      toast.error("Erro ao gerar o arquivo CSV.");
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Vendas"
          subtitle="Registre vendas e exporte relatórios"
        />

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-[var(--color-border)] pb-0">
          {[
            { key: "new", label: "Nova Venda", icon: ShoppingCart },
            { key: "history", label: "Histórico", icon: History },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key as "new" | "history")}
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

        {/* ── NEW SALE TAB ── */}
        {tab === "new" && (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Product catalogue */}
            <div className="lg:col-span-3 space-y-4">
              <Input
                placeholder="Buscar produto por nome ou SKU..."
                icon={<Search className="w-4 h-4" />}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              {loadingProducts ? (
                <div className="flex justify-center py-10">
                  <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center py-12 gap-2">
                    <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                    <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto encontrado.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {filtered.map(p => {
                    const hasVars = (p.variations?.length ?? 0) > 0;
                    const thumb = (
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                        {p.images?.[0]
                          ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                          : <Package className="w-4 h-4 text-[var(--color-text-muted)]" />
                        }
                      </div>
                    );

                    // Produto com grade: card com chips por variação (bipa ou clica).
                    if (hasVars) {
                      return (
                        <div key={p.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
                          <div className="flex items-center gap-3 mb-2">
                            {thumb}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {formatCurrency(p.price)} · {p.stock} un. no total
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {p.variations!.map(v => {
                              const inCartV = items.find(i => i.productId === p.id && i.variationId === v.id);
                              const out = v.stock <= 0;
                              return (
                                <button
                                  key={v.id}
                                  onClick={() => !out && addItem(p, v)}
                                  disabled={out}
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    out
                                      ? "opacity-40 cursor-not-allowed border-[var(--color-border)] text-[var(--color-text-muted)]"
                                      : inCartV
                                      ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                      : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon-blue)]/50"
                                  }`}
                                >
                                  {v.name} <span className="opacity-70">({v.stock})</span>
                                  {inCartV && <span className="ml-1 font-bold">·{inCartV.quantity}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }

                    // Produto simples: clique adiciona.
                    const inCart = items.find(i => i.productId === p.id && !i.variationId);
                    return (
                      <button
                        key={p.id}
                        onClick={() => p.stock > 0 && addItem(p)}
                        disabled={p.stock === 0}
                        className={`text-left rounded-xl border p-3 transition-all flex items-center gap-3 ${
                          p.stock === 0
                            ? "opacity-40 cursor-not-allowed border-[var(--color-border)]"
                            : inCart
                            ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)]"
                            : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-neon-blue)]/50 hover:bg-[var(--color-bg-overlay)]"
                        }`}
                      >
                        {thumb}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{p.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {formatCurrency(p.price)} · {p.stock === 0 ? "Sem estoque" : `${p.stock} un.`}
                          </p>
                        </div>
                        {inCart && (
                          <Badge variant="premium" className="text-xs shrink-0">{inCart.quantity}</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cart / sale summary */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="lg:sticky lg:top-28">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt className="w-4 h-4" />
                    Venda Atual
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Success banner */}
                  <AnimatePresence>
                    {savedId && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2.5 text-sm text-emerald-400"
                      >
                        Venda <strong>#{savedId}</strong> registrada!
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {items.length === 0 ? (
                    <p className="text-sm text-[var(--color-text-muted)] text-center py-6">
                      Selecione produtos ao lado para adicionar.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {items.map(item => (
                        <div
                          key={`${item.productId}:${item.variationId ?? ""}`}
                          className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-2.5"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                              {item.productName}
                              {item.variationName && <span className="text-[var(--color-neon-blue)]"> · {item.variationName}</span>}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(item.price)} × {item.quantity}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => changeQty(item.productId, item.variationId, -1)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-bold text-[var(--color-text-primary)] w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => changeQty(item.productId, item.variationId, 1)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeItem(item.productId, item.variationId)}
                              className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 text-[var(--color-text-muted)] hover:text-red-400 transition-colors ml-1"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-sm font-bold text-[var(--color-neon-blue)] shrink-0 w-16 text-right">
                            {formatCurrency(item.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Payment method */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Pagamento</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PAYMENT_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setPayment(opt.value)}
                          className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                            payment === opt.value
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide block mb-2">Observações</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Opcional..."
                      className={inputCls + " resize-none"}
                    />
                  </div>

                  {/* Total + button */}
                  <div className="border-t border-[var(--color-border)] pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">Total</span>
                      <span className="text-2xl font-black text-[var(--color-neon-blue)]">{formatCurrency(total)}</span>
                    </div>
                    <Button
                      variant="premium"
                      className="w-full"
                      disabled={items.length === 0 || saving}
                      onClick={handleSave}
                    >
                      {saving
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><Receipt className="w-4 h-4" /> Registrar Venda</>
                      }
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div className="space-y-6">
            {/* Filters */}
            <Card>
              <CardContent className="p-4 flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">De</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Até</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <Button variant="secondary" onClick={() => loadHistory(startDate, endDate)}>
                  Filtrar
                </Button>
                <Button
                  variant="premium"
                  disabled={sales.length === 0}
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4" /> Exportar CSV
                </Button>
              </CardContent>
            </Card>

            {/* Stats */}
            {!loadingHistory && sales.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--color-neon-blue-glow)] flex items-center justify-center">
                      <Receipt className="w-4 h-4 text-[var(--color-neon-blue)]" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-[var(--color-text-primary)]">{sales.length}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Vendas no período</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-[var(--color-text-primary)]">{formatCurrency(historyTotal)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">Total vendido</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xl font-black text-[var(--color-text-primary)]">
                        {formatCurrency(historyTotal / sales.length)}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">Ticket médio</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Sales list */}
            {loadingHistory ? (
              <div className="flex justify-center py-16">
                <div className="w-7 h-7 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
              </div>
            ) : sales.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-14 gap-2">
                  <History className="w-8 h-8 text-[var(--color-text-muted)]" />
                  <p className="text-sm text-[var(--color-text-muted)]">Nenhuma venda no período selecionado.</p>
                </CardContent>
              </Card>
            ) : (
              <motion.div className="space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {sales.map((sale, i) => {
                  const date = toDate(sale.createdAt);
                  const isOpen = expanded === sale.id;
                  return (
                    <motion.div
                      key={sale.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.025 }}
                    >
                      <Card>
                        <CardContent className="p-0">
                          <button
                            onClick={() => setExpanded(isOpen ? null : sale.id)}
                            className="w-full p-4 flex items-center gap-4 text-left hover:bg-[var(--color-bg-hover)] transition-colors rounded-xl"
                          >
                            <div className="text-center shrink-0 w-14">
                              <p className="text-sm font-bold text-[var(--color-text-primary)]">
                                {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                              </p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-[var(--color-text-muted)]">
                                  #{sale.id.slice(-8).toUpperCase()}
                                </span>
                                <span className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                  {sale.sellerName}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                {sale.items.length} {sale.items.length === 1 ? "item" : "itens"} · {PAYMENT_LABELS[sale.paymentMethod]}
                                {sale.notes && ` · ${sale.notes}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-[var(--color-neon-blue)]">{formatCurrency(sale.total)}</span>
                              {isOpen
                                ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                                : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                              }
                            </div>
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
                                <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-3 space-y-1.5">
                                  {sale.items.map(item => (
                                    <div
                                      key={item.productId}
                                      className="flex items-center justify-between text-sm"
                                    >
                                      <span className="text-[var(--color-text-secondary)]">
                                        {item.productName}
                                        {item.variationName && <span className="text-[var(--color-neon-blue)] ml-1">· {item.variationName}</span>}
                                        {item.sku && <span className="text-[var(--color-text-muted)] ml-1">({item.sku})</span>}
                                      </span>
                                      <span className="text-[var(--color-text-muted)]">
                                        {item.quantity} × {formatCurrency(item.price)} = {" "}
                                        <span className="text-[var(--color-text-primary)] font-semibold">{formatCurrency(item.subtotal)}</span>
                                      </span>
                                    </div>
                                  ))}
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
        )}
      </div>
    </div>
  );
}
