import type { CartItem, Product } from "@/types";

export interface StockShortage {
  productId: string;
  name: string;
  requested: number;
  available: number;
}

/**
 * Compara o que o carrinho pede contra o estoque atual. Quando o item é de uma
 * variação (grade), confere contra o estoque DAQUELA variação; senão, contra o
 * estoque simples do produto. Itens da mesma variação somam. Retorna a lista de
 * itens cuja quantidade pedida excede o disponível — vazia quando tudo cabe.
 * Produto/variação ausente conta como estoque 0.
 */
export function findStockShortages(
  items: Pick<CartItem, "productId" | "name" | "quantity" | "variationId" | "color">[],
  products: Pick<Product, "id" | "stock" | "variations">[],
): StockShortage[] {
  const productById = new Map(products.map((p) => [p.id, p]));

  const wanted = new Map<string, { productId: string; variationId?: string; name: string; qty: number }>();
  for (const it of items) {
    const key = it.variationId ? `${it.productId}:${it.variationId}` : it.productId;
    const cur = wanted.get(key);
    if (cur) {
      cur.qty += it.quantity;
    } else {
      const name = it.color ? `${it.name} (${it.color})` : it.name;
      wanted.set(key, { productId: it.productId, variationId: it.variationId, name, qty: it.quantity });
    }
  }

  const shortages: StockShortage[] = [];
  for (const w of wanted.values()) {
    const product = productById.get(w.productId);
    const available = !product
      ? 0
      : w.variationId
        ? product.variations?.find((v) => v.id === w.variationId)?.stock ?? 0
        : product.stock ?? 0;
    if (w.qty > available) {
      shortages.push({ productId: w.productId, name: w.name, requested: w.qty, available });
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
