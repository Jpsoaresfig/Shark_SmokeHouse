"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingBag, Minus, Plus, Trash2, ArrowRight, ArrowLeft, Package,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/stores/cartStore";
import { useSiteCart } from "@/stores/siteSettingsStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CartPerks } from "@/components/shop/CartPerks";
import { formatCurrency } from "@/lib/utils";

export default function CartPage() {
  const cartStore = useCartStore();
  const { items, removeItem, updateQuantity, clearCart, subtotal, total, itemCount } = cartStore;
  const { freeShippingEnabled, freeShippingThreshold } = useSiteCart();
  const freeShipping = freeShippingEnabled && freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;

  /* Evita mismatch de hidratação: o carrinho vem do localStorage (persist), então
     só renderizamos o conteúdo dependente dos itens depois de montar no cliente. */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (mounted && items.length === 0) {
    return (
      <div className="min-h-screen pt-24 pb-20 px-4 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
            Seu carrinho está vazio
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6">
            Adicione produtos para começar o seu pedido.
          </p>
          <Button variant="premium" asChild>
            <Link href="/catalog">
              Explorar catálogo
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-28 md:pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Back */}
        <div className="flex items-center gap-3 mb-6 pt-4">
          <Link
            href="/catalog"
            className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Continuar comprando
          </Link>
          <span className="text-[var(--color-border)]">/</span>
          <span className="text-sm text-[var(--color-text-primary)] font-medium">Carrinho</span>
        </div>

        <div className="flex items-center gap-2.5 mb-6">
          <ShoppingBag className="w-6 h-6 text-[var(--color-neon-blue)]" />
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Meu Carrinho</h1>
          {mounted && itemCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] text-xs font-semibold">
              {itemCount} {itemCount === 1 ? "item" : "itens"}
            </span>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* ── LEFT: items ──────────────────────────────── */}
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {mounted && items.map((item) => (
                <motion.div
                  key={item.productId + (item.color ?? "")}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Product image */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[var(--color-bg-overlay)] overflow-hidden shrink-0 relative">
                          {item.image ? (
                            <Image src={item.image} alt={item.name} fill className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-7 h-7 text-[var(--color-text-muted)]" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)] line-clamp-2">
                                {item.name}
                              </p>
                              {item.color && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                  Cor/estampa: {item.color}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                  Obs.: {item.notes}
                                </p>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem(item.productId, item.color)}
                              className="w-9 h-9 shrink-0 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 rounded-lg transition-colors"
                              aria-label="Remover item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <p className="text-sm text-[var(--color-neon-blue)] font-semibold mt-1">
                            {formatCurrency(item.price)}
                          </p>

                          {/* Quantity controls + line total */}
                          <div className="flex items-center justify-between gap-2 mt-auto pt-3">
                            <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.color)}
                                className="w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors active:bg-[var(--color-bg-hover)]"
                                aria-label="Diminuir"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-9 text-center text-sm font-semibold text-[var(--color-text-primary)]">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.color)}
                                className="w-10 h-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors active:bg-[var(--color-bg-hover)]"
                                aria-label="Aumentar"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <span className="text-sm sm:text-base font-bold text-[var(--color-text-primary)]">
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>

            {mounted && items.length > 0 && (
              <button
                onClick={clearCart}
                className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors mt-1 px-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Esvaziar carrinho
              </button>
            )}
          </div>

          {/* ── RIGHT: summary ───────────────────────────── */}
          <Card className="lg:sticky lg:top-24">
            <CardContent className="p-5 space-y-4">
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Resumo do Pedido</h2>

              {mounted && <CartPerks subtotal={subtotal} />}

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>Subtotal</span>
                  <span>{mounted ? formatCurrency(subtotal) : "—"}</span>
                </div>
                <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>Entrega</span>
                  {mounted && freeShipping ? (
                    <span className="text-[var(--color-success)] font-medium">Grátis 🎉</span>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">calculada no checkout</span>
                  )}
                </div>
                {!(mounted && freeShipping) && (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    O frete depende do seu bairro e aparece ao finalizar o pedido.
                  </p>
                )}
                <Separator />
                <div className="flex justify-between font-semibold text-[var(--color-text-primary)]">
                  <span>Total</span>
                  <span className="text-[var(--color-neon-blue)]">
                    {mounted ? formatCurrency(total) : "—"}
                  </span>
                </div>
              </div>

              <Button variant="premium" size="lg" className="w-full" asChild>
                <Link href="/checkout">
                  Finalizar Pedido
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" className="w-full" asChild>
                <Link href="/catalog">Continuar comprando</Link>
              </Button>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
