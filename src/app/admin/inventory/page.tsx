"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDown, ArrowUp, RefreshCw, Wrench, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/lib/utils";
import { getProducts } from "@/lib/firebase/products";
import { getStockMovements, addStockMovement } from "@/lib/firebase/inventory";
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

const EMPTY_FORM = { productId: "", type: "in" as MovementType, quantity: 1, reason: "" };

export default function AdminInventory() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, movs] = await Promise.all([getProducts(), getStockMovements()]);
      setProducts(prods);
      setMovements(movs);
    } catch {
      toast.error("Não foi possível carregar os dados de estoque.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function set(key: keyof typeof form, value: unknown) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.productId || !form.quantity || !form.reason) return;
    setSaving(true);
    try {
      const product = products.find(p => p.id === form.productId);
      if (!product) return;
      await addStockMovement({
        productId: form.productId,
        productName: product.name,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason,
        userId: user!.uid,
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

  const lowStock = products.filter(p => p.active && p.stock <= p.minStock);
  const selected = products.find(p => p.id === form.productId);

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Estoque</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {products.length} produtos · {lowStock.length} abaixo do mínimo
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Low stock alert */}
              {lowStock.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="border-amber-500/20">
                    <CardHeader className="flex-row items-center gap-2 pb-0">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <CardTitle className="text-base">Estoque Crítico</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {lowStock.map((p, i) => {
                        const pct = Math.min(Math.round((p.stock / p.minStock) * 100), 100);
                        return (
                          <div key={p.id}>
                            <div className="flex items-center justify-between py-2">
                              <div>
                                <p className="text-sm font-medium text-[var(--color-text-secondary)]">{p.name}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">SKU: {p.sku || "—"}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-bold text-amber-400">{p.stock} un.</span>
                                <p className="text-xs text-[var(--color-text-muted)]">mín: {p.minStock}</p>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-bg-overlay)] mb-1">
                              <div
                                className="h-full rounded-full bg-amber-400/70 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            {i < lowStock.length - 1 && <Separator className="mt-2" />}
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* All products stock */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">Todos os Produtos</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {products.length === 0 ? (
                      <div className="flex flex-col items-center py-8 gap-2">
                        <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                        <p className="text-sm text-[var(--color-text-muted)]">Nenhum produto cadastrado.</p>
                      </div>
                    ) : (
                      products.map((p, i) => (
                        <div key={p.id}>
                          <div className="flex items-center justify-between py-2.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{p.name}</p>
                              <p className="text-xs text-[var(--color-text-muted)]">SKU: {p.sku || "—"}</p>
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
                          </div>
                          {i < products.length - 1 && <Separator />}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent movements */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card>
                  <CardHeader className="pb-0">
                    <CardTitle className="text-base">Movimentações Recentes</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {movements.length === 0 ? (
                      <p className="text-sm text-[var(--color-text-muted)] text-center py-6">Nenhuma movimentação ainda.</p>
                    ) : (
                      movements.slice(0, 20).map((m, i) => {
                        const cfg = MOVEMENT_CONFIG[m.type];
                        const Icon = cfg.icon;
                        const isPositive = m.type === "in" || m.type === "adjustment";
                        return (
                          <div key={m.id}>
                            <div className="flex items-center gap-3 py-2.5">
                              <div className={`w-8 h-8 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center shrink-0 ${cfg.color}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-[var(--color-text-secondary)] truncate">{m.productName}</p>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                  {m.reason} · {m.createdAt ? formatDateTime(m.createdAt) : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant={cfg.badge}>{cfg.label}</Badge>
                                <span className={`text-sm font-bold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                                  {isPositive ? "+" : "-"}{m.quantity}
                                </span>
                              </div>
                            </div>
                            {i < Math.min(movements.length, 20) - 1 && <Separator />}
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
              <Card className="sticky top-28">
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

                    {selected && (
                      <div className="rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] p-3">
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">Estoque após movimentação</p>
                        <p className="text-lg font-black text-[var(--color-text-primary)]">
                          {form.type === "in" || form.type === "adjustment"
                            ? selected.stock + Number(form.quantity || 0)
                            : Math.max(0, selected.stock - Number(form.quantity || 0))
                          } <span className="text-sm font-normal text-[var(--color-text-muted)]">un.</span>
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">Atual: {selected.stock} un.</p>
                      </div>
                    )}

                    <Button
                      type="submit"
                      variant="premium"
                      className="w-full"
                      disabled={saving || !form.productId || !form.quantity || !form.reason}
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
