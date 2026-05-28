"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, ShoppingCart, Star, Package, X } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import type { Product, ProductCategory } from "@/types";

const categories: { value: ProductCategory | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "cigars", label: "Charutos" },
  { value: "hookah", label: "Narguilé" },
  { value: "cigarettes", label: "Cigarros" },
  { value: "accessories", label: "Acessórios" },
  { value: "beverages", label: "Bebidas" },
  { value: "clothing", label: "Vestuário" },
  { value: "kits", label: "Kits" },
  { value: "premium", label: "Premium" },
];

const mockProducts: Product[] = [
  { id: "1", name: "Charuto Cohiba Siglo VI", slug: "cohiba-siglo-vi", description: "Lendário charuto cubano", price: 280, compareAtPrice: 320, category: "cigars", images: [], stock: 15, minStock: 3, featured: true, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "2", name: "Kit Narguilé Premium MZ", slug: "kit-narguile-mz", description: "Kit completo", price: 450, category: "hookah", images: [], stock: 8, minStock: 2, featured: true, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "3", name: "Whisky Glenfiddich 18Y", slug: "glenfiddich-18y", description: "Single malt escocês", price: 390, compareAtPrice: 420, category: "beverages", images: [], stock: 20, minStock: 5, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "4", name: "Essência Adalya Love 66", slug: "adalya-love-66", description: "A mais popular do mundo", price: 55, category: "hookah", images: [], stock: 50, minStock: 10, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "5", name: "Charuto Montecristo No.4", slug: "montecristo-4", description: "Clássico cubano inconfundível", price: 180, category: "cigars", images: [], stock: 25, minStock: 5, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "6", name: "Piteira KF Golden", slug: "piteira-kf-golden", description: "Piteira de cristal premium", price: 35, category: "accessories", images: [], stock: 100, minStock: 20, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "7", name: "Essência Fummo Grape", slug: "fummo-grape", description: "Sabor uva intenso", price: 45, category: "hookah", images: [], stock: 60, minStock: 15, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "8", name: "Carvão Burning Desert 1kg", slug: "carvao-burning-desert", description: "Carvão de coco premium", price: 28, category: "accessories", images: [], stock: 200, minStock: 30, featured: false, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<ProductCategory | "all">("all");

  const filtered = mockProducts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-[var(--color-text-primary)] mb-2">
            Catálogo
            <span className="text-neon"> Premium</span>
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produtos..."
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] pl-10 pr-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="default">
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
          </Button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.value
                  ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] border border-[var(--color-neon-blue)]/40 shadow-[var(--shadow-neon-sm)]"
                  : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-neon-blue)] hover:text-[var(--color-neon-blue)]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-[var(--color-text-secondary)] font-medium">Nenhum produto encontrado</p>
            <p className="text-sm text-[var(--color-text-muted)]">Tente ajustar os filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filtered.map((product, i) => {
              const discount = product.compareAtPrice
                ? Math.round((1 - product.price / product.compareAtPrice) * 100)
                : null;

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden hover:border-[var(--color-neon-blue)] hover:shadow-[var(--shadow-neon-sm)] transition-all duration-300"
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-[var(--color-bg-overlay)] overflow-hidden">
                    {product.images[0] ? (
                      <Image src={product.images[0]} alt={product.name} fill sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Package className="w-10 h-10 text-[var(--color-text-muted)]" />
                      </div>
                    )}
                    {discount && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="orange">-{discount}%</Badge>
                      </div>
                    )}
                    {product.featured && (
                      <div className={`absolute ${discount ? "top-10" : "top-3"} left-3`}>
                        <Badge variant="premium"><Star className="w-2.5 h-2.5" /> Destaque</Badge>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <Button variant="premium" size="sm" className="w-full text-xs">
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-xs text-[var(--color-neon-blue)] font-medium uppercase tracking-wide mb-1">
                      {categories.find(c => c.value === product.category)?.label ?? product.category}
                    </p>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] line-clamp-2 mb-2 group-hover:text-[var(--color-neon-blue)] transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[var(--color-neon-blue)]">
                        {formatCurrency(product.price)}
                      </span>
                      {product.compareAtPrice && (
                        <span className="text-xs text-[var(--color-text-muted)] line-through">
                          {formatCurrency(product.compareAtPrice)}
                        </span>
                      )}
                    </div>
                    {product.stock <= 5 && product.stock > 0 && (
                      <p className="text-xs text-amber-400 mt-1">Últimas {product.stock} unidades</p>
                    )}
                    {product.stock === 0 && (
                      <p className="text-xs text-[var(--color-error)] mt-1">Esgotado</p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
