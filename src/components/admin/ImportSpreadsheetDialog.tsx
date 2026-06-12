"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, CheckCircle, AlertTriangle, Package } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, slugify } from "@/lib/utils";
import { type ParsedProduct } from "@/lib/csvImport";
import { parseProductsFile } from "@/lib/spreadsheetImport";
import { createProduct, updateProduct } from "@/lib/firebase/products";
import { createCategory, getCategories } from "@/lib/firebase/categories";
import { toast } from "@/stores/toastStore";
import type { Product, Category } from "@/types";

interface ImportSpreadsheetDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Produtos já cadastrados — para detectar atualizações (por nome ou SKU). */
  products: Product[];
  categories: Category[];
  /** Chamado ao final da importação para recarregar a lista. */
  onDone: () => void | Promise<void>;
}

interface PreviewRow {
  parsed: ParsedProduct;
  /** Produto existente que será ATUALIZADO (match por slug do nome ou SKU). */
  existing?: Product;
  /** Categoria resolvida (existente) ou null = será criada. */
  categorySlug: string | null;
}

const COLUMNS_HINT =
  "ESTOQUE · SKU · CATEGORIA · MARCA · DESCRIÇÃO DO PRODUTO · COR/AROMA/SABOR · " +
  "TAMANHO/QUANTIDADE · CUSTO UNIDADE (R$) · IMPOSTO (%) · PREÇO PIX/DINHEIRO (R$) · " +
  "PONTOS GANHOS · PONTOS RESGATE";

