import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore } from "@/stores/cartStore";
import type { Product } from "@/types";

/** Produto mínimo válido — o store só lê id/name/price/images/pointsEarned. */
function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Produto",
    price: 10,
    images: ["img.jpg"],
    category: "accessories",
    active: true,
    stock: 100,
    ...over,
  } as Product;
}

const store = () => useCartStore.getState();

beforeEach(() => {
  // Zustand é singleton: zera carrinho e drawer antes de cada teste.
  store().clearCart();
  store().closeCart();
});

describe("addItem", () => {
  it("adiciona um novo item e calcula os totais", () => {
    store().addItem(makeProduct({ price: 10 }), 2);
    const s = store();
    expect(s.items).toHaveLength(1);
    expect(s.items[0]).toMatchObject({ productId: "p1", name: "Produto", price: 10, quantity: 2 });
    expect(s.subtotal).toBe(20);
    expect(s.itemCount).toBe(2);
  });

  it("usa quantidade 1 por padrão", () => {
    store().addItem(makeProduct());
    expect(store().items[0].quantity).toBe(1);
    expect(store().itemCount).toBe(1);
  });

  it("incrementa a quantidade ao adicionar o mesmo produto (mesma cor)", () => {
    const p = makeProduct();
    store().addItem(p, 1);
    store().addItem(p, 2);
    expect(store().items).toHaveLength(1);
    expect(store().items[0].quantity).toBe(3);
    expect(store().itemCount).toBe(3);
  });

  it("cria linhas separadas para o mesmo produto em cores/estampas diferentes", () => {
    const p = makeProduct();
    store().addItem(p, 1, { color: "Preto" });
    store().addItem(p, 1, { color: "Vermelho" });
    expect(store().items).toHaveLength(2);
    expect(store().items.map((i) => i.color)).toEqual(["Preto", "Vermelho"]);
  });

  it("agrupa adições da mesma cor na mesma linha", () => {
    const p = makeProduct();
    store().addItem(p, 1, { color: "Preto" });
    store().addItem(p, 2, { color: "Preto" });
    expect(store().items).toHaveLength(1);
    expect(store().items[0].quantity).toBe(3);
  });

  it("não inclui a chave color quando o produto não tem cor", () => {
    store().addItem(makeProduct());
    expect(store().items[0]).not.toHaveProperty("color");
  });

  it("guarda os pontos do produto (snapshot), com 0 como padrão", () => {
    store().addItem(makeProduct({ pointsEarned: 50 }));
    expect(store().items[0].pointsEarned).toBe(50);
    store().clearCart();
    store().addItem(makeProduct());
    expect(store().items[0].pointsEarned).toBe(0);
  });

  it("usa a primeira imagem do produto, ou string vazia se não houver", () => {
    store().addItem(makeProduct({ images: [] }));
    expect(store().items[0].image).toBe("");
  });
});

describe("frete (deliveryFee)", () => {
  it("é 0 com o carrinho vazio", () => {
    expect(store().deliveryFee).toBe(0);
    expect(store().total).toBe(0);
  });

  it("cobra R$8 quando o subtotal está abaixo de R$150", () => {
    store().addItem(makeProduct({ price: 100 }), 1); // subtotal 100
    expect(store().deliveryFee).toBe(8);
    expect(store().total).toBe(108);
  });

  it("zera o frete no limite de R$150 (frete grátis)", () => {
    store().addItem(makeProduct({ price: 150 }), 1);
    expect(store().subtotal).toBe(150);
    expect(store().deliveryFee).toBe(0);
    expect(store().total).toBe(150);
  });

  it("mantém frete grátis acima do limite", () => {
    store().addItem(makeProduct({ price: 200 }), 1);
    expect(store().deliveryFee).toBe(0);
    expect(store().total).toBe(200);
  });
});

describe("removeItem", () => {
  it("remove o item e recalcula os totais", () => {
    store().addItem(makeProduct({ price: 10 }), 2);
    store().removeItem("p1");
    expect(store().items).toHaveLength(0);
    expect(store().subtotal).toBe(0);
    expect(store().itemCount).toBe(0);
  });

  it("remove apenas a cor indicada, preservando as outras", () => {
    const p = makeProduct();
    store().addItem(p, 1, { color: "Preto" });
    store().addItem(p, 1, { color: "Vermelho" });
    store().removeItem("p1", "Preto");
    expect(store().items).toHaveLength(1);
    expect(store().items[0].color).toBe("Vermelho");
  });

  it("não remove a linha colorida ao chamar sem cor", () => {
    const p = makeProduct();
    store().addItem(p, 1, { color: "Preto" });
    store().removeItem("p1"); // color undefined -> alvo é a linha sem cor
    expect(store().items).toHaveLength(1);
  });
});

describe("updateQuantity", () => {
  it("atualiza a quantidade de uma linha", () => {
    store().addItem(makeProduct({ price: 10 }), 1);
    store().updateQuantity("p1", 4);
    expect(store().items[0].quantity).toBe(4);
    expect(store().subtotal).toBe(40);
  });

  it("remove a linha quando a quantidade chega a 0", () => {
    store().addItem(makeProduct(), 2);
    store().updateQuantity("p1", 0);
    expect(store().items).toHaveLength(0);
  });

  it("remove a linha quando a quantidade fica negativa", () => {
    store().addItem(makeProduct(), 1);
    store().updateQuantity("p1", -3);
    expect(store().items).toHaveLength(0);
  });

  it("atualiza somente a cor correspondente", () => {
    const p = makeProduct();
    store().addItem(p, 1, { color: "Preto" });
    store().addItem(p, 1, { color: "Vermelho" });
    store().updateQuantity("p1", 5, "Vermelho");
    const preto = store().items.find((i) => i.color === "Preto");
    const vermelho = store().items.find((i) => i.color === "Vermelho");
    expect(preto?.quantity).toBe(1);
    expect(vermelho?.quantity).toBe(5);
  });
});

describe("ações do drawer e clearCart", () => {
  it("clearCart esvazia o carrinho e zera os totais", () => {
    store().addItem(makeProduct({ price: 10 }), 3);
    store().clearCart();
    const s = store();
    expect(s.items).toEqual([]);
    expect(s.subtotal).toBe(0);
    expect(s.itemCount).toBe(0);
    expect(s.total).toBe(0);
  });

  it("open/close/toggle controlam o estado do drawer", () => {
    store().openCart();
    expect(store().isOpen).toBe(true);
    store().closeCart();
    expect(store().isOpen).toBe(false);
    store().toggleCart();
    expect(store().isOpen).toBe(true);
    store().toggleCart();
    expect(store().isOpen).toBe(false);
  });
});
