"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, RefreshCw, Wrench, Package, ChevronDown, ChevronUp, Wallet, TrendingUp, Boxes, Search, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getProducts } from "@/lib/firebase/products";
import { getStockMovements, addStockMovement } from "@/lib/firebase/inventory";
import { getAllUsers } from "@/lib/firebase/users";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Product, StockMovement, MovementType } from "@/types";

const MOVEMENT_CONFIG: Record<MovementType, { label: string; icon: React.ElementType; color: string; badge: "success" | "destructive" | "default" | "warning" }> = {
  in:         { label: "Entrada",  icon: ArrowDown,  color: "text-emerald-400", badge: "success" },
  out:        { label: "Saída",    icon: ArrowUp,    color: "text-red-400",     badge: "destructive" },
  adjustment: { label: "Ajuste",   icon: RefreshCw,  color: "text-blue-400",    badge: "default" },
  loss:       { label: "Perda",    icon: Wrench,     color: "text-amber-400",   badge: "warning" },
};

const inputCls = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

const EMPTY_FORM = { productId: "", variationId: "", type: "in" as MovementType, quantity: 1, reason: "" };

export default function AdminInventory() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  /* Quais produtos com grade estão expandidos na lista de estoque. */
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  /* Busca dentro da lista de estoque (nome, SKU ou variação). */
  const [stockSearch, setStockSearch] = useState("");
  /* Visão da lista de estoque: todos os produtos × só os críticos × movimentações. */
  const [stockView, setStockView] = useState<"all" | "critical" | "movements">("all");
  /* Filtro das movimentações recentes por tipo (todas/entrada/saída/ajuste/perda). */
  const [moveFilter, setMoveFilter] = useState<"all" | MovementType>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, movs] = await Promise.all([getProducts(), getStockMovements()]);
      setProducts(prods);
      setMovements(movs);
      // Resolve os nomes de quem movimentou (best-effort; sem permissão é ignorado).
      try {
        const users = await getAllUsers();
        setUserNames(Object.fromEntries(users.map(u => [u.uid, u.displayName])));
      } catch { /* segue sem nomes */ }
    } catch {
      toast.error("Não foi possível carregar os dados de estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(key: keyof typeof form, value: unknown) {
    // Trocar de produto zera a variação selecionada (grades diferentes).
    if (key === "productId") {
      setForm(f => ({ ...f, productId: value as string, variationId: "" }));
      return;
    }
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId || !form.quantity || !form.reason) return;
    const product = products.find(p => p.id === form.productId);
    if (!product) return;
    const hasVars = (product.variations?.length ?? 0) > 0;
    if (hasVars && !form.variationId) {
      toast.error("Selecione a variação do produto.");
      return;
    }
    setSaving(true);
    try {
      const variation = product.variations?.find(v => v.id === form.variationId);
      await addStockMovement({
        productId: form.productId,
        productName: product.name,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason,
        userId: user!.uid,
        ...(variation ? { variationId: variation.id, variationName: variation.name } : {}),
      });
      toast.success("Movimentação registrada!");
      setForm(EMPTY_FORM);
      await load();
    } catch {
      toast.error("Erro ao registrar movimentação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  /* Indicadores financeiros do estoque — derivados dos próprios produtos (custo e
     preço já cadastrados). Recalculam sozinhos a cada cadastro/venda/reposição,
     pois `products` é recarregado após cada movimentação e a venda/checkout
     invalidam o cache de produtos. */
  const stockValue = useMemo(() => {
    let units = 0, cost = 0, sale = 0;
    for (const p of products) {
      const qty = p.stock ?? 0;
      units += qty;
      cost += qty * (p.costPrice ?? 0);
      sale += qty * (p.price ?? 0);
    }
    return { units, cost, sale };
  }, [products]);

  /* Lista filtrada pela busca (nome, SKU do produto ou nome/SKU de variação). */
  const filteredProducts = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku?.toLowerCase().includes(q) ?? false) ||
      (p.variations ?? []).some(v =>
        v.name.toLowerCase().includes(q) || (v.sku?.toLowerCase().includes(q) ?? false),
      ),
    );
  }, [products, stockSearch]);

  const lowStock = products.filter(p => p.active && p.stock <= p.minStock);
  /* Críticos filtrados pela mesma busca (nome ou SKU). */
  const filteredLowStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return lowStock;
    return lowStock.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku?.toLowerCase().includes(q) ?? false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, stockSearch]);
  /* Movimentações filtradas pelo tipo selecionado. */
  const filteredMovements = useMemo(
    () => (moveFilter === "all" ? movements : movements.filter(m => m.type === moveFilter)),
    [movements, moveFilter],
  );
  const selected = products.find(p => p.id === form.productId);
  const selectedHasVars = (selected?.variations?.length ?? 0) > 0;
  const selectedVariation = selected?.variations?.find(v => v.id === form.variationId);
  /* Estoque-base para o preview (variação selecionada ou produto simples). */
  const previewStock = selectedHasVars ? (selectedVariation?.stock ?? 0) : (selected?.stock ?? 0);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Estoque"
          subtitle={`${products.length} produtos · ${lowStock.length} abaixo do mínimo`}
        />

        {/* Indicadores financeiros do estoque (capital investido × potencial de venda) */}
        {!loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
          >
            {[
              {
                label: "Estoque (custo)",
                hint: "Capital investido em mercadorias",
                value: formatCurrency(stockValue.cost),
                icon: Wallet,
                color: "text-amber-400",
                bg: "bg-amber-500/10",
              },
              {
                label: "Estoque (valor de venda)",
                hint: "Faturamento potencial da loja",
                value: formatCurrency(stockValue.sale),
                icon: TrendingUp,
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
              },
              {
                label: "Quantidade total",
                hint: `${products.length} produto${products.length !== 1 ? "s" : ""} em estoque`,
                value: `${stockValue.units.toLocaleString("pt-BR")} un.`,
                icon: Boxes,
                color: "text-[var(--color-neon-blue)]",
                bg: "bg-[var(--color-neon-blue-glow)]",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{card.value}</p>
                      <p className="text-xs font-medium text-[var(--color-text-secondary)]">{card.label}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{card.hint}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lista de estoque com seletor de visão (Todos × Críticos) */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader className="pb-0 gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Seletor: Todos os Produtos × Estoque Crítico */}
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStockView("all")}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                            stockView === "all"
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          <Package className="w-4 h-4" /> Todos os Produtos
                          <span className="text-xs opacity-70">{products.length}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockView("critical")}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                            stockView === "critical"
                              ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-amber-500/40"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" /> Estoque Crítico
                          <span className={`text-xs font-bold ${lowStock.length > 0 ? "text-amber-400" : "opacity-70"}`}>{lowStock.length}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setStockView("movements")}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                            stockView === "movements"
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          <RefreshCw className="w-4 h-4" /> Movimentação Recente
                          <span className="text-xs opacity-70">{movements.length}</span>
                        </button>
                      </div>
                      {/* Busca rápida na lista de estoque (só nas visões de produtos) */}
                      {stockView !== "movements" && (
                        <div className="relative w-full sm:max-w-[220px]">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
                          <input
                            value={stockSearch}
                            onChange={e => setStockSearch(e.target.value)}
                            placeholder="Buscar produto..."
                            className="w-full h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] pl-8 pr-8 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-colors"
                          />
                          {stockSearch && (
                            <button
                              onClick={() => setStockSearch("")}
                              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                              aria-label="Limpar busca"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Filtro por tipo — só na visão de movimentações */}
                    {stockView === "movements" && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setMoveFilter("all")}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            moveFilter === "all"
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          Todas <span className="opacity-70">{movements.length}</span>
                        </button>
                        {(Object.keys(MOVEMENT_CONFIG) as MovementType[]).map(t => {
                          const cfg = MOVEMENT_CONFIG[t];
                          const Icon = cfg.icon;
                          const count = movements.filter(m => m.type === t).length;
                          const active = moveFilter === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setMoveFilter(t)}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                active
                                  ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-neon-blue)]/40"
                              }`}
                            >
                              <Icon className={`w-3.5 h-3.5 ${active ? "" : cfg.color}`} />
                              {cfg.label} <span className="opacity-70">{count}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-4">
                    {/* ── Visão: Movimentação Recente ── */}
                    {stockView === "movements" ? (
                      movements.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Nenhuma movimentação ainda.</p>
                      ) : filteredMovements.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Nenhuma movimentação do tipo “{MOVEMENT_CONFIG[moveFilter as MovementType].label}”.</p>
                      ) : (
                        filteredMovements.slice(0, 20).map((m, i) => {
                          const cfg = MOVEMENT_CONFIG[m.type];
                          const Icon = cfg.icon;
                          const isPositive = m.type === "in" || m.type === "adjustment";
                          const who = userNames[m.userId];
                          return (
                            <div key={m.id}>
                              <div className="flex items-center gap-3 py-2.5">
                                <div className={`w-8 h-8 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center shrink-0 ${cfg.color}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">
                                    {m.productName}
                                    {m.variationName && <span className="text-[var(--color-neon-blue)]"> · {m.variationName}</span>}
                                  </p>
                                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                                    {m.reason}
                                    {who && <> · por <span className="text-[var(--color-text-secondary)]">{who}</span></>}
                                    {m.createdAt && ` · ${formatDateTime(m.createdAt)}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                  <span className={`text-sm font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                                    {isPositive ? "+" : "-"}{m.quantity}
                                  </span>
                                </div>
                              </div>
                              {i < Math.min(filteredMovements.length, 20) - 1 && <Separator />}
                            </div>
                          );
                        })
                      )
                    ) : /* ── Visão: Estoque Crítico ── */
                    stockView === "critical" ? (
                      lowStock.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-2">
                          <Package className="w-8 h-8 text-emerald-400" />
                          <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto em estoque crítico. 🎉</p>
                        </div>
                      ) : filteredLowStock.length === 0 ? (
                        <div className="flex flex-col items-center py-8 gap-2">
                          <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
                          <p className="text-sm text-[var(--color-text-muted)]">Nenhum crítico encontrado para “{stockSearch}”.</p>
                        </div>
                      ) : (
                        filteredLowStock.map((p, i) => {
                          const pct = Math.min(Math.round((p.stock / Math.max(1, p.minStock)) * 100), 100);
                          return (
                            <div key={p.id}>
                              <div className="flex items-center justify-between py-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{p.name}</p>
                                  <p className="text-xs text-[var(--color-text-muted)]">SKU: {p.sku || "—"}</p>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                  <span className={`text-sm font-bold ${p.stock <= 0 ? "text-red-400" : "text-amber-400"}`}>{p.stock} un.</span>
                                  <p className="text-xs text-[var(--color-text-muted)]">mín: {p.minStock}</p>
                                </div>
                              </div>
                              <div className="h-1.5 rounded-full bg-[var(--color-bg-overlay)] mb-1">
                                <div
                                  className={`h-full rounded-full transition-all ${p.stock <= 0 ? "bg-red-400/70" : "bg-amber-400/70"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {i < filteredLowStock.length - 1 && <Separator className="mt-2" />}
                            </div>
                          );
                        })
                      )
                    ) : /* ── Visão: Todos os Produtos ── */
                    products.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                        <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto cadastrado.</p>
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Search className="w-8 h-8 text-[var(--color-text-muted)]" />
                        <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto encontrado para “{stockSearch}”.</p>
                      </div>
                    ) : (
                      filteredProducts.map((p, i) => {
                        const vars = p.variations ?? [];
                        const hasVars = vars.length > 0;
                        const isOpen = !!expandedProducts[p.id];
                        return (
                        <div key={p.id}>
                          <button
                            type="button"
                            disabled={!hasVars}
                            onClick={() => hasVars && setExpandedProducts(prev => ({ ...prev, [p.id]: !prev[p.id] }))}
                            className={`w-full flex items-center justify-between py-2.5 text-left rounded-lg ${hasVars ? "hover:bg-[var(--color-bg-hover)] -mx-2 px-2 transition-colors" : ""}`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate flex items-center gap-1.5">
                                {p.name}
                                {hasVars && (
                                  isOpen
                                    ? <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                                )}
                              </p>
                              <p className="text-xs text-[var(--color-text-muted)]">
                                {hasVars ? `${vars.length} variaç${vars.length === 1 ? "ão" : "ões"}` : `SKU: ${p.sku || "—"}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {p.stock <= p.minStock
                                ? <Badge variant="warning">Crítico</Badge>
                                : <Badge variant="success">OK</Badge>
                              }
                              <span className="text-sm font-bold text-[var(--color-text-primary)] w-16 text-right">
                                {p.stock} un.
                              </span>
                            </div>
                          </button>

                          {/* Variantes / grade do produto */}
                          {hasVars && isOpen && (
                            <div className="pl-3 ml-1 mb-2 border-l-2 border-[var(--color-border)] space-y-1.5">
                              {vars.map(v => (
                                <div key={v.id} className="flex items-center justify-between gap-2 py-1">
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-[var(--color-text-secondary)] truncate">{v.name}</p>
                                    <p className="text-[10px] text-[var(--color-text-muted)]">SKU: {v.sku || "—"}</p>
                                  </div>
                                  <span className={`text-xs font-bold shrink-0 ${v.stock <= 0 ? "text-red-400" : "text-[var(--color-text-primary)]"}`}>
                                    {v.stock} un.
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {i < filteredProducts.length - 1 && <Separator />}
                        </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Right column — movement form */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="lg:sticky lg:top-28">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base">Registrar Movimentação</CardTitle>
                </CardHeader>
                <CardContent className="pt-5">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Produto *</label>
                      <select
                        value={form.productId}
                        onChange={e => set("productId", e.target.value)}
                        required
                        className={inputCls}
                      >
                        <option value="">Selecionar produto</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} (estoque: {p.stock})</option>
                        ))}
                      </select>
                    </div>

                    {/* Variação — só quando o produto tem grade */}
                    {selectedHasVars && (
                      <div>
                        <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Variação *</label>
                        <select
                          value={form.variationId}
                          onChange={e => set("variationId", e.target.value)}
                          required
                          className={inputCls}
                        >
                          <option value="">Selecionar variação</option>
                          {selected!.variations!.map(v => (
                            <option key={v.id} value={v.id}>{v.name} (estoque: {v.stock})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Tipo *</label>
                      <select
                        value={form.type}
                        onChange={e => set("type", e.target.value as MovementType)}
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
                        type="number"
                        min="1"
                        value={form.quantity}
                        onChange={e => set("quantity", Number(e.target.value))}
                        required
                        className={inputCls}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Motivo *</label>
                      <input
                        value={form.reason}
                        onChange={e => set("reason", e.target.value)}
                        placeholder="Ex: Compra do fornecedor, venda avulsa..."
                        required
                        className={inputCls}
                      />
                    </div>

                    {selected && (!selectedHasVars || selectedVariation) && (
                      <div className="rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] p-3">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">
                          Estoque após movimentação
                          {selectedVariation && <span className="text-[var(--color-neon-blue)]"> · {selectedVariation.name}</span>}
                        </p>
                        <p className="text-lg font-black text-[var(--color-text-primary)]">
                          {form.type === "in" || form.type === "adjustment"
                            ? previewStock + Number(form.quantity || 0)
                            : Math.max(0, previewStock - Number(form.quantity || 0))
                          } <span className="text-sm font-normal text-[var(--color-text-muted)]">un.</span>
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">Atual: {previewStock} un.</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="premium"
                      className="w-full"
                      disabled={saving || !form.productId || !form.quantity || !form.reason || (selectedHasVars && !form.variationId)}
                    >
                      {saving
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : "Registrar"
                      }
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
