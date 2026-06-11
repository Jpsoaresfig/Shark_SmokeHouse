import { describe, it, expect } from "vitest";
import { parseCsv, parseBrNumber, parseProductsCsv } from "./csvImport";

const HEADER =
  "ESTOQUE;SKU;CATEGORIA;MARCA;DESCRIÇÃO DO PRODUTO;COR/AROMA/SABOR;TAMANHO/QUANTIDADE;CUSTO UNIDADE (R$);IMPOSTO (%);PREÇO PIX/DINHEIRO (R$);PONTOS GANHOS;PONTOS RESGATE";

describe("parseCsv", () => {
  it("detecta ponto e vírgula (Excel pt-BR)", () => {
    const rows = parseCsv("a;b;c\n1;2;3");
    expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("detecta vírgula e respeita aspas", () => {
    const rows = parseCsv('nome,preco\n"Essência, sabor uva",10');
    expect(rows[1]).toEqual(["Essência, sabor uva", "10"]);
  });

  it("ignora linhas vazias e remove BOM", () => {
    const rows = parseCsv("﻿a;b\r\n\r\n1;2\r\n");
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("parseBrNumber", () => {
  it("converte números no formato brasileiro", () => {
    expect(parseBrNumber("R$ 1.234,56")).toBe(1234.56);
    expect(parseBrNumber("12,5")).toBe(12.5);
    expect(parseBrNumber("12.5")).toBe(12.5);
    expect(parseBrNumber("10%")).toBe(10);
    expect(parseBrNumber("")).toBeUndefined();
    expect(parseBrNumber("abc")).toBeUndefined();
  });
});

describe("parseProductsCsv", () => {
  it("agrupa linhas com mesma descrição em variações", () => {
    const csv = [
      HEADER,
      "10;789001;Essências;Zomo;Essência Zomo Strong;Menta;50g;5,00;10;12,90;5;",
      "8;789002;Essências;Zomo;Essência Zomo Strong;Uva;50g;5,00;10;12,90;5;",
      "3;789010;Acessórios;;Isqueiro Clipper;;;2,00;5;9,90;;500",
    ].join("\n");

    const { products, warnings, error } = parseProductsCsv(csv);
    expect(error).toBeUndefined();
    expect(warnings).toEqual([]);
    expect(products).toHaveLength(2);

    const zomo = products[0];
    expect(zomo.name).toBe("Essência Zomo Strong");
    expect(zomo.brand).toBe("Zomo");
    expect(zomo.size).toBe("50g");
    expect(zomo.price).toBe(12.9);
    expect(zomo.costPrice).toBe(5);
    expect(zomo.taxPercent).toBe(10);
    expect(zomo.pointsEarned).toBe(5);
    expect(zomo.stock).toBe(18);
    expect(zomo.variations).toHaveLength(2);
    expect(zomo.variations[0]).toMatchObject({ name: "Menta", sku: "789001", stock: 10 });
    expect(zomo.variations[1]).toMatchObject({ name: "Uva", sku: "789002", stock: 8 });

    const clipper = products[1];
    expect(clipper.variations).toHaveLength(0);
    expect(clipper.sku).toBe("789010");
    expect(clipper.stock).toBe(3);
    expect(clipper.loyaltyPoints).toBe(500);
    expect(clipper.pointsEarned).toBeUndefined();
  });

  it("avisa sobre linhas inválidas sem derrubar a importação", () => {
    const csv = [
      HEADER,
      ";;Essências;;;;;;;;;",            // sem descrição
      "5;789001;Essências;Zomo;Produto OK;;;;;15,00;;",
      "5;789002;Essências;Zomo;Sem preço;;;;;;;",
    ].join("\n");

    const { products, warnings } = parseProductsCsv(csv);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("Produto OK");
    expect(warnings).toHaveLength(2);
  });

  it("erro claro quando o cabeçalho não tem as colunas mínimas", () => {
    const { error } = parseProductsCsv("foo;bar\n1;2");
    expect(error).toMatch(/Cabeçalho não reconhecido/);
  });

  it("aceita cabeçalhos sem acento e em qualquer ordem", () => {
    const csv = [
      "PRECO PIX/DINHEIRO (R$);DESCRICAO DO PRODUTO;ESTOQUE",
      "19,90;Carvão de Coco;25",
    ].join("\n");
    const { products, error } = parseProductsCsv(csv);
    expect(error).toBeUndefined();
    expect(products[0]).toMatchObject({ name: "Carvão de Coco", price: 19.9, stock: 25 });
  });
});
