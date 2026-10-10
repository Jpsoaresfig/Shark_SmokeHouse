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
  // Arredonda a centavos: 3 × 19,90 em ponto flutuante dá 59,699999… e o
  // total/cupom/PIX divergiam por 1 centavo.
  const subtotal = roundMoney(items.reduce((acc, i) => acc + i.price * i.quantity, 0));
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  return { subtotal, itemCount, deliveryFee: 0, total: subtotal };
}

/** Arredonda um valor em R$ para 2 casas (centavos). */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** Quantidade válida: inteiro ≥ 1 (NaN/negativo/fração viram 0 = inválido). */
function sanitizeQty(quantity: unknown): number {
  const n = Math.floor(Number(quantity));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Descarta itens corrompidos do localStorage (sem id, preço/quantidade inválidos)
 *  para não gerar subtotal NaN nem pedido com quantidade fracionária. */
export function sanitizeCartItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((i) => {
    if (!i || typeof i !== "object") return [];
    const item = i as CartItem;
    const quantity = sanitizeQty(item.quantity);
    const price = Number(item.price);
    if (typeof item.productId !== "string" || !item.productId) return [];
    if (!quantity || !Number.isFinite(price) || price < 0) return [];
    return [{ ...item, quantity, price }];
  });
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
  /** Atualiza o preço dos itens com o preço atual do catálogo. Retorna true se algo mudou. */
  refreshPrices: (products: Pick<Product, "id" | "price">[]) => boolean;
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
        quantity = sanitizeQty(quantity);
        if (!quantity) return;
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
        quantity = sanitizeQty(quantity);
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

      refreshPrices: (products) => {
        const priceOf = new Map(products.map((p) => [p.id, p.price]));
        let changed = false;
        const items = get().items.map((i) => {
          const current = priceOf.get(i.productId);
          if (typeof current !== "number" || !Number.isFinite(current)) return i;
          if (Math.abs(current - i.price) < 0.005) return i;
          changed = true;
          return { ...i, price: current };
        });
        if (changed) set({ items, ...deriveTotals(items) });
        return changed;
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
        const items = sanitizeCartItems((persisted as { items?: unknown } | undefined)?.items);
        return { ...current, items, ...deriveTotals(items) };
      },
    }
  )
);
