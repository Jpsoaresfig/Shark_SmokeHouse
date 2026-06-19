"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Package, Search, ToggleLeft, ToggleRight, Star, X, Tag, ImageIcon, Loader2, FileSpreadsheet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  getCategories, ensureCategoriesSeeded, createCategory, deleteCategory, setCategoryDoublePoints,
} from "@/lib/firebase/categories";
import { CloudinaryUpload, uploadToCloudinary } from "@/components/ui/CloudinaryUpload";
import { ImportSpreadsheetDialog } from "@/components/admin/ImportSpreadsheetDialog";
import { toast } from "@/stores/toastStore";
import { computeRedemption, MIN_REDEMPTION_MARGIN, REDEMPTION_POINTS_PER_REAL } from "@/lib/loyalty/redemption";
import type { Product, ProductCategory, Category } from "@/types";

const EMPTY: Omit<Product, "id" | "createdAt" | "updatedAt"> = {
  name: "", slug: "", description: "", shortDescription: "",
  price: 0, compareAtPrice: undefined, category: "",
  tags: [], images: [], stock: 0, minStock: 5,
  sku: "", featured: false, storeHighlight: false, active: true, doublePoints: false, loyaltyPoints: undefined,
  redeemDisabled: false, loyaltyPointsOverride: undefined,
  pointsEarned: undefined, colors: [], variations: [],
  brand: "", size: "", costPrice: undefined, taxPercent: undefined,
};

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [earnEnabled, setEarnEnabled] = useState(false);
  const [colorInput, setColorInput] = useState("");
  /* Campos da nova variação (grade) */
  const [varName, setVarName] = useState("");
  const [varSku, setVarSku] = useState("");
  const [varStock, setVarStock] = useState("");

  const variations = form.variations ?? [];
  const hasVariations = variations.length > 0;
  const variationsTotalStock = variations.reduce((s, v) => s + (Number(v.stock) || 0), 0);

  function addVariation() {
    const name = varName.trim();
    const sku = varSku.trim();
    if (!name || !sku) {
      toast.error("Informe o nome e o código de barras da variação.");
      return;
    }
    if (variations.some(v => v.sku.toLowerCase() === sku.toLowerCase())) {
      toast.error("Já existe uma variação com esse código de barras.");
      return;
    }
    const variation = {
      id: `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      sku,
      stock: Number(varStock) || 0,
    };
    setForm(f => ({ ...f, variations: [...(f.variations ?? []), variation] }));
    setVarName(""); setVarSku(""); setVarStock("");
  }

  function removeVariation(id: string) {
    setForm(f => ({ ...f, variations: (f.variations ?? []).filter(v => v.id !== id) }));
  }

  function setVariationStock(id: string, stock: number) {
    setForm(f => ({
      ...f,
      variations: (f.variations ?? []).map(v => v.id === id ? { ...v, stock } : v),
    }));
  }

  /* Foto própria por variação: input de arquivo único compartilhado — guarda em
     varImgTargetRef qual variação receberá a imagem enviada. */
  const varImgInputRef = useRef<HTMLInputElement>(null);
  const varImgTargetRef = useRef<string | null>(null);
  const [varImgUploading, setVarImgUploading] = useState<string | null>(null);

  function pickVariationImage(id: string) {
    varImgTargetRef.current = id;
    varImgInputRef.current?.click();
  }

  async function handleVariationImage(file: File | undefined) {
    const id = varImgTargetRef.current;
    if (!file || !id) return;
    setVarImgUploading(id);
    try {
      const url = await uploadToCloudinary(file);
      setForm(f => ({
        ...f,
        variations: (f.variations ?? []).map(v => v.id === id ? { ...v, image: url } : v),
      }));
    } catch {
      toast.error("Erro ao enviar a imagem da variação.");
    } finally {
      setVarImgUploading(null);
      varImgTargetRef.current = null;
      if (varImgInputRef.current) varImgInputRef.current.value = "";
    }
  }

  function removeVariationImage(id: string) {
    setForm(f => ({
      ...f,
      variations: (f.variations ?? []).map(v => v.id === id ? { ...v, image: undefined } : v),
    }));
  }

  function addColor() {
    const c = colorInput.trim();
    if (!c) return;
    setForm(f => {
      const list = f.colors ?? [];
      if (list.some(x => x.toLowerCase() === c.toLowerCase())) return f;
      return { ...f, colors: [...list, c] };
    });
    setColorInput("");
  }

  function removeColor(c: string) {
    setForm(f => ({ ...f, colors: (f.colors ?? []).filter(x => x !== c) }));
  }

  /* Categorias dinâmicas (gerenciadas pelo admin) */
  const [categories, setCategories] = useState<Category[]>([]);
  const [catOpen, setCatOpen] = useState(false);
  const [catInput, setCatInput] = useState("");
  const [catSaving, setCatSaving] = useState(false);
  /* id da categoria aguardando confirmação de remoção (confirmação inline). */
  const [catConfirmId, setCatConfirmId] = useState<string | null>(null);
  const [catDeletingId, setCatDeletingId] = useState<string | null>(null);
  const categoryLabel = useCallback(
    (slug: string) => categories.find(c => c.slug === slug)?.label ?? slug,
    [categories],
  );

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await getCategories());
    } catch {
      /* mantém o que tiver */
    }
  }, []);

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

  useEffect(() => { load(); loadCategories(); }, [load, loadCategories]);

  /* Abre o gerenciador de categorias (garante que os padrões virem editáveis). */
  async function openCategories() {
    setCatOpen(true);
    try {
      setCategories(await ensureCategoriesSeeded());
    } catch {
      toast.error("Não foi possível carregar as categorias.");
    }
  }

  async function handleAddCategory() {
    const label = catInput.trim();
    if (!label) return;
    if (categories.some(c => c.label.toLowerCase() === label.toLowerCase())) {
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }
    setCatSaving(true);
    try {
      await createCategory(label);
      setCatInput("");
      setCategories(await getCategories(true));
      toast.success("Categoria criada!");
    } catch {
      toast.error("Erro ao criar categoria.");
    } finally {
      setCatSaving(false);
    }
  }

  async function handleDeleteCategory(cat: Category) {
    setCatDeletingId(cat.id);
    try {
      await deleteCategory(cat.id);
      setCategories(await getCategories(true));
      toast.success("Categoria removida.");
    } catch {
      toast.error("Erro ao remover categoria.");
    } finally {
      setCatDeletingId(null);
      setCatConfirmId(null);
    }
  }

  /** Liga/desliga a campanha "Pontos em Dobro" da categoria (Task 3.5). */
  async function handleToggleCategoryDouble(cat: Category) {
    const next = !cat.doublePoints;
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, doublePoints: next } : c));
    try {
      await setCategoryDoublePoints(cat.id, next);
      toast.success(next ? `Pontos em dobro ativados em ${cat.label}.` : `Pontos em dobro desativados em ${cat.label}.`);
    } catch {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, doublePoints: !next } : c));
      toast.error("Não foi possível alterar a campanha. Tente novamente.");
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY, category: categories[0]?.slug ?? "" });
    setEarnEnabled(false);
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setEarnEnabled(!!p.pointsEarned);
    setForm({
      name: p.name, slug: p.slug, description: p.description,
      shortDescription: p.shortDescription ?? "",
      price: p.price, compareAtPrice: p.compareAtPrice,
      category: p.category, tags: p.tags ?? [],
      images: p.images, stock: p.stock, minStock: p.minStock,
      sku: p.sku ?? "", featured: p.featured ?? false,
      storeHighlight: p.storeHighlight ?? false, active: p.active,
      doublePoints: p.doublePoints ?? false,
      loyaltyPoints: p.loyaltyPoints,
      redeemDisabled: p.redeemDisabled ?? false,
      loyaltyPointsOverride: p.loyaltyPointsOverride,
      pointsEarned: p.pointsEarned,
      colors: p.colors ?? [],
      variations: p.variations ?? [],
      brand: p.brand ?? "",
      size: p.size ?? "",
      costPrice: p.costPrice,
      taxPercent: p.taxPercent,
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
      // Com variações, o estoque do produto é a SOMA das variações; o campo
      // "Estoque" simples é ignorado. Sempre grava `variations` (mesmo []) para
      // permitir limpar a grade de um produto que antes tinha variações.
      const cleanVariations = (form.variations ?? []).map(v => ({
        id: v.id, name: v.name.trim(), sku: v.sku.trim(), stock: Number(v.stock) || 0,
        ...(v.image ? { image: v.image } : {}), // sem undefined (Firestore rejeita)
      }));
      const usesVariations = cleanVariations.length > 0;
      const priceNum = Number(form.price);
      const costNum = form.costPrice ? Number(form.costPrice) : undefined;
      const taxNum = form.taxPercent ? Number(form.taxPercent) : undefined;
      const overrideNum = form.loyaltyPointsOverride ? Number(form.loyaltyPointsOverride) : undefined;
      // Motor de resgate (Task 3.6): deriva o custo EFETIVO em pontos a partir da
      // margem/fórmula/overwrite e persiste só quando elegível, para o cliente não
      // recalcular margem na leitura.
      const redemption = computeRedemption({
        price: priceNum, costPrice: costNum, taxPercent: taxNum,
        redeemDisabled: form.redeemDisabled, loyaltyPointsOverride: overrideNum,
      });
      const payload = {
        ...form,
        price: priceNum,
        compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
        stock: usesVariations ? cleanVariations.reduce((s, v) => s + v.stock, 0) : Number(form.stock),
        minStock: Number(form.minStock),
        variations: cleanVariations,
        loyaltyPoints: redemption.eligible ? redemption.pointsCost ?? undefined : undefined,
        redeemDisabled: form.redeemDisabled || undefined,
        loyaltyPointsOverride: overrideNum,
        pointsEarned: earnEnabled && form.pointsEarned ? Number(form.pointsEarned) : undefined,
        brand: form.brand?.trim() || undefined,
        size: form.size?.trim() || undefined,
        costPrice: costNum,
        taxPercent: taxNum,
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
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" onClick={openCategories}>
                <Tag className="w-4 h-4" /> Categorias
              </Button>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet className="w-4 h-4" /> Importar planilha
              </Button>
              <Button variant="premium" onClick={openAdd}>
                <Plus className="w-4 h-4" /> Adicionar Produto
              </Button>
            </div>
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
                            <Badge variant="secondary">{categoryLabel(p.category)}</Badge>
                            {p.featured && <Badge variant="premium">Em Destaque</Badge>}
                            {p.storeHighlight && <Badge variant="default">Vitrine</Badge>}
                            {p.doublePoints && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-warning)]/10 text-[var(--color-warning)] border border-[var(--color-warning)]/30">
                                <Star className="w-3 h-3" /> Pontos 2×
                              </span>
                            )}
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
                            {p.variations && p.variations.length > 0 && ` · ${p.variations.length} variações`}
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
                {!form.category && <option value="">Selecione…</option>}
                {/* categoria legada que não está mais na lista */}
                {form.category && !categories.some(c => c.slug === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
                {categories.map(c => <option key={c.id} value={c.slug}>{c.label}</option>)}
              </select>
              <button type="button" onClick={openCategories} className="text-xs text-[var(--color-neon-blue)] hover:underline mt-1">
                + Gerenciar categorias
              </button>
            </div>
            <Input
              label="SKU"
              value={form.sku}
              onChange={e => set("sku", e.target.value)}
              placeholder="Ex: CHR-001"
            />
            <Input
              label="Marca"
              value={form.brand ?? ""}
              onChange={e => set("brand", e.target.value)}
              placeholder="Ex: Zomo, Adalya"
            />
            <Input
              label="Tamanho/Quantidade"
              value={form.size ?? ""}
              onChange={e => set("size", e.target.value)}
              placeholder="Ex: 50g, caixa c/ 10"
            />
            <Input
              label="Custo unidade (R$) — interno"
              type="number"
              min="0"
              step="0.01"
              value={form.costPrice ?? ""}
              onChange={e => set("costPrice", e.target.value || undefined)}
              placeholder="Nunca aparece pro cliente"
            />
            <Input
              label="Imposto (%) — interno"
              type="number"
              min="0"
              step="0.01"
              value={form.taxPercent ?? ""}
              onChange={e => set("taxPercent", e.target.value || undefined)}
              placeholder="Nunca aparece pro cliente"
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
              label={hasVariations ? "Estoque (soma das variações)" : "Estoque"}
              type="number"
              min="0"
              value={hasVariations ? variationsTotalStock : form.stock}
              onChange={e => set("stock", e.target.value)}
              disabled={hasVariations}
            />
            <Input
              label="Estoque mínimo"
              type="number"
              min="0"
              value={form.minStock}
              onChange={e => set("minStock", e.target.value)}
            />

            {/* Resgate por pontos — motor de regras (Task 3.6) */}
            <div className="sm:col-span-2 pt-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1 h-px bg-[var(--color-border)]" />
                <div className="flex items-center gap-1.5 px-2">
                  <Star className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                  <span className="text-xs font-semibold text-[var(--color-warning)] uppercase tracking-wide">Resgate por pontos</span>
                </div>
                <div className="flex-1 h-px bg-[var(--color-border)]" />
              </div>

              {(() => {
                const redemption = computeRedemption({
                  price: Number(form.price) || 0,
                  costPrice: form.costPrice ? Number(form.costPrice) : undefined,
                  taxPercent: form.taxPercent ? Number(form.taxPercent) : undefined,
                  redeemDisabled: form.redeemDisabled,
                  loyaltyPointsOverride: form.loyaltyPointsOverride ? Number(form.loyaltyPointsOverride) : undefined,
                });
                const marginPct = redemption.margin != null ? Math.round(redemption.margin * 1000) / 10 : null;
                const statusText = {
                  disabled: "Resgate desativado manualmente.",
                  "no-cost": "Cadastre o custo da unidade para liberar o resgate (margem indeterminada).",
                  "below-margin": `Margem abaixo de ${MIN_REDEMPTION_MARGIN * 100}% — resgate bloqueado pela trava de segurança.`,
                  override: `Resgate liberado por override manual — ${redemption.pointsCost?.toLocaleString("pt-BR")} pontos.`,
                  formula: `Elegível — ${redemption.pointsCost?.toLocaleString("pt-BR")} pontos (R$ ${(Number(form.price) || 0).toLocaleString("pt-BR")} × ${REDEMPTION_POINTS_PER_REAL}).`,
                }[redemption.basis];

                return (
                  <div className={`rounded-xl border p-4 transition-all ${redemption.eligible ? "border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5" : "border-[var(--color-border)] bg-[var(--color-bg-overlay)]"}`}>
                    {/* Engine readout */}
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${redemption.eligible ? "bg-[var(--color-warning)]/15" : "bg-[var(--color-bg-elevated)]"}`}>
                        <Star className={`w-4 h-4 ${redemption.eligible ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${redemption.eligible ? "text-[var(--color-warning)]" : "text-[var(--color-text-secondary)]"}`}>
                          {redemption.eligible ? "Disponível para resgate" : "Indisponível para resgate"}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{statusText}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          Margem de lucro: <strong className={marginPct != null && marginPct < MIN_REDEMPTION_MARGIN * 100 ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"}>
                            {marginPct != null ? `${marginPct}%` : "—"}
                          </strong>
                          {redemption.formulaCost != null && (
                            <> · Fórmula: {redemption.formulaCost.toLocaleString("pt-BR")} pts</>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Overwrite controls */}
                    <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!form.redeemDisabled}
                          onChange={e => set("redeemDisabled", e.target.checked)}
                          className="w-4 h-4 accent-[var(--color-error)]"
                        />
                        <span className="text-sm text-[var(--color-text-secondary)]">Desativar resgate deste produto (ignora a margem)</span>
                      </label>
                      <Input
                        label="Sobrescrever pontos (opcional)"
                        type="number"
                        min="1"
                        step="50"
                        value={form.loyaltyPointsOverride ?? ""}
                        onChange={e => set("loyaltyPointsOverride", e.target.value || undefined)}
                        placeholder={redemption.formulaCost != null ? `Padrão: ${redemption.formulaCost}` : "Ex: 1000"}
                        disabled={!!form.redeemDisabled}
                      />
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Override libera o item ignorando a fórmula e a trava de margem. O estoque é decrementado a cada resgate.
                      </p>
                    </div>
                  </div>
                );
              })()}
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

            {/* Variações / grade (sabor, aroma, cor) com código de barras e estoque próprio */}
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
                Variações (grade) <span className="text-[var(--color-text-muted)] font-normal">(opcional — mesmo preço; código de barras e estoque por variação)</span>
              </label>

              {hasVariations && (
                <div className="space-y-2 mb-3">
                  {variations.map(v => (
                    <div key={v.id} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-2">
                      {/* Foto própria da variação (opcional) */}
                      <button
                        type="button"
                        onClick={() => pickVariationImage(v.id)}
                        disabled={varImgUploading !== null}
                        title={v.image ? "Trocar a foto desta variação" : "Adicionar foto a esta variação"}
                        className="relative w-10 h-10 rounded-lg overflow-hidden border border-dashed border-[var(--color-border)] hover:border-[var(--color-neon-blue)] flex items-center justify-center shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors group"
                      >
                        {varImgUploading === v.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-neon-blue)]" />
                        ) : v.image ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={v.image} alt={v.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-4 h-4" />
                        )}
                      </button>
                      {v.image && varImgUploading !== v.id && (
                        <button
                          type="button"
                          onClick={() => removeVariationImage(v.id)}
                          title="Remover a foto desta variação"
                          className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-error)] shrink-0 -ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{v.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">Cód.: {v.sku}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <label className="text-xs text-[var(--color-text-muted)]">Estoque</label>
                        <input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={e => setVariationStock(v.id, Number(e.target.value) || 0)}
                          className="w-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-base)] px-2 py-1.5 text-sm text-center text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)]"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariation(v.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                          aria-label={`Remover ${v.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Estoque total: <strong className="text-[var(--color-text-secondary)]">{variationsTotalStock} un.</strong>
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_5rem_auto] gap-2">
                <input
                  value={varName}
                  onChange={e => setVarName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addVariation(); } }}
                  placeholder="Nome (ex: Menta)"
                  className={inputCls}
                />
                <input
                  value={varSku}
                  onChange={e => setVarSku(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addVariation(); } }}
                  placeholder="Código de barras"
                  className={inputCls}
                />
                <input
                  value={varStock}
                  onChange={e => setVarStock(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="Estq."
                  className={inputCls}
                />
                <Button type="button" variant="secondary" onClick={addVariation} disabled={!varName.trim() || !varSku.trim()}>
                  Adicionar
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
                Com variações, o cliente escolhe a opção no site e o leitor bipa o código de cada uma no PDV.
                Clique no quadradinho de imagem para dar uma foto própria à variação — ela é exibida quando o cliente a escolhe.
              </p>

              {/* input compartilhado para a foto das variações */}
              <input
                ref={varImgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleVariationImage(e.target.files?.[0])}
              />
            </div>

            {/* Cores/estampas disponíveis (opcional, legado — prefira Variações) */}
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-[var(--color-text-secondary)] block mb-1.5">
                Cores/estampas disponíveis <span className="text-[var(--color-text-muted)] font-normal">(legado — sem código/estoque próprio; prefira Variações)</span>
              </label>
              <div className="flex gap-2">
                <input
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }}
                  placeholder="Ex: Preto, Vermelho, Floral, Camuflado..."
                  className={inputCls}
                />
                <Button type="button" variant="secondary" onClick={addColor} disabled={!colorInput.trim()}>
                  Adicionar
                </Button>
              </div>
              {(form.colors ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(form.colors ?? []).map(c => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/30"
                    >
                      {c}
                      <button type="button" onClick={() => removeColor(c)} className="hover:text-[var(--color-error)]" aria-label={`Remover ${c}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
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
              <label className="flex items-center gap-2 cursor-pointer" title="Aparece na seção dedicada 'Produtos em Destaque' da página inicial">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={e => set("featured", e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-neon-blue)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">Seção “Produtos em Destaque”</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" title="Aparece primeiro e com selo dentro de 'Nossos Produtos' (vitrine e catálogo) — independente da seção de destaque">
                <input
                  type="checkbox"
                  checked={!!form.storeHighlight}
                  onChange={e => set("storeHighlight", e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-neon-blue)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">Exibição destacada em “Nossos Produtos”</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" title="Compras com este produto pontuam em dobro no Clube Shark">
                <input
                  type="checkbox"
                  checked={!!form.doublePoints}
                  onChange={e => set("doublePoints", e.target.checked)}
                  className="w-4 h-4 accent-[var(--color-warning)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)]">Pontos em dobro</span>
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

      {/* Importação por planilha CSV */}
      <ImportSpreadsheetDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        products={products}
        categories={categories}
        onDone={async () => { await load(); await loadCategories(); }}
      />

      {/* Categories manager */}
      <Dialog open={catOpen} onOpenChange={(v) => { setCatOpen(v); if (!v) setCatConfirmId(null); }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Categorias de produtos</DialogTitle>
            <DialogDescription>Crie ou remova as categorias usadas nos produtos.</DialogDescription>
          </DialogHeader>

          {/* Add */}
          <div className="flex gap-2">
            <input
              value={catInput}
              onChange={e => setCatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
              placeholder="Nova categoria (ex: Isqueiros)"
              className={inputCls}
            />
            <Button variant="premium" onClick={handleAddCategory} disabled={catSaving || !catInput.trim()}>
              {catSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {/* List */}
          <div className="mt-3 space-y-2">
            {categories.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">Nenhuma categoria.</p>
            ) : (
              categories.map(cat => {
                const inUse = products.filter(p => p.category === cat.slug).length;
                const confirming = catConfirmId === cat.id;
                const deleting = catDeletingId === cat.id;
                return (
                  <div key={cat.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{cat.label}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{cat.slug} · {inUse} produto{inUse !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <label
                          className="flex items-center gap-1.5 cursor-pointer mr-1"
                          title="Compras com itens desta categoria pontuam em dobro"
                        >
                          <input
                            type="checkbox"
                            checked={!!cat.doublePoints}
                            onChange={() => handleToggleCategoryDouble(cat)}
                            className="w-3.5 h-3.5 accent-[var(--color-warning)]"
                          />
                          <span className="text-[11px] text-[var(--color-text-muted)] hidden sm:inline">Pontos 2×</span>
                        </label>
                        {!confirming && (
                          <button
                            onClick={() => setCatConfirmId(cat.id)}
                            title="Remover categoria"
                            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Confirmação inline — permite remover mesmo em uso (avisa) */}
                    {confirming && (
                      <div className="mt-2 pt-2 border-t border-[var(--color-border)] space-y-2">
                        {inUse > 0 && (
                          <p className="text-xs text-[var(--color-warning)]">
                            ⚠️ {inUse} produto{inUse !== 1 ? "s" : ""} usa{inUse !== 1 ? "m" : ""} esta categoria e ficará{inUse !== 1 ? "ão" : ""} sem categoria. Você pode reatribuí-los depois.
                          </p>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => setCatConfirmId(null)} disabled={deleting}>
                            Cancelar
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-red-500 hover:bg-red-600 text-white border-0"
                            onClick={() => handleDeleteCategory(cat)}
                            disabled={deleting}
                          >
                            {deleting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Remover"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Fechar</Button>
            </DialogClose>
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
