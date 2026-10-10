import { describe, it, expect } from "vitest";
import { legalAgeDate, isOfLegalAge, formatBrDate } from "@/lib/age";

describe("legalAgeDate", () => {
  it("soma 18 anos mantendo o dia (sem deslocar por fuso)", () => {
    expect(legalAgeDate("2008-06-15")).toBe("2026-06-15");
    expect(legalAgeDate("2008-01-01")).toBe("2026-01-01");
  });
});

describe("isOfLegalAge", () => {
  it("rejeita datas inválidas", () => {
    expect(isOfLegalAge("")).toBe(false);
  });
  it("aceita quem nasceu há mais de 18 anos", () => {
    expect(isOfLegalAge("1990-01-01")).toBe(true);
  });
});

describe("formatBrDate", () => {
  it("formata ISO como DD/MM/AAAA", () => {
    expect(formatBrDate("2026-06-15")).toBe("15/06/2026");
  });
});
