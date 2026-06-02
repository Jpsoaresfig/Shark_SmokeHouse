import type { CartItem, Product } from "@/types";

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

/**
 * Compara o que o carrinho pede contra o estoque atual, somando a quantidade de
 * todas as cores/estampas do mesmo produto (o estoque é compartilhado entre as
 * variações). Retorna a lista de itens cuja quantidade pedida excede o disponível
 * — vazia quando tudo cabe. Produto ausente em `products` (ex.: removido do
 * catálogo) conta como estoque 0.
 */
export function findStockShortages(
  items: Pick<CartItem, "productId" | "name" | "quantity">[],
  products: Pick<Product, "id" | "stock">[],
): StockShortage[] {
  const stockById = new Map(products.map((p) => [p.id, p.stock]));
  const wantedById = new Map<string, number>();
  for (const it of items) {
    wantedById.set(it.productId, (wantedById.get(it.productId) ?? 0) + it.quantity);
  }

  const shortages: StockShortage[] = [];
  for (const [productId, requested] of wantedById) {
    const available = stockById.get(productId) ?? 0;
    if (requested > available) {
      const name = items.find((i) => i.productId === productId)?.name ?? "Produto";
      shortages.push({ productId, name, requested, available });
    }
  }
  return shortages;
}

/** Mensagem amigável para um conjunto de faltas de estoque. */
export function describeShortages(shortages: StockShortage[]): string {
  return shortages
    .map((s) => `${s.name}: ${s.available === 0 ? "esgotado" : `só ${s.available} em estoque`} (você pediu ${s.requested})`)
    .join(" · ");
}
