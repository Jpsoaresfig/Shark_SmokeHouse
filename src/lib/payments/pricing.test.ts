import { describe, it, expect } from "vitest";
import { checkOrderPricing, type PricingContext } from "./pricing";
import type { Coupon, Order } from "@/types";

const products: PricingContext["products"] = new Map([
  ["p1", { id: "p1", price: 19.9, category: "essencias" }],
  ["p2", { id: "p2", price: 100, category: "narguiles", variations: [{ id: "v1" }] }],
]);

const ctx: PricingContext = {
  products,
  deliveryAreas: [
    { name: "Manaíra", fee: 15, active: true },
    { name: "Bessa", fee: 20, active: false },
  ],
  freeShipping: { enabled: true, threshold: 150 },
};

type O = Parameters<typeof checkOrderPricing>[0];

function order(overrides: Partial<O> = {}): O {
  return {
    items: [{ productId: "p1", name: "Essência", price: 19.9, image: "", quantity: 3 }],
    subtotal: 59.7,
    deliveryFee: 15,
    total: 74.7,
    deliveryAddress: {
      id: "a", label: "Entrega", street: "R", number: "1",
      neighborhood: "Manaira", city: "JP", state: "PB", zipCode: "58000-000",
    },
    ...overrides,
  } as O;
}

const pickup: Order["deliveryAddress"] = {
  id: "pickup", label: "Retirada na loja",
  street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "",
};

describe("checkOrderPricing", () => {
  it("aceita um pedido íntegro (com arredondamento de centavos)", () => {
    const r = checkOrderPricing(order(), ctx);
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.expectedTotal).toBe(74.7);
  });

  it("recusa preço de item adulterado", () => {
    const r = checkOrderPricing(
      order({
        items: [{ productId: "p1", name: "x", price: 0.01, image: "", quantity: 3 }],
        subtotal: 0.03,
        total: 15.03,
      }),
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.expectedTotal).toBe(74.7);
  });

  it("recusa total adulterado mesmo com itens corretos", () => {
    expect(checkOrderPricing(order({ total: 1 }), ctx).ok).toBe(false);
  });

  it("recusa quantidade fracionária/negativa", () => {
    const r = checkOrderPricing(
      order({ items: [{ productId: "p1", name: "x", price: 19.9, image: "", quantity: -1 }] }),
      ctx,
    );
    expect(r.ok).toBe(false);
  });

  it("recusa frete zerado sem frete grátis e bairro inativo", () => {
    expect(checkOrderPricing(order({ deliveryFee: 0, total: 59.7 }), ctx).ok).toBe(false);
    const bessa = { ...order().deliveryAddress, neighborhood: "Bessa" };
    expect(checkOrderPricing(order({ deliveryAddress: bessa, deliveryFee: 20, total: 79.7 }), ctx).ok).toBe(false);
  });

  it("aceita frete grátis quando o subtotal atinge o limite", () => {
    const r = checkOrderPricing(
      order({
        items: [{ productId: "p2", name: "N", price: 100, image: "", quantity: 2, variationId: "v1" }],
        subtotal: 200,
        deliveryFee: 0,
        total: 200,
      }),
      ctx,
    );
    expect(r.ok).toBe(true);
  });

  it("retirada não tem frete", () => {
    expect(checkOrderPricing(order({ deliveryAddress: pickup, deliveryFee: 0, total: 59.7 }), ctx).ok).toBe(true);
  });

  it("recusa variação inexistente", () => {
    const r = checkOrderPricing(
      order({
        items: [{ productId: "p2", name: "N", price: 100, image: "", quantity: 1, variationId: "zz" }],
        subtotal: 100, deliveryAddress: pickup, deliveryFee: 0, total: 100,
      }),
      ctx,
    );
    expect(r.ok).toBe(false);
  });

  it("desconto exige cupom resgatado e válido", () => {
    const base = order({ deliveryAddress: pickup, deliveryFee: 0, discount: 5.97, total: 53.73 });
    expect(checkOrderPricing(base, ctx).ok).toBe(false);
    const coupon: Coupon = {
      id: "SHARK10", code: "SHARK10", type: "percent", value: 10,
      active: true, createdAt: "", updatedAt: "",
    };
    expect(checkOrderPricing(base, { ...ctx, coupon }).ok).toBe(true);
    // desconto maior que o cupom permite
    expect(
      checkOrderPricing({ ...base, discount: 30, total: 29.7 }, { ...ctx, coupon }).ok,
    ).toBe(false);
    // limite por CPF já atingido em outro pedido
    expect(
      checkOrderPricing(base, {
        ...ctx, coupon: { ...coupon, usageLimitPerCpf: 1 }, couponCpf: "123", priorCouponUses: 1,
      }).ok,
    ).toBe(false);
  });

  it("taxa de cartão não é aceita em cobrança online", () => {
    expect(checkOrderPricing(order({ cardFee: -10, total: 64.7 }), ctx).ok).toBe(false);
  });
});

describe("checkOrderPricing — taxa de cartão (maquininha)", () => {
  // base = 59,70 + 15 = 74,70; 5% = 3,735 → 3,74 (mesmo arredondamento do checkout)
  it("aceita a taxa calculada pelo servidor e soma ao total", () => {
    const r = checkOrderPricing(order({ cardFee: 3.74, total: 78.44 }), { ...ctx, cardFeePercent: 5 });
    expect(r.problems).toEqual([]);
    expect(r.expectedTotal).toBe(78.44);
  });

  it("recusa taxa de cartão zerada pelo cliente quando há acréscimo", () => {
    const r = checkOrderPricing(order({ cardFee: 0, total: 74.7 }), { ...ctx, cardFeePercent: 5 });
    expect(r.ok).toBe(false);
  });

  it("aceita desconto no cartão (percentual negativo)", () => {
    const r = checkOrderPricing(order({ cardFee: -1.49, total: 73.21 }), { ...ctx, cardFeePercent: -2 });
    expect(r.problems).toEqual([]);
  });

  it("recusa taxa de cartão quando não há percentual (PIX)", () => {
    const r = checkOrderPricing(order({ cardFee: 2, total: 76.7 }), ctx);
    expect(r.ok).toBe(false);
  });
});
