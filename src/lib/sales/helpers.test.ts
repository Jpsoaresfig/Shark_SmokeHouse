import { describe, it, expect } from "vitest";
import { parseMoneyInput, saleDueDate } from "./helpers";

describe("parseMoneyInput", () => {
  it("aceita formatos pt-BR e ponto decimal do teclado numérico", () => {
    expect(parseMoneyInput("12,50")).toBe(12.5);
    expect(parseMoneyInput("1.234,56")).toBe(1234.56);
    expect(parseMoneyInput("12.50")).toBe(12.5);
    expect(parseMoneyInput("12.5")).toBe(12.5);
    expect(parseMoneyInput("1.234")).toBe(1234);
    expect(parseMoneyInput("R$ 8,00")).toBe(8);
    expect(parseMoneyInput("")).toBe(0);
    expect(parseMoneyInput("-5")).toBe(0);
    expect(parseMoneyInput("abc")).toBe(0);
  });
});

describe("saleDueDate", () => {
  it("lê a data-calendário gravada como meia-noite UTC no dia local correto (fim do dia)", () => {
    const d = saleDueDate({ dueDate: "2026-10-15T00:00:00.000Z" })!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(9);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(23);
  });
  it("aceita só a data e devolve null sem vencimento", () => {
    expect(saleDueDate({ dueDate: "2026-01-02" })!.getDate()).toBe(2);
    expect(saleDueDate({})).toBeNull();
    expect(saleDueDate({ dueDate: "lixo" })).toBeNull();
  });
});
