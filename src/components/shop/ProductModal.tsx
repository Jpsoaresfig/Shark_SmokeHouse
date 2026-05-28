"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingCart, Plus, Minus, Check, Package, ChevronLeft, ChevronRight, Star } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/stores/cartStore";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";

const CATEGORY_LABEL: Record<string, string> = {
  cigars: "Charutos", hookah: "Narguilé", cigarettes: "Cigarros",
  accessories: "Acessórios", beverages: "Bebidas", clothing: "Vestuário",
  kits: "Kits", premium: "Premium",
};

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export function ProductModal({ product, onClose }: ProductModalProps) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);
  const { addItem, openCart } = useCartStore();

  if (!product) return null;

  const images = product.images.length > 0 ? product.images : [];
  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;
  const outOfStock = product.stock === 0;
  const lowStock = product.stock > 0 && product.stock <= 5;

  const handleAdd = () => {
    addItem(product, qty);
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      onClose();
      openCart();
    }, 900);
  };

  const prevImg = () => setImgIndex(i => (i - 1 + images.length) % images.length);
  const nextImg = () => setImgIndex(i => (i + 1) % images.length);

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)] overflow-hidden flex flex-col md:flex-row pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Close */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* ── Left: Image ── */}
              <div className="relative w-full md:w-[420px] shrink-0 bg-[var(--color-bg-overlay)]">
                <div className="aspect-square md:aspect-auto md:h-full relative">
                  {hasImages ? (
                    <>
                      <Image
                        src={images[imgIndex]}
                        alt={product.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 420px"
                        className="object-cover"
                        priority
                      />

                      {/* Nav arrows */}
                      {hasMultiple && (
                        <>
                          <button
                            onClick={prevImg}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={nextImg}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>

                          {/* Dots */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {images.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => setImgIndex(i)}
                                className={`w-1.5 h-1.5 rounded-full transition-all ${
                                  i === imgIndex
                                    ? "bg-white w-4"
                                    : "bg-white/50"
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Thumbnails strip */}
                      {hasMultiple && (
                        <div className="absolute bottom-0 left-0 right-0 hidden md:flex gap-1.5 p-2 bg-gradient-to-t from-black/60 to-transparent">
                          {images.map((url, i) => (
                            <button
                              key={i}
                              onClick={() => setImgIndex(i)}
                              className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                                i === imgIndex
                                  ? "border-[var(--color-neon-blue)] shadow-[var(--shadow-neon-sm)]"
                                  : "border-transparent opacity-60 hover:opacity-100"
                              }`}
                            >
                              <Image src={url} alt="" width={40} height={40} className="object-cover w-full h-full" />
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-3 min-h-[300px]">
                      <Package className="w-16 h-16 text-[var(--color-text-muted)]" />
                      <p className="text-sm text-[var(--color-text-muted)]">Sem imagem</p>
                    </div>
                  )}

                  {/* Badges overlay */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {discount && <Badge variant="orange">-{discount}%</Badge>}
                    {product.featured && (
                      <Badge variant="premium" className="text-xs">
                        <Star className="w-2.5 h-2.5" /> Destaque
                      </Badge>
                    )}
                    {outOfStock && <Badge variant="destructive">Esgotado</Badge>}
                  </div>
                </div>
              </div>

              {/* ── Right: Info ── */}
              <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-5">
                {/* Category + name */}
                <div>
                  <p className="text-xs font-semibold text-[var(--color-neon-blue)] uppercase tracking-widest mb-2">
                    {CATEGORY_LABEL[product.category] ?? product.category}
                  </p>
                  <h2 className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] leading-tight">
                    {product.name}
                  </h2>
                  {product.sku && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">SKU: {product.sku}</p>
                  )}
                </div>

                {/* Price */}
                <div className="flex items-end gap-3">
                  <span className="text-3xl font-black text-[var(--color-neon-blue)]">
                    {formatCurrency(product.price)}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-base text-[var(--color-text-muted)] line-through mb-0.5">
                      {formatCurrency(product.compareAtPrice)}
                    </span>
                  )}
                </div>

                {/* Short description */}
                {product.shortDescription && (
                  <p className="text-sm font-medium text-[var(--color-text-secondary)] leading-relaxed">
                    {product.shortDescription}
                  </p>
                )}

                {/* Full description */}
                {product.description && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Descrição
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-line">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Stock status */}
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    outOfStock ? "bg-[var(--color-error)]" :
                    lowStock   ? "bg-amber-400" :
                                 "bg-[var(--color-success)]"
                  }`} />
                  <span className={`font-medium ${
                    outOfStock ? "text-[var(--color-error)]" :
                    lowStock   ? "text-amber-400" :
                                 "text-[var(--color-success)]"
                  }`}>
                    {outOfStock ? "Esgotado"
                      : lowStock ? `Últimas ${product.stock} unidades`
                      : "Em estoque"}
                  </span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Quantity + Add */}
                {!outOfStock && (
                  <div className="flex items-center gap-3 pt-2 border-t border-[var(--color-border)]">
                    {/* Qty selector */}
                    <div className="flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] overflow-hidden">
                      <button
                        onClick={() => setQty(q => Math.max(1, q - 1))}
                        className="w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold text-[var(--color-text-primary)]">
                        {qty}
                      </span>
                      <button
                        onClick={() => setQty(q => Math.min(product.stock, q + 1))}
                        className="w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Add to cart */}
                    <Button
                      variant="premium"
                      size="lg"
                      className="flex-1"
                      onClick={handleAdd}
                      disabled={added}
                    >
                      {added ? (
                        <>
                          <Check className="w-4 h-4" />
                          Adicionado!
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Adicionar ao Carrinho
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
