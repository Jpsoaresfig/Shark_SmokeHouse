import { describe, it, expect } from "vitest";
import {
  computeMargin, computeRedemption,
  REDEMPTION_POINTS_PER_REAL, MIN_REDEMPTION_MARGIN,
} from "./redemption";

describe("computeMargin", () => {
  it("(preço − custo − imposto) / preço", () => {
    // R$100, custo R$50, imposto 10% (R$10) → lucro 40 → margem 0,40
    expect(computeMargin({ price: 100, costPrice: 50, taxPercent: 10 })).toBeCloseTo(0.4);
  });
  it("sem imposto", () => {
    expect(computeMargin({ price: 100, costPrice: 70 })).toBeCloseTo(0.3);
  });
  it("indeterminada sem custo ou sem preço", () => {
    expect(computeMargin({ price: 100 })).toBeNull();
    expect(computeMargin({ costPrice: 10 })).toBeNull();
    expect(computeMargin({ price: 0, costPrice: 0 })).toBeNull();
  });
  it("aceita custo zero (margem 100%)", () => {
    expect(computeMargin({ price: 100, costPrice: 0 })).toBe(1);
  });
});

describe("computeRedemption — trava de margem + fórmula ×200", () => {
  it("margem ≥ 20% libera; custo = valor × 200", () => {
    const r = computeRedemption({ price: 25, costPrice: 15 }); // margem 0,40
    expect(r.eligible).toBe(true);
    expect(r.basis).toBe("formula");
    expect(r.pointsCost).toBe(25 * REDEMPTION_POINTS_PER_REAL); // 5000
  });
  it("exatamente 20% é elegível (bloqueio é < 20%)", () => {
    const r = computeRedemption({ price: 100, costPrice: 80 }); // margem 0,20
    expect(r.margin).toBeCloseTo(MIN_REDEMPTION_MARGIN);
    expect(r.eligible).toBe(true);
  });
  it("margem abaixo de 20% bloqueia automaticamente", () => {
    const r = computeRedemption({ price: 100, costPrice: 85 }); // margem 0,15
    expect(r.eligible).toBe(false);
    expect(r.basis).toBe("below-margin");
    expect(r.pointsCost).toBeNull();
    // ainda informa a fórmula para a UI
    expect(r.formulaCost).toBe(20000);
  });
  it("imposto reduz a margem e pode bloquear", () => {
    // preço 100, custo 70, imposto 15% (15) → lucro 15 → margem 0,15 < 20%
    const r = computeRedemption({ price: 100, costPrice: 70, taxPercent: 15 });
    expect(r.eligible).toBe(false);
    expect(r.basis).toBe("below-margin");
  });
  it("sem custo cadastrado bloqueia (margem indeterminada)", () => {
    const r = computeRedemption({ price: 100 });
    expect(r.eligible).toBe(false);
    expect(r.basis).toBe("no-cost");
  });
});

describe("computeRedemption — overwrite manual", () => {
  it("desativar vence tudo, mesmo com margem alta", () => {
    const r = computeRedemption({ price: 100, costPrice: 10, redeemDisabled: true });
    expect(r.eligible).toBe(false);
    expect(r.basis).toBe("disabled");
  });
  it("override de pontos libera mesmo com margem baixa", () => {
    const r = computeRedemption({ price: 100, costPrice: 95, loyaltyPointsOverride: 1200 });
    expect(r.eligible).toBe(true);
    expect(r.basis).toBe("override");
    expect(r.pointsCost).toBe(1200);
  });
  it("desativar tem prioridade sobre o override", () => {
    const r = computeRedemption({ price: 100, costPrice: 10, redeemDisabled: true, loyaltyPointsOverride: 500 });
    expect(r.eligible).toBe(false);
    expect(r.basis).toBe("disabled");
  });
});
