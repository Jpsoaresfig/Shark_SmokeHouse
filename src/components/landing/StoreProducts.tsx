"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ShoppingCart, Star, ArrowRight, Package, Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { getActiveProducts } from "@/lib/firebase/products";
import { ProductModal } from "@/components/shop/ProductModal";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  cigars: "Charutos", hookah: "Narguilé", beverages: "Bebidas",
  accessories: "Acessórios", cigarettes: "Cigarros",
  clothing: "Vestuário", kits: "Kits", premium: "Premium",
};

const MAX_PRODUCTS = 8;

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [added, setAdded] = useState(false);
  const { addItem } = useCartStore();
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;

  const handleAdd = () => {
    addItem(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.08, 0.4) }}
    >
      <div className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden hover:border-[var(--color-neon-blue)] hover:shadow-[var(--shadow-neon-sm)] transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-square bg-[var(--color-bg-overlay)] overflow-hidden rounded-t-2xl">
          {product.images[0] ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <Package className="w-12 h-12 text-[var(--color-text-muted)]" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount && <Badge variant="orange" className="text-xs">-{discount}%</Badge>}
            {product.featured && (
              <Badge variant="premium" className="text-xs">
                <Star className="w-2.5 h-2.5" /> Destaque
              </Badge>
            )}
          </div>
          {/* Desktop: reveal on hover | Mobile: always visible */}
          <div className="absolute inset-x-0 bottom-0 p-3 md:translate-y-full md:group-hover:translate-y-0 transition-transform duration-300">
            <Button variant="premium" size="sm" className="w-full h-11" onClick={handleAdd} disabled={product.stock === 0}>
              {added
                ? <><Check className="w-3.5 h-3.5" /> Adicionado!</>
                : <><ShoppingCart className="w-3.5 h-3.5" /> {product.stock === 0 ? "Esgotado" : "Adicionar"}</>
              }
            </Button>
          </div>
        </div>
        <div className="p-4">
          <span className="text-xs text-[var(--color-neon-blue)] font-medium uppercase tracking-wide">
            {CATEGORY_LABEL[product.category] ?? product.category}
          </span>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mt-1 mb-2 line-clamp-2 group-hover:text-[var(--color-neon-blue)] transition-colors">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--color-neon-blue)]">
              {formatCurrency(product.price)}
            </span>
            {product.compareAtPrice && (
              <span className="text-sm text-[var(--color-text-muted)] line-through">
                {formatCurrency(product.compareAtPrice)}
              </span>
            )}
          </div>
          {product.stock === 0 && (
            <p className="text-xs text-[var(--color-error)] mt-1">Esgotado</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] overflow-hidden">
      <div className="skeleton aspect-square rounded-t-2xl" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3 w-16 rounded" />
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-5 w-20 rounded mt-1" />
      </div>
    </div>
  );
}

export function StoreProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    getActiveProducts()
      .then((all) => setProducts(all.slice(0, MAX_PRODUCTS)))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12"
        >
          <div>
            <Badge variant="default" className="mb-3">Nossa Loja</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)]">
              Nossos <span className="text-neon">Produtos</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-2 max-w-md">
              Confira os produtos disponíveis na nossa loja, prontos para você.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/catalog">Ver todos <ArrowRight className="w-4 h-4" /></Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {loading
            ? Array.from({ length: MAX_PRODUCTS }).map((_, i) => <SkeletonCard key={i} />)
            : products.map((product, i) => (
                <div key={product.id} onClick={() => setSelected(product)} className="cursor-pointer">
                  <ProductCard product={product} index={i} />
                </div>
              ))
          }
        </div>
      </div>

      <ProductModal product={selected} onClose={() => setSelected(null)} />
    </section>
  );
}
