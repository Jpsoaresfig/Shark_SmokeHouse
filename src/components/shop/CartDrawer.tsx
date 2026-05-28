"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ShoppingBag, Minus, Plus, Trash2, ArrowRight, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCartStore } from "@/stores/cartStore";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

export function CartDrawer() {
  const cartStore = useCartStore();
  const { items, isOpen, closeCart, removeItem, updateQuantity, subtotal, deliveryFee, total } = cartStore;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col glass-strong border-l border-[var(--color-border)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-[var(--color-neon-blue)]" />
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Carrinho
                </h2>
                {items.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)] text-xs font-semibold">
                    {items.length}
                  </span>
                )}
              </div>
              <button
                onClick={closeCart}
                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-4 px-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
                    <Package className="w-8 h-8 text-[var(--color-text-muted)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                      Carrinho vazio
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Adicione produtos para começar
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild onClick={closeCart}>
                    <Link href="/catalog">Explorar catálogo</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <motion.div
                        key={item.productId}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="flex gap-3 p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
                          {/* Product image */}
                          <div className="w-16 h-16 rounded-lg bg-[var(--color-bg-overlay)] overflow-hidden shrink-0 relative">
                            {item.image ? (
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-[var(--color-text-muted)]" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate mb-1">
                              {item.name}
                            </p>
                            <p className="text-sm font-semibold text-[var(--color-neon-blue)]">
                              {formatCurrency(item.price)}
                            </p>

                            {/* Quantity controls */}
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden">
                                <button
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center text-sm font-medium text-[var(--color-text-primary)]">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <button
                                onClick={() => removeItem(item.productId)}
                                className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-error)] hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="ml-auto text-sm font-semibold text-[var(--color-text-primary)]">
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer / Summary */}
            {items.length > 0 && (
              <div className="border-t border-[var(--color-border)] px-6 py-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Entrega</span>
                    <span className={deliveryFee === 0 ? "text-[var(--color-success)]" : ""}>
                      {deliveryFee === 0 ? "Grátis" : formatCurrency(deliveryFee)}
                    </span>
                  </div>
                  {deliveryFee > 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Frete grátis acima de {formatCurrency(150)}
                    </p>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-[var(--color-text-primary)]">
                    <span>Total</span>
                    <span className="text-[var(--color-neon-blue)]">{formatCurrency(total)}</span>
                  </div>
                </div>

                <Button variant="premium" size="lg" className="w-full" asChild onClick={closeCart}>
                  <Link href="/checkout">
                    Finalizar Pedido
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" className="w-full" asChild onClick={closeCart}>
                  <Link href="/cart">Ver carrinho completo</Link>
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
