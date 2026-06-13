import { describe, it, expect } from "vitest";
import {
  getLevel, getNextLevel, getLevelProgress, computeOrderPoints, computeOrderPointsForItems,
  birthdayBonusFor, isExpired, expiresAt, isBirthdayMonth, planExpiry,
  WELCOME_BONUS_POINTS, POINTS_VALIDITY_DAYS,
} from "./levels";

describe("getLevel — faixas e fronteiras", () => {
  it("Baby Shark de 0 a 2.999", () => {
    expect(getLevel(0).name).toBe("Baby Shark");
    expect(getLevel(2999).name).toBe("Baby Shark");
  });
  it("Hunter Shark de 3.000 a 5.999", () => {
    expect(getLevel(3000).name).toBe("Hunter Shark");
    expect(getLevel(5999).name).toBe("Hunter Shark");
  });
  it("Predatory Shark de 6.000 a 9.999", () => {
    expect(getLevel(6000).name).toBe("Predatory Shark");
    expect(getLevel(9999).name).toBe("Predatory Shark");
  });
  it("Megalodon a partir de 10.000", () => {
    expect(getLevel(10000).name).toBe("Megalodon");
    expect(getLevel(1_000_000).name).toBe("Megalodon");
  });
  it("saldo negativo/indefinido cai no nível inicial", () => {
    expect(getLevel(-50).name).toBe("Baby Shark");
    expect(getLevel(undefined as unknown as number).name).toBe("Baby Shark");
  });
});

describe("getNextLevel / getLevelProgress", () => {
  it("aponta para o próximo nível", () => {
    expect(getNextLevel(0)?.name).toBe("Hunter Shark");
    expect(getNextLevel(6000)?.name).toBe("Megalodon");
    expect(getNextLevel(10000)).toBeNull();
  });
  it("progresso entre Baby (0) e Hunter (3000)", () => {
    expect(getLevelProgress(0)).toBe(0);
    expect(getLevelProgress(1500)).toBe(50);
    expect(getLevelProgress(2999)).toBe(100);
  });
  it("topo sempre 100%", () => {
    expect(getLevelProgress(50000)).toBe(100);
  });
});

describe("computeOrderPoints — taxa por nível, CPF e multiplicador", () => {
  it("R$100 no Baby Shark (10/R$) = 1000 pts", () => {
    expect(computeOrderPoints({ eligibleReais: 100, currentPoints: 0, cpfPresent: true })).toBe(1000);
  });
  it("R$100 no Hunter (11/R$) = 1100 pts", () => {
    expect(computeOrderPoints({ eligibleReais: 100, currentPoints: 3000, cpfPresent: true })).toBe(1100);
  });
  it("R$100 no Predatory (13/R$) = 1300 pts", () => {
    expect(computeOrderPoints({ eligibleReais: 100, currentPoints: 6000, cpfPresent: true })).toBe(1300);
  });
  it("R$100 no Megalodon (15/R$) = 1500 pts", () => {
    expect(computeOrderPoints({ eligibleReais: 100, currentPoints: 10000, cpfPresent: true })).toBe(1500);
  });
  it("sem CPF não computa pontos (identificação obrigatória)", () => {
    expect(computeOrderPoints({ eligibleReais: 100, currentPoints: 0, cpfPresent: false })).toBe(0);
  });
  it("base não positiva não computa", () => {
    expect(computeOrderPoints({ eligibleReais: 0, currentPoints: 0, cpfPresent: true })).toBe(0);
  });
  it("multiplicador de campanha (pontos em dobro)", () => {
    expect(computeOrderPoints({ eligibleReais: 50, currentPoints: 0, cpfPresent: true, multiplier: 2 })).toBe(1000);
  });
  it("arredonda valores quebrados", () => {
    expect(computeOrderPoints({ eligibleReais: 9.99, currentPoints: 0, cpfPresent: true })).toBe(100);
  });
});

