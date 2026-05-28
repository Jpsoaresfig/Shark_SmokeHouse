"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Star, ArrowRight, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Charuto Cohiba Siglo VI",
    slug: "charuto-cohiba-siglo-vi",
    description: "O lendário charuto cubano em sua expressão máxima de luxo.",
    price: 280,
    compareAtPrice: 320,
    category: "cigars",
    images: [],
    stock: 15,
    minStock: 3,
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Kit Narguilé Premium MZ",
    slug: "kit-narguile-premium-mz",
    description: "Kit completo para a experiência perfeita de narguilé.",
    price: 450,
    category: "hookah",
    images: [],
    stock: 8,
    minStock: 2,
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Whisky Glenfiddich 18Y",
    slug: "whisky-glenfiddich-18y",
    description: "Single malt escocês com 18 anos de maturação elegante.",
    price: 390,
    compareAtPrice: 420,
    category: "beverages",
    images: [],
    stock: 20,
    minStock: 5,
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Essência Adalya Love 66",
    slug: "essencia-adalya-love-66",
    description: "A essência mais popular do mundo, sabor único e inconfundível.",
    price: 55,
    category: "hookah",
    images: [],
    stock: 50,
    minStock: 10,
    featured: true,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const categoryLabels: Record<string, string> = {
  cigars: "Charutos",
  hookah: "Narguilé",
  beverages: "Bebidas",
  accessories: "Acessórios",
};

function ProductCard({ product, index }: { product: Product; index: number }) {
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
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
              <span className="text-xs text-[var(--color-text-muted)]">Sem imagem</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
            {discount && (
              <Badge variant="orange" className="text-xs">-{discount}%</Badge>
            )}
            {product.featured && (
              <Badge variant="premium" className="text-xs">
                <Star className="w-2.5 h-2.5" />
                Destaque
              </Badge>
            )}
          </div>

          {/* Quick add overlay */}
          <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <Button variant="premium" size="sm" className="w-full">
              <ShoppingCart className="w-3.5 h-3.5" />
              Adicionar ao Carrinho
            </Button>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <span className="text-xs text-[var(--color-neon-blue)] font-medium uppercase tracking-wide">
            {categoryLabels[product.category] ?? product.category}
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
        </div>
      </div>
    </motion.div>
  );
}

export function FeaturedProducts() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12"
        >
          <div>
            <Badge variant="default" className="mb-3">Seleção Premium</Badge>
            <h2 className="text-3xl sm:text-4xl font-black text-[var(--color-text-primary)]">
              Produtos em
              <span className="text-neon"> Destaque</span>
            </h2>
            <p className="text-[var(--color-text-secondary)] mt-2 max-w-md">
              Curadoria exclusiva dos melhores produtos para os verdadeiros apreciadores.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/catalog">
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {mockProducts.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
