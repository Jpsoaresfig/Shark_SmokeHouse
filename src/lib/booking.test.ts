import { describe, it, expect } from "vitest";
import { slotId, isPastDate, validateBooking, todayISO } from "@/lib/booking";

describe("slotId", () => {
  it("gera id determinístico removendo os ':' do horário", () => {
    expect(slotId("2026-06-15", "20:00")).toBe("2026-06-15_2000");
    expect(slotId("2026-12-31", "09:30")).toBe("2026-12-31_0930");
  });

  it("é estável para a mesma data/horário", () => {
    expect(slotId("2026-06-15", "20:00")).toBe(slotId("2026-06-15", "20:00"));
  });

  it("difere por horário e por data", () => {
    expect(slotId("2026-06-15", "20:00")).not.toBe(slotId("2026-06-15", "21:00"));
    expect(slotId("2026-06-15", "20:00")).not.toBe(slotId("2026-06-16", "20:00"));
  });
});

describe("isPastDate", () => {
  const today = "2026-06-01";
  it("acusa data anterior a hoje", () => {
    expect(isPastDate("2026-05-31", today)).toBe(true);
  });
  it("não acusa a data de hoje", () => {
    expect(isPastDate("2026-06-01", today)).toBe(false);
  });
  it("não acusa data futura", () => {
    expect(isPastDate("2026-06-02", today)).toBe(false);
  });
});

describe("todayISO", () => {
  it("formata no padrão YYYY-MM-DD com zero à esquerda", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("validateBooking", () => {
  const today = "2026-06-01";
  const ok = { name: "João", whatsapp: "83999990000", date: "2026-06-10", time: "20:00" };

  it("retorna null quando está tudo certo", () => {
    expect(validateBooking(ok, today)).toBeNull();
  });

  it("exige nome", () => {
    expect(validateBooking({ ...ok, name: "  " }, today)).toMatch(/nome/i);
  });

  it("exige whatsapp", () => {
    expect(validateBooking({ ...ok, whatsapp: "" }, today)).toMatch(/whatsapp/i);
  });

  it("exige data", () => {
    expect(validateBooking({ ...ok, date: "" }, today)).toMatch(/data/i);
  });

  it("exige horário", () => {
    expect(validateBooking({ ...ok, time: "" }, today)).toMatch(/horário/i);
  });

  it("bloqueia data passada", () => {
    expect(validateBooking({ ...ok, date: "2026-05-31" }, today)).toMatch(/passou/i);
  });

  it("aceita reserva para hoje", () => {
    expect(validateBooking({ ...ok, date: today }, today)).toBeNull();
  });
});
