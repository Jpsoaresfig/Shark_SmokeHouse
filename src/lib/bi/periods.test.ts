import { describe, it, expect } from "vitest";
import {
  rangeForPreset, previousRange, storeParts, storeMidnight, ymdStoreKey,
  monthStoreKey, rangeLengthDays, inRange, formatBiRange,
} from "./periods";

describe("storeParts (fuso America/Fortaleza = UTC-3, sem horário de verão)", () => {
  it("converte um instante UTC para o relógio da loja", () => {
    const p = storeParts(new Date("2026-03-05T12:00:00Z"));
    expect(p.y).toBe(2026);
    expect(p.m).toBe(3);
    expect(p.d).toBe(5);
    expect(p.hour).toBe(9);
    expect(p.iso).toBe("2026-03-05");
  });

  it("retorna o dia da semana correto (0 = domingo)", () => {
    // 2026-03-08 é domingo.
    expect(storeParts(new Date("2026-03-08T12:00:00Z")).dow).toBe(0);
    // 2026-03-09 é segunda.
    expect(storeParts(new Date("2026-03-09T12:00:00Z")).dow).toBe(1);
    // 2026-03-14 é sábado.
    expect(storeParts(new Date("2026-03-14T12:00:00Z")).dow).toBe(6);
  });
});

describe("storeMidnight", () => {
  it("retorna o instante da meia-noite no fuso da loja", () => {
    const mid = storeMidnight(2026, 3, 5);
    const p = storeParts(mid);
    expect(p.iso).toBe("2026-03-05");
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(0);
  });

  it("lida com virada de mês/ano", () => {
    expect(storeParts(storeMidnight(2026, 1, 1)).iso).toBe("2026-01-01");
    expect(storeParts(storeMidnight(2026, 2, 28)).iso).toBe("2026-02-28");
  });
});

describe("rangeForPreset", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  it("Hoje = dia completo", () => {
    const r = rangeForPreset("today", now);
    expect(storeParts(r.start).iso).toBe("2026-03-15");
    expect(storeParts(r.end).iso).toBe("2026-03-15");
    expect(storeParts(r.end).hour).toBe(23);
  });

  it("Ontem = dia anterior completo", () => {
    const r = rangeForPreset("yesterday", now);
    expect(storeParts(r.start).iso).toBe("2026-03-14");
    expect(storeParts(r.end).iso).toBe("2026-03-14");
  });

  it("Últimos 7 dias = 7 dias terminando hoje", () => {
    const r = rangeForPreset("last7", now);
    expect(rangeLengthDays(r)).toBeCloseTo(7, 5);
    expect(storeParts(r.start).iso).toBe("2026-03-09");
    expect(storeParts(r.end).iso).toBe("2026-03-15");
  });

  it("Últimos 30 dias = 30 dias terminando hoje", () => {
    const r = rangeForPreset("last30", now);
    expect(rangeLengthDays(r)).toBeCloseTo(30, 5);
    expect(storeParts(r.start).iso).toBe("2026-02-14");
    expect(storeParts(r.end).iso).toBe("2026-03-15");
  });

  it("Este mês = 1º ao último dia do mês", () => {
    const r = rangeForPreset("thisMonth", now);
    expect(storeParts(r.start).iso).toBe("2026-03-01");
    expect(storeParts(r.end).iso).toBe("2026-03-31");
  });

  it("Mês passado = mês anterior completo", () => {
    const r = rangeForPreset("lastMonth", now);
    expect(storeParts(r.start).iso).toBe("2026-02-01");
    expect(storeParts(r.end).iso).toBe("2026-02-28");
  });

  it("Este ano = ano completo", () => {
    const r = rangeForPreset("thisYear", now);
    expect(storeParts(r.start).iso).toBe("2026-01-01");
    expect(storeParts(r.end).iso).toBe("2026-12-31");
  });

  it("Ano passado = ano anterior completo", () => {
    const r = rangeForPreset("lastYear", now);
    expect(storeParts(r.start).iso).toBe("2025-01-01");
    expect(storeParts(r.end).iso).toBe("2025-12-31");
  });
});

