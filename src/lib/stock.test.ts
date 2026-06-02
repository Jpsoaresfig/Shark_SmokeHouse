import { describe, it, expect } from "vitest";
import { findStockShortages, describeShortages } from "@/lib/stock";

describe("findStockShortages", () => {
  it("libera quando o pedido está dentro do estoque", () => {
    const items = [{ productId: "a", name: "Camiseta", quantity: 2 }];
    const products = [{ id: "a", stock: 5 }];
    expect(findStockShortages(items, products)).toEqual([]);
  });

  it("libera quando a quantidade é exatamente igual ao estoque", () => {
    const items = [{ productId: "a", name: "Camiseta", quantity: 5 }];
    const products = [{ id: "a", stock: 5 }];
    expect(findStockShortages(items, products)).toEqual([]);
  });

  it("bloqueia quando excede o estoque", () => {
    const items = [{ productId: "a", name: "Camiseta", quantity: 6 }];
    const products = [{ id: "a", stock: 5 }];
    expect(findStockShortages(items, products)).toEqual([
      { productId: "a", name: "Camiseta", requested: 6, available: 5 },
    ]);
  });

  it("soma cores/estampas do mesmo produto (estoque compartilhado) e bloqueia", () => {
    const items = [
      { productId: "a", name: "Camiseta", quantity: 5 },
      { productId: "a", name: "Camiseta", quantity: 5 }, // outra cor
    ];
    const products = [{ id: "a", stock: 5 }];
    expect(findStockShortages(items, products)).toEqual([
      { productId: "a", name: "Camiseta", requested: 10, available: 5 },
    ]);
  });

  it("libera quando a soma das cores cabe no estoque", () => {
    const items = [
      { productId: "a", name: "Camiseta", quantity: 2 },
      { productId: "a", name: "Camiseta", quantity: 3 },
    ];
    const products = [{ id: "a", stock: 5 }];
    expect(findStockShortages(items, products)).toEqual([]);
  });

  it("bloqueia produto esgotado (estoque 0)", () => {
    const items = [{ productId: "a", name: "Boné", quantity: 1 }];
    const products = [{ id: "a", stock: 0 }];
    expect(findStockShortages(items, products)).toEqual([
      { productId: "a", name: "Boné", requested: 1, available: 0 },
    ]);
  });

  it("trata produto ausente no catálogo como estoque 0 e bloqueia", () => {
    const items = [{ productId: "x", name: "Removido", quantity: 1 }];
    const products = [{ id: "a", stock: 10 }];
    expect(findStockShortages(items, products)).toEqual([
      { productId: "x", name: "Removido", requested: 1, available: 0 },
    ]);
  });

  it("reporta apenas os itens em falta quando há vários produtos", () => {
    const items = [
      { productId: "a", name: "Camiseta", quantity: 2 }, // ok
      { productId: "b", name: "Jaqueta", quantity: 4 },  // falta
    ];
    const products = [
      { id: "a", stock: 5 },
      { id: "b", stock: 1 },
    ];
    const shortages = findStockShortages(items, products);
    expect(shortages).toHaveLength(1);
    expect(shortages[0].name).toBe("Jaqueta");
  });

  it("não acusa falta com o carrinho vazio", () => {
    expect(findStockShortages([], [{ id: "a", stock: 5 }])).toEqual([]);
  });
});

describe("describeShortages", () => {
  it("descreve 'esgotado' quando o disponível é 0", () => {
    const msg = describeShortages([
      { productId: "a", name: "Boné", requested: 1, available: 0 },
    ]);
    expect(msg).toBe("Boné: esgotado (você pediu 1)");
  });

  it("descreve a quantidade disponível quando há estoque parcial", () => {
    const msg = describeShortages([
      { productId: "a", name: "Camiseta", requested: 9, available: 3 },
    ]);
    expect(msg).toBe("Camiseta: só 3 em estoque (você pediu 9)");
  });

  it("combina múltiplas faltas com ' · '", () => {
    const msg = describeShortages([
      { productId: "a", name: "Camiseta", requested: 9, available: 3 },
      { productId: "b", name: "Boné", requested: 1, available: 0 },
    ]);
    expect(msg).toBe(
      "Camiseta: só 3 em estoque (você pediu 9) · Boné: esgotado (você pediu 1)",
    );
  });
});