export function ImportSpreadsheetDialog({
  open, onOpenChange, products, categories, onDone,
}: ImportSpreadsheetDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  function reset() {
    setRows([]); setWarnings([]); setFileName(""); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close(v: boolean) {
    if (importing) return; // não fecha no meio da importação
    if (!v) reset();
    onOpenChange(v);
  }

  /** Resolve a categoria da planilha contra as cadastradas (por slug ou rótulo). */
  function resolveCategory(raw: string): string | null {
    const label = raw.trim();
    if (!label) return null;
    const slug = slugify(label);
    const match = categories.find(
      c => c.slug === slug || c.label.toLowerCase() === label.toLowerCase(),
    );
    return match?.slug ?? null;
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    const result = await parseProductsFile(file);
    if (result.error) {
      toast.error(result.error);
      reset();
      return;
    }
    setWarnings(result.warnings);
    setRows(result.products.map(parsed => {
      const slug = slugify(parsed.name);
      const existing = products.find(p =>
        p.slug === slug ||
        (parsed.sku && p.sku && p.sku.toLowerCase() === parsed.sku.toLowerCase()),
      );
      return { parsed, existing, categorySlug: resolveCategory(parsed.category) };
    }));
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setProgress(0);
    try {
      // 1) Cria as categorias que ainda não existem (uma vez por rótulo).
      const missing = new Map<string, string>(); // slug -> label
      for (const r of rows) {
        const label = r.parsed.category.trim();
        if (label && !r.categorySlug) missing.set(slugify(label), label);
      }
      for (const label of missing.values()) {
        try { await createCategory(label); } catch { /* já existe / sem permissão */ }
      }
      const freshCategories = missing.size > 0 ? await getCategories(true) : categories;

      // 2) Cria/atualiza os produtos.
      let created = 0, updated = 0, failed = 0;
      for (let i = 0; i < rows.length; i++) {
        const { parsed, existing } = rows[i];
        const label = parsed.category.trim();
        const catSlug = label
          ? (freshCategories.find(
              c => c.slug === slugify(label) || c.label.toLowerCase() === label.toLowerCase(),
            )?.slug ?? slugify(label))
          : (existing?.category ?? "");

        try {
          if (existing) {
            // Atualização: preserva id/imagem das variações já cadastradas (match por SKU/nome).
            const mergedVariations = parsed.variations.map(pv => {
              const old = (existing.variations ?? []).find(v =>
                (pv.sku && v.sku.toLowerCase() === pv.sku.toLowerCase()) ||
                v.name.toLowerCase() === pv.name.toLowerCase(),
              );
              return old ? { ...old, name: pv.name, sku: pv.sku || old.sku, stock: pv.stock } : pv;
            });
            const usesVariations = mergedVariations.length > 0;
            await updateProduct(existing.id, {
              price: parsed.price,
              category: catSlug || existing.category,
              brand: parsed.brand,
              size: parsed.size,
              costPrice: parsed.costPrice,
              taxPercent: parsed.taxPercent,
              pointsEarned: parsed.pointsEarned,
              loyaltyPoints: parsed.loyaltyPoints,
              sku: usesVariations ? existing.sku : (parsed.sku ?? existing.sku),
              variations: usesVariations ? mergedVariations : existing.variations,
              stock: usesVariations
                ? mergedVariations.reduce((s, v) => s + v.stock, 0)
                : parsed.stock,
            });
            updated++;
          } else {
            const usesVariations = parsed.variations.length > 0;
            await createProduct({
              name: parsed.name,
              slug: slugify(parsed.name),
              description: "",
              shortDescription: "",
              price: parsed.price,
              category: catSlug,
              tags: [],
              images: [],
              stock: usesVariations
                ? parsed.variations.reduce((s, v) => s + v.stock, 0)
                : parsed.stock,
              minStock: 5,
              sku: usesVariations ? "" : (parsed.sku ?? ""),
              featured: false,
              active: true,
              colors: [],
              variations: parsed.variations,
              brand: parsed.brand,
              size: parsed.size,
              costPrice: parsed.costPrice,
              taxPercent: parsed.taxPercent,
              pointsEarned: parsed.pointsEarned,
              loyaltyPoints: parsed.loyaltyPoints,
            });
            created++;
          }
        } catch {
          failed++;
        }
        setProgress(i + 1);
      }

      if (failed > 0) {
        toast.error(`Importação concluída com erros: ${created} criados, ${updated} atualizados, ${failed} falharam.`);
      } else {
        toast.success(`Importação concluída! ${created} produto${created !== 1 ? "s" : ""} criado${created !== 1 ? "s" : ""} e ${updated} atualizado${updated !== 1 ? "s" : ""}.`);
      }
      await onDone();
      reset();
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  }

  const toCreate = rows.filter(r => !r.existing).length;
  const toUpdate = rows.length - toCreate;
  const newCategories = new Set(
    rows.filter(r => r.parsed.category.trim() && !r.categorySlug)
        .map(r => r.parsed.category.trim()),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar produtos por planilha</DialogTitle>
          <DialogDescription>
            Envie a planilha do Excel (<strong>.xlsx</strong>) ou um arquivo <strong>.csv</strong>.
            Linhas com a mesma descrição e COR/AROMA/SABOR diferentes viram variações do mesmo produto.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:bg-[var(--color-neon-blue-glow)] py-10 px-4 text-center text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-all w-full"
            >
              <FileSpreadsheet className="w-10 h-10" />
              <div>
                <p className="text-sm font-semibold">Clique para escolher a planilha (.xlsx ou .csv)</p>
                <p className="text-xs mt-0.5 opacity-70">Excel direto, ou CSV separado por ; ou ,</p>
              </div>
            </button>
            <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
              <strong>Colunas reconhecidas:</strong> {COLUMNS_HINT}. A ordem não importa
              e maiúsculas/acentos são ignorados.
            </p>
          </>
        ) : (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <Badge variant="secondary"><FileSpreadsheet className="w-3 h-3" /> {fileName}</Badge>
              <Badge variant="success">{toCreate} novo{toCreate !== 1 ? "s" : ""}</Badge>
              {toUpdate > 0 && <Badge variant="warning">{toUpdate} atualização{toUpdate !== 1 ? "ões" : ""}</Badge>}
              {newCategories.size > 0 && (
                <Badge variant="purple">{newCategories.size} categoria{newCategories.size !== 1 ? "s" : ""} nova{newCategories.size !== 1 ? "s" : ""}</Badge>
              )}
            </div>

            {/* Avisos do parser */}
            {warnings.length > 0 && (
              <div className="rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 px-3 py-2.5 space-y-1">
                <p className="text-xs font-semibold text-[var(--color-warning)] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> {warnings.length} aviso{warnings.length !== 1 ? "s" : ""}
                </p>
                {warnings.slice(0, 6).map((w, i) => (
                  <p key={i} className="text-xs text-[var(--color-text-secondary)]">{w}</p>
                ))}
                {warnings.length > 6 && (
                  <p className="text-xs text-[var(--color-text-muted)]">…e mais {warnings.length - 6}.</p>
                )}
              </div>
            )}

            {/* Preview */}
            <div className="rounded-xl border border-[var(--color-border)] divide-y divide-[var(--color-border)] max-h-72 overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Package className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {r.parsed.name}
                      {r.parsed.brand && <span className="text-[var(--color-text-muted)] font-normal"> · {r.parsed.brand}</span>}
                      {r.parsed.size && <span className="text-[var(--color-text-muted)] font-normal"> · {r.parsed.size}</span>}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] truncate">
                      {r.parsed.category || "sem categoria"}
                      {!r.categorySlug && r.parsed.category.trim() && " (nova)"}
                      {" · "}
                      {r.parsed.variations.length > 0
                        ? `${r.parsed.variations.length} variações`
                        : `SKU ${r.parsed.sku || "—"}`}
                      {" · "}{r.parsed.stock} un.
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-[var(--color-neon-blue)]">{formatCurrency(r.parsed.price)}</p>
                    <Badge variant={r.existing ? "warning" : "success"} className="text-[10px]">
                      {r.existing ? "Atualiza" : "Novo"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>

            {importing && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-neon-blue)] transition-all"
                    style={{ width: `${(progress / rows.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                  {progress}/{rows.length}
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {rows.length > 0 && !importing && (
            <Button variant="secondary" onClick={reset}>
              <Upload className="w-4 h-4" /> Trocar arquivo
            </Button>
          )}
          <DialogClose asChild>
            <Button variant="secondary" disabled={importing}>Cancelar</Button>
          </DialogClose>
          {rows.length > 0 && (
            <Button variant="premium" onClick={handleImport} disabled={importing}>
              {importing
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle className="w-4 h-4" /> Importar {rows.length} produto{rows.length !== 1 ? "s" : ""}</>}
            </Button>
          )}
        </DialogFooter>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={e => handleFile(e.target.files?.[0])}
        />
      </DialogContent>
    </Dialog>
  );
}
