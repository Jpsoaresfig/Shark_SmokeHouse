"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, Product } from "@/types";

interface CartTotals {
  subtotal: number;
  itemCount: number;
  deliveryFee: number;
  total: number;
}

/* Deriva os totais a partir dos itens. O frete agora é por bairro, calculado no
   checkout (não dá para saber no carrinho), então aqui deliveryFee = 0 e o total
   é o subtotal. Mantido como cálculo explícito porque getters no objeto de estado
   do Zustand são destruídos pelo Object.assign interno do `set`. */
function deriveTotals(items: CartItem[]): CartTotals {
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  return { subtotal, itemCount, deliveryFee: 0, total: subtotal };
}

interface CartStore extends CartTotals {
  items: CartItem[];
  isOpen: boolean;

  addItem: (
    product: Product,
    quantity?: number,
    opts?: { notes?: string; color?: string; variationId?: string; variationSku?: string; image?: string },
  ) => void;
  removeItem: (productId: string, color?: string) => void;
  updateQuantity: (productId: string, quantity: number, color?: string) => void;
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

      addItem: (product, quantity = 1, opts) => {
        const { notes, color, variationId, variationSku, image } = opts ?? {};
        const state = get();
        // Mesma peça em variações/cores diferentes = linhas separadas (productId + color).
        // Para variações, `color` recebe o nome da variação, então a mesma chave serve.
        const existing = state.items.find(
          (i) => i.productId === product.id && (i.color ?? "") === (color ?? "")
        );
        const items = existing
          ? state.items.map((i) =>
              i.productId === product.id && (i.color ?? "") === (color ?? "")
                ? { ...i, quantity: i.quantity + quantity }
                : i
            )
          : [
              ...state.items,
              {
                productId: product.id,
                name: product.name,
                price: product.price,
                // Foto da variação escolhida (quando houver) > foto principal.
                image: image ?? product.images[0] ?? "",
                quantity,
                ...(color ? { color } : {}),
                ...(variationId ? { variationId } : {}),
                ...(variationSku ? { variationSku } : {}),
                notes,
                pointsEarned: product.pointsEarned ?? 0,
              },
            ];
        set({ items, ...deriveTotals(items) });
      },

      removeItem: (productId, color) => {
        const items = get().items.filter(
          (i) => !(i.productId === productId && (i.color ?? "") === (color ?? ""))
        );
        set({ items, ...deriveTotals(items) });
      },

      updateQuantity: (productId, quantity, color) => {
        if (quantity <= 0) {
          get().removeItem(productId, color);
          return;
        }
        const items = get().items.map((i) =>
          i.productId === productId && (i.color ?? "") === (color ?? "")
            ? { ...i, quantity }
            : i
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
