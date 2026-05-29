"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Package, Search, ToggleLeft, ToggleRight, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, slugify } from "@/lib/utils";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/firebase/products";
import { CloudinaryUpload } from "@/components/ui/CloudinaryUpload";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Product, ProductCategory } from "@/types";

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: "cigars", label: "Charutos" },
  { value: "hookah", label: "Narguilé" },
  { value: "cigarettes", label: "Cigarros" },
  { value: "accessories", label: "Acessórios" },
  { value: "beverages", label: "Bebidas" },
  { value: "clothing", label: "Vestuário" },
  { value: "kits", label: "Kits" },
  { value: "premium", label: "Premium" },
];

const CATEGORY_LABEL: Record<ProductCategory, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
) as Record<ProductCategory, string>;

const EMPTY: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
  name: "", slug: "", description: "", shortDescription: "",
  price: 0, compareAtPrice: undefined, category: "accessories",
  tags: [], images: [], stock: 0, minStock: 5,
  sku: "", featured: false, active: true, loyaltyPoints: undefined,
  pointsEarned: undefined,
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminProducts() {
  const { user } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [earnEnabled, setEarnEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await getProducts());
    } catch {
      toast.error("Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setLoyaltyEnabled(false);
    setEarnEnabled(false);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setLoyaltyEnabled(!!p.loyaltyPoints);
    setEarnEnabled(!!p.pointsEarned);
    setForm({
      name: p.name, slug: p.slug, description: p.description,
      shortDescription: p.shortDescription ?? "",
      price: p.price, compareAtPrice: p.compareAtPrice,
      category: p.category, tags: p.tags ?? [],
      images: p.images, stock: p.stock, minStock: p.minStock,
      sku: p.sku ?? "", featured: p.featured ?? false, active: p.active,
      loyaltyPoints: p.loyaltyPoints,
      pointsEarned: p.pointsEarned,
    });
    setOpen(true);
  }

  function set(key: keyof typeof form, value: unknown) {
    setForm(f => ({
      ...f,
      [key]: value,
      ...(key === "name" ? { slug: slugify(value as string) } : {}),
    }));
  }

  async function handleSave() {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        stock: Number(form.stock),
        minStock: Number(form.minStock),
        loyaltyPoints: loyaltyEnabled && form.loyaltyPoints ? Number(form.loyaltyPoints) : undefined,
        pointsEarned: earnEnabled && form.pointsEarned ? Number(form.pointsEarned) : undefined,
      };
      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Produto atualizado!");
      } else {
        await createProduct(payload);
        toast.success("Produto criado com sucesso!");
      }
      setOpen(false);
      await load();
    } catch {
      toast.error(editing ? "Erro ao atualizar produto. Tente novamente." : "Erro ao criar produto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast.success("Produto excluído.");
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Erro ao excluir produto. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Product) {
    try {
      await updateProduct(p.id, { active: !p.active });
      await load();
    } catch {
      toast.error("Erro ao alterar status do produto.");
    }
  }

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Produtos"
          subtitle={`${products.length} cadastrado${products.length !== 1 ? "s" : ""}`}
          action={
            <Button variant="premium" onClick={openAdd}>
              <Plus className="w-4 h-4" /> Adicionar Produto
            </Button>
          }
        />

        <div className="mb-6">
          <Input
            placeholder="Buscar por nome ou SKU..."
            icon={<Search className="w-4 h-4" />}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--color-neon-blue)] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Package className="w-10 h-10 text-[var(--color-text-muted)]" />
              <p className="text-[var(--color-text-muted)]">
                {search ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
              </p>
              {!search && (
                <Button variant="secondary" size="sm" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> Criar primeiro produto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid gap-3"
          >
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card className={!p.active ? "opacity-60" : ""}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Image + info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                            : <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--color-text-primary)]">{p.name}</span>
                            <Badge variant="secondary">{CATEGORY_LABEL[p.category]}</Badge>
                            {p.featured && <Badge variant="premium">Destaque</Badge>}
                            {!p.active && <Badge variant="destructive">Inativo</Badge>}
                            {p.loyaltyPoints && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                                <Star className="w-3 h-3" />
                                resgate: {p.loyaltyPoints.toLocaleString("pt-BR")} pts
                              </span>
                            )}
                            {p.pointsEarned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/30">
                                <Star className="w-3 h-3" />
                                +{p.pointsEarned.toLocaleString("pt-BR")} pts/compra
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            SKU: {p.sku || "—"} · Estoque: {p.stock} un. · Mín: {p.minStock}
                          </p>
                        </div>
                      </div>

                      {/* Price + actions (below on mobile, inline on desktop) */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-right">
                          <p className="font-bold text-[var(--color-neon-blue)]">{formatCurrency(p.price)}</p>
                          {p.compareAtPrice && (
                            <p className="text-xs text-[var(--color-text-muted)] line-through">{formatCurrency(p.compareAtPrice)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleActive(p)}
                            className="p-2 rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                            title={p.active ? "Desativar" : "Ativar"}
                          >
                            {p.active
                              ? <ToggleRight className="w-5 h-5 text-emerald-400" />
                              : <ToggleLeft className="w-5 h-5" />
                            }
                          </button>
                          <button
                            onClick={() => openEdit(p)}
                            className="p-2 rounded-lg hover:bg-[var(--color-bg-overlay)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-[var(--color-text-muted)] hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Add/Edit modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>Preencha os dados do produto.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Nome *"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Nome do produto"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Categoria *</label>
              <select value={form.category} onChange={e => set("category", e.target.value as ProductCategory)} className={inputCls}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Input
              label="SKU"
              value={form.sku}
              onChange={e => set("sku", e.target.value)}
              placeholder="Ex: CHR-001"
            />
            <Input
              label="Preço *"
              type="number"
              min="0"
              step="0.01"
              value={form.price || ""}
              onChange={e => set("price", e.target.value)}
              placeholder="0,00"
            />
            <Input
              label="Preço comparativo"
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPrice || ""}
              onChange={e => set("compareAtPrice", e.target.value || undefined)}
              placeholder="Preço original (opcional)"
            />
            <Input
              label="Estoque"
              type="number"
              min="0"
              value={form.stock}
              onChange={e => set("stock", e.target.value)}
            />
            <Input
              label="Estoque mínimo"
              type="number"
              min="0"
              value={form.minStock}
              onChange={e => set("minStock", e.target.value)}
            />

            {/* Loyalty toggle */}
            <div className="sm:col-span-2 pt-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className="flex items-center gap-1.5 px-2">
                  <Star className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                  <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">Clube Fidelidade</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              <div className={`rounded-xl border p-4 transition-all ${loyaltyEnabled ? "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5" : "border-[var(--color-border)] bg-[var(--color-bg-overlay)]"}`}>
                {/* Toggle row */}
                <label className="flex items-center justify-between cursor-pointer mb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${loyaltyEnabled ? "bg-[var(--color-warning)]/15" : "bg-[var(--color-bg-elevated)]"}`}>
                      <Star className={`w-4 h-4 transition-colors ${loyaltyEnabled ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold transition-colors ${loyaltyEnabled ? "text-[var(--color-warning)]" : "text-[var(--color-text-secondary)]"}`}>
                        Disponível para resgate por pontos
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {loyaltyEnabled ? "Aparece em Minha Conta dos clientes" : "Produto vendido normalmente, sem resgate"}
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const next = !loyaltyEnabled;
                      setLoyaltyEnabled(next);
                      if (!next) set("loyaltyPoints", undefined);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${loyaltyEnabled ? "bg-[var(--color-warning)]" : "bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)]"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${loyaltyEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </label>

                {/* Points field — shown only when enabled */}
                {loyaltyEnabled && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-warning)]/20">
                    <Input
                      label="Pontos necessários para resgate *"
                      type="number"
                      min="1"
                      step="50"
                      value={form.loyaltyPoints ?? ""}
                      onChange={e => set("loyaltyPoints", e.target.value || undefined)}
                      placeholder="Ex: 500"
                    />
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      O estoque do produto é decrementado automaticamente a cada resgate.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Points earned on purchase */}
            <div className="sm:col-span-2">
              <div className={`rounded-xl border p-4 transition-all ${earnEnabled ? "border-[var(--color-neon-blue)]/30 bg-[var(--color-neon-blue-glow)]/30" : "border-[var(--color-border)] bg-[var(--color-bg-overlay)]"}`}>
                <label className="flex items-center justify-between cursor-pointer mb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${earnEnabled ? "bg-[var(--color-neon-blue-glow)]" : "bg-[var(--color-bg-elevated)]"}`}>
                      <Star className={`w-4 h-4 transition-colors ${earnEnabled ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold transition-colors ${earnEnabled ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-secondary)]"}`}>
                        Gera pontos na compra
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {earnEnabled ? "Cliente ganha pontos ao receber o pedido" : "Este produto não concede pontos ao comprar"}
                      </p>
                    </div>
                  </div>
                  <div
                    onClick={() => {
                      const next = !earnEnabled;
                      setEarnEnabled(next);
                      if (!next) set("pointsEarned", undefined);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer shrink-0 ${earnEnabled ? "bg-[var(--color-neon-blue)]" : "bg-[var(--color-bg-elevated)] border border-[var(--color-border-strong)]"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${earnEnabled ? "translate-x-5" : "translate-x-0"}`} />
                  </div>
                </label>

                {earnEnabled && (
                  <div className="mt-4 pt-4 border-t border-[var(--color-neon-blue)]/20">
                    <Input
                      label="Pontos ganhos por unidade *"
                      type="number"
                      min="1"
                      step="1"
                      value={form.pointsEarned ?? ""}
                      onChange={e => set("pointsEarned", e.target.value || undefined)}
                      placeholder="Ex: 50"
                    />
                    <p className="text-xs text-[var(--color-text-muted)] mt-2">
                      Os pontos são creditados ao cliente quando o pedido é marcado como <strong>entregue</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Descrição curta</label>
              <input
                value={form.shortDescription}
                onChange={e => set("shortDescription", e.target.value)}
                placeholder="Resumo em uma linha"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Descrição</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Descrição completa"
                className={inputCls + " resize-none"}
              />
            </div>
            <div className="sm:col-span-2">
              <CloudinaryUpload
                value={form.images}
                onChange={(urls) => set("images", urls)}
                maxImages={5}
              />
            </div>
            <div className="flex items-center gap-4 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => set("active", e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-neon-blue)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">Ativo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => set("featured", e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-neon-blue)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">Destaque</span>
              </label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button variant="premium" onClick={handleSave} disabled={saving || !form.name || !form.price}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (editing ? "Salvar" : "Criar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir produto</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="default"
              className="bg-red-500 hover:bg-red-600 text-white border-0"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
