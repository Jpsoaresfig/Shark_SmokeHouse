import { describe, it, expect } from "vitest";
import { evaluateCoupon, normalizeCouponCode, isCouponExpired } from "./coupons";
import type { Coupon } from "@/types";

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: "SHARK10", code: "SHARK10", type: "percent", value: 10,
    active: true, createdAt: "", updatedAt: "", ...overrides,
  };
}

const items = [
  { categorySlug: "hookah", lineTotal: 200 },
  { categorySlug: "accessories", lineTotal: 100 },
];

describe("normalizeCouponCode", () => {
  it("maiúsculas e sem espaços", () => {
    expect(normalizeCouponCode("  shark 10 ")).toBe("SHARK10");
  });
});

describe("isCouponExpired", () => {
  it("validade inclusiva no dia", () => {
    const now = new Date("2026-06-13T15:00:00");
    expect(isCouponExpired("2026-06-13", now)).toBe(false);
    expect(isCouponExpired("2026-06-12", now)).toBe(true);
    expect(isCouponExpired(undefined, now)).toBe(false);
  });
});

describe("evaluateCoupon — desconto", () => {
  it("percentual sobre todo o carrinho", () => {
    const r = evaluateCoupon(makeCoupon({ value: 10 }), { items });
    expect(r.valid).toBe(true);
    expect(r.eligibleBase).toBe(300);
    expect(r.discount).toBe(30);
  });
  it("fixo limitado à base elegível", () => {
    const r = evaluateCoupon(makeCoupon({ type: "fixed", value: 500 }), { items });
    expect(r.discount).toBe(300); // não passa do subtotal
  });
});

describe("evaluateCoupon — travas", () => {
  it("inativo", () => {
    expect(evaluateCoupon(makeCoupon({ active: false }), { items }).reason).toBe("inactive");
  });
  it("expirado", () => {
    const r = evaluateCoupon(makeCoupon({ expiresAt: "2020-01-01" }), { items, now: new Date("2026-06-13") });
    expect(r.reason).toBe("expired");
  });
  it("valor mínimo do pedido", () => {
    const r = evaluateCoupon(makeCoupon({ minOrder: 500 }), { items });
    expect(r.reason).toBe("min-order");
    expect(r.discount).toBe(0);
  });
  it("restrição por categoria — desconto só sobre itens elegíveis", () => {
    const r = evaluateCoupon(makeCoupon({ value: 50, categories: ["hookah"] }), { items });
    expect(r.eligibleBase).toBe(200);
    expect(r.discount).toBe(100); // 50% de 200, não de 300
  });
  it("restrição por categoria — sem itens elegíveis", () => {
    const r = evaluateCoupon(makeCoupon({ categories: ["clothing"] }), { items });
    expect(r.reason).toBe("no-eligible-items");
  });
  it("limite por CPF exige CPF", () => {
    expect(evaluateCoupon(makeCoupon({ usageLimitPerCpf: 1 }), { items }).reason).toBe("cpf-required");
  });
  it("limite por CPF atingido", () => {
    const r = evaluateCoupon(makeCoupon({ usageLimitPerCpf: 1 }), { items, cpf: "52998224725", priorUsesForCpf: 1 });
    expect(r.reason).toBe("limit-reached");
  });
  it("limite por CPF ainda disponível", () => {
    const r = evaluateCoupon(makeCoupon({ usageLimitPerCpf: 2 }), { items, cpf: "52998224725", priorUsesForCpf: 1 });
    expect(r.valid).toBe(true);
  });
});
