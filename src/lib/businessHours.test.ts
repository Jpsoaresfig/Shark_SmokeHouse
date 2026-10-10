import { describe, it, expect } from "vitest";
import { isOpenNow, zonedClock, formatTodayStatus, STORE_TIMEZONE } from "@/lib/businessHours";
import type { BusinessHours } from "@/types";

/** Relógio fixo: dia da semana (0 = dom) + "HH:MM". */
function clock(day: number, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return { getDay: () => day, getHours: () => h, getMinutes: () => m };
}

function hours(days: BusinessHours["days"], enabled = true): BusinessHours {
  return { enabled, days, closedMessage: "" };
}

const D = (open: string, close: string) => ({ open, close });

describe("isOpenNow", () => {
  it("limitador desligado = sempre aberto", () => {
    expect(isOpenNow(hours([null, null, null, null, null, null, null], false), clock(1, "03:00")).open).toBe(true);
  });

  it("expediente no mesmo dia", () => {
    const h = hours([null, D("10:00", "22:00"), null, null, null, null, null]);
    expect(isOpenNow(h, clock(1, "09:59")).open).toBe(false);
    expect(isOpenNow(h, clock(1, "10:00")).open).toBe(true);
    expect(isOpenNow(h, clock(1, "21:59")).open).toBe(true);
    expect(isOpenNow(h, clock(1, "22:00")).open).toBe(false);
  });

  it("fechamento 00:00 = até a meia-noite", () => {
    const h = hours([null, null, D("14:00", "00:00"), null, null, null, null]);
    expect(isOpenNow(h, clock(2, "23:59")).open).toBe(true);
    expect(isOpenNow(h, clock(3, "00:01")).open).toBe(false);
  });

  it("expediente que vira a noite (sex 14h → sáb 02h)", () => {
    const h = hours([null, null, null, null, null, D("14:00", "02:00"), null]);
    expect(isOpenNow(h, clock(5, "13:59")).open).toBe(false);
    expect(isOpenNow(h, clock(5, "14:00")).open).toBe(true);
    expect(isOpenNow(h, clock(5, "23:30")).open).toBe(true);
    // Sábado de madrugada: ainda vale o expediente de sexta.
    const late = isOpenNow(h, clock(6, "01:30"));
    expect(late.open).toBe(true);
    expect(late.dayHours).toEqual(D("14:00", "02:00"));
    expect(isOpenNow(h, clock(6, "02:00")).open).toBe(false);
  });

  it("madrugada de um dia fechado após expediente noturno de ontem", () => {
    // Domingo 12h → 02h; segunda fechada.
    const h = hours([D("12:00", "02:00"), null, null, null, null, null, null]);
    expect(isOpenNow(h, clock(1, "01:00")).open).toBe(true);
    expect(isOpenNow(h, clock(1, "03:00")).open).toBe(false);
  });

  it("dia fechado", () => {
    const h = hours([null, null, null, null, null, null, null]);
    expect(isOpenNow(h, clock(3, "15:00"))).toEqual({ open: false, dayHours: null });
  });
});

describe("zonedClock (servidor em UTC, loja em UTC-3)", () => {
  it("converte 01:30 UTC de sábado para 22:30 de sexta na loja", () => {
    const c = zonedClock(STORE_TIMEZONE, new Date("2026-06-13T01:30:00Z")); // sáb 01:30 UTC
    expect(c.getDay()).toBe(5);
    expect(c.getHours()).toBe(22);
    expect(c.getMinutes()).toBe(30);
  });

  it("meia-noite local vira 0h (não 24h)", () => {
    const c = zonedClock(STORE_TIMEZONE, new Date("2026-06-13T03:00:00Z"));
    expect(c.getHours()).toBe(0);
    expect(c.getDay()).toBe(6);
  });

  it("isOpenNow com o relógio da loja decide pelo horário local", () => {
    const h = hours([null, null, null, null, null, D("10:00", "22:00"), null]);
    // 00:30 UTC de sábado = 21:30 de sexta na loja → aberta.
    expect(isOpenNow(h, zonedClock(STORE_TIMEZONE, new Date("2026-06-13T00:30:00Z"))).open).toBe(true);
  });
});

describe("formatTodayStatus", () => {
  it("resume o horário do dia", () => {
    const h = hours([null, D("10:00", "22:30"), null, null, null, null, null]);
    expect(formatTodayStatus(h, clock(1, "12:00"))).toBe("Hoje: 10h às 22h30");
    expect(formatTodayStatus(h, clock(2, "12:00"))).toBe("Fechado hoje");
  });
});