describe("computeOrderPointsForItems — pontos em dobro por item", () => {
  it("soma itens com multiplicadores distintos (Baby, 10/R$)", () => {
    // R$50 normal (×1) + R$50 em campanha (×2) = 500 + 1000 = 1500
    const pts = computeOrderPointsForItems({
      items: [{ reais: 50 }, { reais: 50, multiplier: 2 }],
      currentPoints: 0,
      cpfPresent: true,
    });
    expect(pts).toBe(1500);
  });
  it("respeita a taxa do nível atual (Megalodon, 15/R$)", () => {
    const pts = computeOrderPointsForItems({
      items: [{ reais: 100, multiplier: 2 }],
      currentPoints: 10000,
      cpfPresent: true,
    });
    expect(pts).toBe(3000);
  });
  it("sem CPF não computa nada", () => {
    expect(computeOrderPointsForItems({
      items: [{ reais: 100, multiplier: 2 }], currentPoints: 0, cpfPresent: false,
    })).toBe(0);
  });
  it("multiplicador ausente/zero conta como 1", () => {
    expect(computeOrderPointsForItems({
      items: [{ reais: 10, multiplier: 0 }], currentPoints: 0, cpfPresent: true,
    })).toBe(100);
  });
});

describe("bônus de aniversário por nível", () => {
  it("Baby/Hunter sem bônus; Predatory 200; Megalodon 500", () => {
    expect(birthdayBonusFor(0)).toBe(0);
    expect(birthdayBonusFor(3000)).toBe(0);
    expect(birthdayBonusFor(6000)).toBe(200);
    expect(birthdayBonusFor(10000)).toBe(500);
  });
  it("detecta o mês de aniversário", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    expect(isBirthdayMonth("1990-03-02", now)).toBe(true);
    expect(isBirthdayMonth("1990-04-02", now)).toBe(false);
    expect(isBirthdayMonth(undefined, now)).toBe(false);
  });
});

describe("validade de 180 dias", () => {
  it("expiresAt soma 180 dias", () => {
    expect(expiresAt("2026-01-01T00:00:00.000Z").slice(0, 10)).toBe("2026-06-30");
  });
  it("isExpired no limite", () => {
    const gen = "2026-01-01T00:00:00.000Z";
    expect(isExpired(gen, new Date("2026-06-29T00:00:00Z"))).toBe(false);
    expect(isExpired(gen, new Date("2026-07-01T00:00:00Z"))).toBe(true);
  });
  it("constantes da regra", () => {
    expect(WELCOME_BONUS_POINTS).toBe(50);
    expect(POINTS_VALIDITY_DAYS).toBe(180);
  });
});

describe("planExpiry — não deixa saldo negativo", () => {
  const old = "2025-01-01T00:00:00.000Z";   // vencido em 2026
  const fresh = "2026-06-01T00:00:00.000Z"; // ainda válido
  const now = new Date("2026-06-13T00:00:00Z");

  it("expira lotes vencidos até o limite do saldo", () => {
    const plan = planExpiry(
      [{ id: "a", points: 100, createdAt: old }, { id: "b", points: 50, createdAt: fresh }],
      120, now,
    );
    expect(plan.totalExpire).toBe(100);
    expect(plan.items).toEqual([{ id: "a", expiredPoints: 100 }]);
    expect(plan.markExpiredIds).toEqual(["a"]);
  });

  it("nunca debita além do saldo (excedente já consumido por resgate)", () => {
    const plan = planExpiry(
      [{ id: "a", points: 100, createdAt: old }, { id: "b", points: 100, createdAt: old }],
      30, now,
    );
    expect(plan.totalExpire).toBe(30);
    // ambos vencidos são marcados para não reprocessar
    expect(plan.markExpiredIds).toEqual(["a", "b"]);
  });

  it("nada a expirar quando tudo está dentro da validade", () => {
    const plan = planExpiry([{ id: "b", points: 50, createdAt: fresh }], 50, now);
    expect(plan.totalExpire).toBe(0);
    expect(plan.items).toEqual([]);
  });
});