describe("previousRange", () => {
  it("mês inteiro já encerrado → mês anterior inteiro (alinhado)", () => {
    const now = new Date("2026-04-10T12:00:00Z");
    const r = rangeForPreset("lastMonth", now); // março
    const prev = previousRange(r, now);
    expect(prev.end.getTime()).toBe(r.start.getTime() - 1);
    expect(storeParts(prev.start).iso).toBe("2026-02-01");
    expect(storeParts(prev.end).iso).toBe("2026-02-28");
    // Setembro (30) → agosto inteiro (31).
    const sep = rangeForPreset("lastMonth", new Date("2026-10-10T12:00:00Z"));
    const prevSep = previousRange(sep, new Date("2026-10-10T12:00:00Z"));
    expect(storeParts(prevSep.start).iso).toBe("2026-08-01");
    expect(storeParts(prevSep.end).iso).toBe("2026-08-31");
  });

  it("este mês compara só os dias decorridos, alinhado ao mês anterior", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const r = rangeForPreset("thisMonth", now);
    const prev = previousRange(r, now);
    expect(storeParts(prev.start).iso).toBe("2026-02-01");
    expect(storeParts(prev.end).iso).toBe("2026-02-15");
    expect(storeParts(prev.end).hour).toBe(23);
    // Dia 31 → mês anterior mais curto termina no último dia dele.
    const now31 = new Date("2026-03-31T12:00:00Z");
    const prev31 = previousRange(rangeForPreset("thisMonth", now31), now31);
    expect(storeParts(prev31.end).iso).toBe("2026-02-28");
  });

  it("este ano compara com o mesmo trecho do ano anterior", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    const prev = previousRange(rangeForPreset("thisYear", now), now);
    expect(storeParts(prev.start).iso).toBe("2025-01-01");
    expect(storeParts(prev.end).iso).toBe("2025-10-18");
  });

  it("período com dias futuros (custom) usa só a parte decorrida", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const r = { start: storeMidnight(2026, 3, 10), end: new Date(storeMidnight(2026, 3, 20).getTime() - 1) };
    const prev = previousRange(r, now);
    expect(prev.end.getTime()).toBe(r.start.getTime() - 1);
    expect(storeParts(prev.start).iso).toBe("2026-03-04"); // 6 dias (10–15) antes
  });

  it("períodos curtos (1 dia) têm anterior com 1 dia", () => {
    const r = rangeForPreset("today", new Date("2026-03-15T12:00:00Z"));
    const prev = previousRange(r);
    expect(storeParts(prev.start).iso).toBe("2026-03-14");
    expect(storeParts(prev.end).iso).toBe("2026-03-14");
  });
});

describe("auxiliares de data", () => {
  it("ymdStoreKey / monthStoreKey", () => {
    const d = new Date("2026-03-05T12:00:00Z");
    expect(ymdStoreKey(d)).toBe("2026-03-05");
    expect(monthStoreKey(d)).toBe("2026-03");
  });

  it("inRange é inclusivo", () => {
    const r = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-31T23:59:59Z") };
    expect(inRange(new Date("2026-03-01T00:00:00Z"), r)).toBe(true);
    expect(inRange(new Date("2026-03-31T23:59:59Z"), r)).toBe(true);
    expect(inRange(new Date("2026-02-28T23:59:59Z"), r)).toBe(false);
  });

  it("formatBiRange", () => {
    const r = { start: storeMidnight(2026, 3, 1), end: storeMidnight(2026, 3, 31) };
    expect(formatBiRange(r)).toMatch(/01\/03\/2026/);
    expect(formatBiRange(r)).toMatch(/31\/03\/2026/);
  });
});
