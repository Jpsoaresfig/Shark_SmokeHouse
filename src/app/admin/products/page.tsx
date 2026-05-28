"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Package, Search, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { formatCurrency, slugify } from "@/lib/utils";
import { getProducts, createProduct, updateProduct, deleteProduct } from "@/lib/firebase/products";
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
  sku: "", featured: false, active: true,
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
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, slug: p.slug, description: p.description,
      shortDescription: p.shortDescription ?? "",
      price: p.price, compareAtPrice: p.compareAtPrice,
      category: p.category, tags: p.tags ?? [],
      images: p.images, stock: p.stock, minStock: p.minStock,
      sku: p.sku ?? "", featured: p.featured ?? false, active: p.active,
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Produtos</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{products.length} cadastrados</p>
          </div>
          <Button variant="premium" onClick={openAdd}>
            <Plus className="w-4 h-4" /> Adicionar Produto
          </Button>
        </div>

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
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] flex items-center justify-center shrink-0 overflow-hidden">
                      {p.images?.[0]
                        ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        : <Package className="w-5 h-5 text-[var(--color-text-muted)]" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">{p.name}</span>
                        <Badge variant="secondary">{CATEGORY_LABEL[p.category]}</Badge>
                        {p.featured && <Badge variant="premium">Destaque</Badge>}
                        {!p.active && <Badge variant="destructive">Inativo</Badge>}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        SKU: {p.sku || "—"} · Estoque: {p.stock} un. · Mín: {p.minStock}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
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
            <div className="col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Descrição curta</label>
              <input
                value={form.shortDescription}
                onChange={e => set("shortDescription", e.target.value)}
                placeholder="Resumo em uma linha"
                className={inputCls}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">Descrição</label>
              <textarea
                rows={3}
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Descrição completa"
                className={inputCls + " resize-none"}
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">URLs das imagens (uma por linha)</label>
              <textarea
                rows={3}
                value={form.images.join("\n")}
                onChange={e => set("images", e.target.value.split("\n").filter(Boolean))}
                placeholder="https://..."
                className={inputCls + " resize-none"}
              />
            </div>
            <div className="flex items-center gap-4 col-span-2">
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
