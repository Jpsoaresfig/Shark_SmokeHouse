import { describe, it, expect } from "vitest";
import { digitsOfPhone, waLink, prettyPhone, isValidBrPhone } from "./whatsapp";

describe("digitsOfPhone — normalização para wa.me (+55)", () => {
  it("celular com DDD vira 55 + 11 dígitos", () => {
    expect(digitsOfPhone("(83) 99902-0606")).toBe("5583999020606");
  });
  it("mantém número que já tem o DDI 55", () => {
    expect(digitsOfPhone("+55 83 99902-0606")).toBe("5583999020606");
  });
  it("fixo com DDD (10 dígitos)", () => {
    expect(digitsOfPhone("83 3222-1100")).toBe("558332221100");
  });
  it("remove o zero de discagem nacional", () => {
    expect(digitsOfPhone("083 99902-0606")).toBe("5583999020606");
  });
  it("DDD 55 (RS) sem DDI não é confundido com o DDI", () => {
    expect(digitsOfPhone("(55) 99999-0000")).toBe("5555999990000");
  });
  it("número incompleto/lixo devolve vazio", () => {
    expect(digitsOfPhone("99902-0606")).toBe("");
    expect(digitsOfPhone("abc")).toBe("");
    expect(digitsOfPhone(undefined)).toBe("");
  });
});

describe("waLink", () => {
  it("codifica a mensagem (acentos, &, quebras de linha)", () => {
    const link = waLink("83999020606", "Olá & até já\nShark");
    expect(link).toBe(`https://wa.me/5583999020606?text=${encodeURIComponent("Olá & até já\nShark")}`);
  });
  it("sem telefone válido não gera link", () => {
    expect(waLink("123", "oi")).toBe("");
  });
});

describe("prettyPhone / isValidBrPhone", () => {
  it("formata celular", () => {
    expect(prettyPhone("+5583999020606")).toBe("(83) 99902-0606");
  });
  it("valida telefone BR", () => {
    expect(isValidBrPhone("(83) 99902-0606")).toBe(true);
    expect(isValidBrPhone("+55 83 3222-1100")).toBe(true);
    expect(isValidBrPhone("12345")).toBe(false);
  });
});
