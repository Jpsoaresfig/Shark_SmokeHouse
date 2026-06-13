import { describe, it, expect } from "vitest";
import { isValidCpf, formatCpf, onlyDigits } from "./cpf";

describe("isValidCpf", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("rejeita dígito verificador errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("11144477736")).toBe(false);
  });

  it("rejeita tamanho incorreto", () => {
    expect(isValidCpf("123")).toBe(false);
    expect(isValidCpf("529982247250")).toBe(false);
    expect(isValidCpf("")).toBe(false);
  });

  it("rejeita sequências de dígitos repetidos", () => {
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });
});

describe("formatCpf", () => {
  it("aplica a máscara progressivamente", () => {
    expect(formatCpf("529")).toBe("529");
    expect(formatCpf("529982")).toBe("529.982");
    expect(formatCpf("529982247")).toBe("529.982.247");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
  });

  it("ignora caracteres não numéricos e excesso", () => {
    expect(formatCpf("529.982.247-25extra")).toBe("529.982.247-25");
    expect(formatCpf("5299822472599")).toBe("529.982.247-25");
  });
});

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
    expect(onlyDigits("abc")).toBe("");
  });
});
