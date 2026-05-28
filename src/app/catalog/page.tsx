"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShoppingCart, Package, X, Check } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { getActiveProducts } from "@/lib/firebase/products";
import { ProductModal } from "@/components/shop/ProductModal";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types";

const categories: { value: ProductCategory | "all"; label: string }[] = [
  { value: "all",         label: "Todos" },
  { value: "cigars",      label: "Charutos" },
  { value: "hookah",      label: "Narguilé" },
  { value: "cigarettes",  label: "Cigarros" },
  { value: "accessories", label: "Acessórios" },
  { value: "beverages",   label: "Bebidas" },
  { value: "clothing",    label: "Vestuário" },
  { value: "kits",        label: "Kits" },
  { value: "premium",     label: "Premium" },
];

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  cigars: "Charutos", hookah: "Narguilé", cigarettes: "Cigarros",
  accessories: "Acessórios", beverages: "Bebidas", clothing: "Vestuário",
  kits: "Kits", premium: "Premium",
};

export default function CatalogPage() {
  const [products, setProducts]         = useState<Product[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");
  const [addedId, setAddedId]           = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const { addItem }                     = useCartStore();

  useEffect(() => {
    getActiveProducts()
      .then(setProducts)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = activeCategory === "all" || p.category === activeCategory;
    return matchSearch && matchCat;
  }), [products, search, activeCategory]);

  const handleAddToCart = (product: Product) => {
    addItem(product);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1500);
  };

  return (
    <>
    <div className="min-h-screen pt-20 sm:pt-24 pb-20 px-3 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">

        {/* Header — mobile-first */}
        <div className="mb-5 sm:mb-8">
          <p className="text-eyebrow text-[var(--color-neon-blue)] mb-1.5">Catálogo</p>
          <h1 className="font-display text-2xl sm:text-4xl font-bold text-[var(--color-text-primary)] leading-tight">
            Seleção <span className="italic">Premium</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1">
            {loading
              ? "Carregando..."
              : `${filtered.length} produto${filtered.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Search — full width, prominent on mobile */}
        <div className="relative mb-3 sm:mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produtos..."
            className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] pl-10 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category pills — horizontal scroll, edge-bleed on mobile */}
        <div className="-mx-3 sm:mx-0 mb-5 sm:mb-8">
          <div className="flex gap-2 overflow-x-auto px-3 sm:px-0 pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`shrink-0 h-9 px-4 rounded-full text-xs sm:text-sm font-medium border transition-all whitespace-nowrap ${
                  activeCategory === cat.value
                    ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-neon-sm)]"
                    : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border-[var(--color-border)] active:bg-[var(--color-bg-overlay)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton aspect-[3/4] rounded-xl" />
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-4 w-full rounded" />
                <div className="skeleton h-4 w-1/3 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 sm:py-28 gap-3 sm:gap-4 text-center"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Package className="w-7 h-7 sm:w-8 sm:h-8 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm sm:text-base text-[var(--color-text-secondary)] font-medium">
              {products.length === 0 ? "Nenhum produto cadastrado ainda" : "Nenhum produto encontrado"}
            </p>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] max-w-xs">
              {products.length === 0
                ? "Os produtos aparecerão aqui assim que forem cadastrados pelo admin."
                : "Tente ajustar os filtros de busca"}
            </p>
            {search && (
              <button
                onClick={() => { setSearch(""); setActiveCategory("all"); }}
                className="h-11 px-4 text-sm text-[var(--color-neon-blue)] active:underline"
              >
                Limpar filtros
              </button>
            )}
          </motion.div>
        )}

        {/* Product grid */}
        {!loading && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6"
          >
            <AnimatePresence mode="popLayout">
              {filtered.map((product, i) => {
                const discount = product.compareAtPrice
                  ? Math.round((1 - product.price / product.compareAtPrice) * 100)
                  : null;

                return (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.3 }}
                    className="group cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {/* Image */}
                    <div className="relative aspect-[3/4] bg-[var(--color-bg-overlay)] border border-[var(--color-border)] rounded-xl overflow-hidden group-hover:border-[var(--color-neon-blue)]/50 transition-colors duration-300">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          sizes="(max-width:640px) 50vw,(max-width:1024px) 33vw,25vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5">
                          <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                          <p className="text-[10px] text-[var(--color-text-muted)]">sem imagem</p>
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        {discount && <Badge variant="orange" className="text-[10px] px-1.5 py-0.5">-{discount}%</Badge>}
                        {product.featured && <Badge variant="premium" className="text-[10px] px-1.5 py-0.5">Destaque</Badge>}
                        {product.stock === 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">Esgotado</Badge>}
                      </div>

                      {/* Add button — always visible on mobile, hover on desktop */}
                      <div className="absolute inset-x-0 bottom-0 p-2 md:translate-y-full md:group-hover:translate-y-0 transition-transform duration-300">
                        <Button
                          variant="premium"
                          size="sm"
                          className="w-full text-xs h-9"
                          disabled={product.stock === 0}
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(product); }}
                        >
                          {addedId === product.id
                            ? <><Check className="w-3.5 h-3.5" /> Adicionado</>
                            : product.stock === 0
                            ? "Esgotado"
                            : <><ShoppingCart className="w-3.5 h-3.5" /> Adicionar</>
                          }
                        </Button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="mt-2 sm:mt-3 space-y-0.5 sm:space-y-1">
                      <p className="text-[10px] sm:text-xs text-[var(--color-neon-blue)] font-medium uppercase tracking-wide truncate">
                        {CATEGORY_LABEL[product.category]}
                      </p>
                      <h3 className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 leading-snug group-hover:text-[var(--color-neon-blue)] transition-colors duration-200">
                        {product.name}
                      </h3>
                      <div className="flex items-baseline gap-1.5 pt-0.5 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
                          {formatCurrency(product.price)}
                        </span>
                        {product.compareAtPrice && (
                          <span className="text-[10px] sm:text-xs text-[var(--color-text-muted)] line-through">
                            {formatCurrency(product.compareAtPrice)}
                          </span>
                        )}
                      </div>
                      {product.stock > 0 && product.stock <= 5 && (
                        <p className="text-[10px] sm:text-xs text-amber-400">Últimas {product.stock} un.</p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>

    <ProductModal
      product={selectedProduct}
      onClose={() => setSelectedProduct(null)}
    />
    </>
  );
}
