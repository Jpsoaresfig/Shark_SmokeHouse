"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, Product } from "@/types";

const DELIVERY_FEE = 8;
const FREE_DELIVERY_THRESHOLD = 150;

interface CartTotals {
  subtotal: number;
  itemCount: number;
  deliveryFee: number;
  total: number;
}

/* Deriva os totais a partir dos itens. Mantido como cálculo explícito porque
   getters no objeto de estado do Zustand são destruídos pelo Object.assign
   interno do `set` (ficam congelados no valor inicial). */
function deriveTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const deliveryFee = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const total = subtotal + deliveryFee;
  return { subtotal, itemCount, deliveryFee, total };
}

interface CartStore extends CartTotals {
  items: CartItem[];
  isOpen: boolean;

  addItem: (product: Product, quantity?: number, notes?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  toggleCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      ...deriveTotals([]),

      addItem: (product, quantity = 1, notes) => {
        const state = get();
        const existing = state.items.find((i) => i.productId === product.id);
        const items = existing
          ? state.items.map((i) =>
              i.productId === product.id
                ? { ...i, quantity: i.quantity + quantity }
                : i
            )
          : [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.images[0] ?? "",
                quantity,
                notes,
                pointsEarned: product.pointsEarned ?? 0,
              },
            ];
        set({ items, ...deriveTotals(items) });
      },

      removeItem: (productId) => {
        const items = get().items.filter((i) => i.productId !== productId);
        set({ items, ...deriveTotals(items) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const items = get().items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i
        );
        set({ items, ...deriveTotals(items) });
      },

      clearCart: () => set({ items: [], ...deriveTotals([]) }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: "shark-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items }),
      // Recalcula os totais a partir dos itens persistidos ao reidratar.
      merge: (persisted, current) => {
        const items = (persisted as { items?: CartItem[] } | undefined)?.items ?? [];
        return { ...current, items, ...deriveTotals(items) };
      },
    }
  )
);
