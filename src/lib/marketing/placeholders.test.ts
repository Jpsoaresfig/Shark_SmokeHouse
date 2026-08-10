import { describe, it, expect } from "vitest";
import {
  buildMessageVars, renderMessage, extractPlaceholders, PLACEHOLDER_HELP,
} from "./placeholders";
import { baseContact } from "./contacts.fixture";

describe("renderMessage — substituição de placeholders", () => {
  it("troca os tokens pelos valores", () => {
    expect(renderMessage("Oi {{nome}}, use {{cupom}}!", {
      nome: "Ana",
      cupom: "SHARK-ABC123",
    })).toBe("Oi Ana, use SHARK-ABC123!");
  });

  it("aceita chave em qualquer caixa", () => {
    expect(renderMessage("{{NOME}}", { nome: "Ana" })).toBe("Ana");
  });

  it("token sem valor vira string vazia (não lança)", () => {
    expect(renderMessage("Oi {{nome}}", {})).toBe("Oi ");
  });

  it("mensagem indefinida não lança", () => {
    expect(renderMessage(undefined, {})).toBe("");
  });
});

describe("buildMessageVars — variáveis derivadas do contato", () => {
  it("nome padrão 'cliente' quando sem nome", () => {
    const vars = buildMessageVars(baseContact({ name: "  " }));
    expect(vars.nome).toBe("cliente");
  });

  it("formata cupom percentual e fixo", () => {
    expect(buildMessageVars(baseContact(), { couponValue: 10, couponType: "percent" }).valor).toBe("10%");
    expect(buildMessageVars(baseContact(), { couponValue: 25, couponType: "fixed" }).valor).toBe("R$ 25,00");
  });

  it("data de aniversário como dd/mm", () => {
    const vars = buildMessageVars(baseContact({ birthDate: "1990-03-07" }));
    expect(vars.data_aniversario).toBe("07/03");
  });

  it("dias sem comprar e pontos", () => {
    const vars = buildMessageVars(baseContact({ loyaltyPoints: 120 }), { diasSemComprar: 45 });
    expect(vars.dias_sem_comprar).toBe("45");
    expect(vars.pontos).toBe("120");
  });
});

describe("extractPlaceholders", () => {
  it("lista tokens únicos na ordem de aparição", () => {
    expect(extractPlaceholders("{{nome}} e {{CUPOM}} de novo {{nome}}")).toEqual(["nome", "cupom"]);
  });
  it("mensagem sem tokens devolve lista vazia", () => {
    expect(extractPlaceholders("sem tokens")).toEqual([]);
  });
  it("documentação cobre os tokens suportados", () => {
    expect(PLACEHOLDER_HELP.length).toBeGreaterThan(0);
  });
});
