import { describe, it, expect } from "vitest";
import { decodeCsv } from "./spreadsheetImport";

describe("decodeCsv", () => {
  it("decodifica CSV salvo como Windows-1252 (Excel pt-BR) sem quebrar acentos", () => {
    // "PREÇO" em Windows-1252: Ç = 0xC7 (byte inválido em UTF-8).
    const ansi = new Uint8Array([0x50, 0x52, 0x45, 0xc7, 0x4f]); // P R E Ç O
    expect(decodeCsv(ansi.buffer)).toBe("PREÇO");
  });

  it("mantém UTF-8 válido intacto", () => {
    const utf8 = new TextEncoder().encode("PREÇO PIX/DINHEIRO (R$)");
    expect(decodeCsv(utf8.buffer)).toBe("PREÇO PIX/DINHEIRO (R$)");
  });
});
