"use client";

import { useState, useEffect } from "react";
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
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedVarId, setSelectedVarId] = useState("");
  const { addItem, openCart } = useCartStore();

  /* Trava o scroll de fundo enquanto o modal está aberto e restaura a posição
     exata ao fechar — sem isso o catálogo "volta pro início" no mobile. */
  useEffect(() => {
    if (!product) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prevOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [product]);

  if (!product) return null;

  // Variações (grade) têm prioridade sobre o `colors` legado.
  const variations = product.variations ?? [];
  const hasVariations = variations.length > 0;
  const selectedVar = variations.find(v => v.id === selectedVarId) ?? null;

  // Variação com foto própria: a foto dela vira a principal enquanto selecionada.
  const baseImages = product.images.length > 0 ? product.images : [];
  const images = selectedVar?.image
    ? [selectedVar.image, ...baseImages.filter(u => u !== selectedVar.image)]
    : baseImages;
  const hasImages = images.length > 0;
  const hasMultiple = images.length > 1;
  const discount = product.compareAtPrice
    ? Math.round((1 - product.price / product.compareAtPrice) * 100)
    : null;
  const colors = product.colors ?? [];
  const hasColors = !hasVariations && colors.length > 0;

  // Estoque disponível depende da variação escolhida (quando há grade).
  const availableStock = hasVariations
    ? (selectedVar?.stock ?? 0)
    : product.stock;
  const outOfStock = hasVariations ? variations.every(v => v.stock <= 0) : product.stock === 0;
  const lowStock = availableStock > 0 && availableStock <= 5;

  const needsColor = hasColors && !selectedColor;
  const needsVariation = hasVariations && !selectedVar;

  const handleAdd = () => {
    if (needsColor || needsVariation) return;
    if (hasVariations && selectedVar) {
      addItem(product, qty, {
        color: selectedVar.name,      // exibido no carrinho/pedido
        variationId: selectedVar.id,
        variationSku: selectedVar.sku,
        image: selectedVar.image,     // foto da variação (quando houver)
      });
    } else {
      addItem(product, qty, { color: selectedColor || undefined });
    }
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
                    {discount && (
                      <Badge
                        variant="orange"
                        className="border-0 bg-orange-500 text-white shadow-md shadow-black/30"
                      >
                        -{discount}%
                      </Badge>
                    )}
                    {product.featured && (
                      <Badge
                        variant="premium"
                        className="text-xs border-0 bg-gradient-to-r from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] text-white shadow-md shadow-black/30"
                      >
                        <Star className="w-2.5 h-2.5 fill-white" /> Destaque
                      </Badge>
                    )}
                    {outOfStock && (
                      <Badge
                        variant="destructive"
                        className="border-0 bg-red-500 text-white shadow-md shadow-black/30"
                      >
                        Esgotado
                      </Badge>
                    )}
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
                      : needsVariation ? "Selecione uma variação"
                      : lowStock ? `Últimas ${availableStock} unidades`
                      : "Em estoque"}
                  </span>
                </div>

                {/* Variation selector (grade) */}
                {hasVariations && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Variação {needsVariation && <span className="text-[var(--color-error)] normal-case">— selecione uma</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {variations.map((v) => {
                        const vOut = v.stock <= 0;
                        const selected = selectedVarId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={vOut}
                            onClick={() => { setSelectedVarId(v.id); setQty(1); setImgIndex(0); }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                              vOut
                                ? "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-muted)] line-through opacity-50 cursor-not-allowed"
                                : selected
                                ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                                : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon-blue)]/40"
                            }`}
                          >
                            {v.image && (
                              <Image
                                src={v.image}
                                alt=""
                                width={24}
                                height={24}
                                className="w-6 h-6 rounded-md object-cover shrink-0"
                              />
                            )}
                            {v.name}
                            {vOut && <span className="ml-1 text-[10px]">(esgotado)</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Color selector */}
                {hasColors && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
                      Cor/estampa {needsColor && <span className="text-[var(--color-error)] normal-case">— selecione uma</span>}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={`px-3.5 py-2 rounded-xl text-sm font-medium border transition-all ${
                            selectedColor === c
                              ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                              : "border-[var(--color-border)] bg-[var(--color-bg-overlay)] text-[var(--color-text-secondary)] hover:border-[var(--color-neon-blue)]/40"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
                        onClick={() => setQty(q => Math.max(1, Math.min(availableStock || 1, q + 1)))}
                        className="w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Add to cart */}
                    <Button
                      variant="premium"
                      size="lg"
                      className="flex-1 min-w-0 px-4 h-auto min-h-12 py-2 whitespace-normal leading-tight text-center text-sm sm:text-base sm:px-6"
                      onClick={handleAdd}
                      disabled={added || needsColor || needsVariation}
                    >
                      {added ? (
                        <>
                          <Check className="w-4 h-4" />
                          Adicionado!
                        </>
                      ) : needsVariation ? (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Selecione a variação
                        </>
                      ) : needsColor ? (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          Selecione cor/estampa
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
