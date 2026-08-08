/**
 * Períodos e datas do BI — tudo no FUSO DA LOJA (America/Fortaleza), mesma
 * fonte da operação (cron, horário de funcionamento). Lógica pura.
 */
import { BI_STORE_TIMEZONE, type BiRange } from "./types";

export type BiPeriodPreset =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

export const BI_PRESET_LABELS: Record<BiPeriodPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last7: "Últimos 7 dias",
  last30: "Últimos 30 dias",
  thisMonth: "Este mês",
  lastMonth: "Mês passado",
  thisYear: "Este ano",
  lastYear: "Ano passado",
  custom: "Personalizado",
};

/** Partes do relógio da loja (fuso configurado) para uma data. */
export interface StoreParts {
  y: number;
  /** 1–12. */
  m: number;
  d: number;
  hour: number;
  minute: number;
  /** 0 = domingo. */
  dow: number;
  /** "YYYY-MM-DD" no fuso da loja. */
  iso: string;
}

function partsFor(tz: string, date: Date): Record<string, string> {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hour12: false,
    hourCycle: "h23",
  });
  const out: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return out;
}

/** Deslocamento (ms) do fuso em relação a UTC num instante. */
function tzOffsetMs(tz: string, at: Date): number {
  const p = partsFor(tz, at);
  const wall = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour) % 24, Number(p.minute), Number(p.second),
  );
  return wall - at.getTime();
}

/** Partes do relógio da loja para uma data (estável, sem mutar a data). */
export function storeParts(date: Date): StoreParts {
  const p = partsFor(BI_STORE_TIMEZONE, date);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    dow: dow < 0 ? date.getUTCDay() : dow,
    iso: `${p.year}-${p.month}-${p.day}`,
  };
}

/** Instante correspondente à meia-noite (00:00) de y-m-d no fuso da loja. */
export function storeMidnight(y: number, m: number, d: number): Date {
  // Usa meio-dia como referência para evitar ambigüidade de borda de DST.
  const guess = Date.UTC(y, m - 1, d, 12, 0, 0);
  const offset = tzOffsetMs(BI_STORE_TIMEZONE, new Date(guess));
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

/** Chave "YYYY-MM-DD" no fuso da loja. */
export function ymdStoreKey(date: Date): string {
  return storeParts(date).iso;
}

/** Chave "YYYY-MM" no fuso da loja. */
export function monthStoreKey(date: Date): string {
  const p = storeParts(date);
  return `${p.y}-${String(p.m).padStart(2, "0")}`;
}

const MS_DAY = 86400000;

/** Intervalo (inclusivo) de um preset de período. */
export function rangeForPreset(preset: Exclude<BiPeriodPreset, "custom">, now: Date = new Date()): BiRange {
  const p = storeParts(now);
  const todayMid = storeMidnight(p.y, p.m, p.d);
  const endOfDay = (mid: Date): Date => new Date(mid.getTime() + MS_DAY - 1);
  switch (preset) {
    case "today":
      return { start: todayMid, end: endOfDay(todayMid) };
    case "yesterday": {
      const start = storeMidnight(p.y, p.m, p.d - 1);
      return { start, end: endOfDay(start) };
    }
    case "last7": {
      const start = new Date(todayMid.getTime() - 6 * MS_DAY);
      return { start, end: endOfDay(todayMid) };
    }
    case "last30": {
      const start = new Date(todayMid.getTime() - 29 * MS_DAY);
      return { start, end: endOfDay(todayMid) };
    }
    case "thisMonth": {
      const start = storeMidnight(p.y, p.m, 1);
      return { start, end: new Date(storeMidnight(p.y, p.m + 1, 1).getTime() - 1) };
    }
    case "lastMonth": {
      const start = storeMidnight(p.y, p.m - 1, 1);
      return { start, end: new Date(storeMidnight(p.y, p.m, 1).getTime() - 1) };
    }
    case "thisYear": {
      const start = storeMidnight(p.y, 1, 1);
      return { start, end: new Date(storeMidnight(p.y + 1, 1, 1).getTime() - 1) };
    }
    case "lastYear": {
      const start = storeMidnight(p.y - 1, 1, 1);
      return { start, end: new Date(storeMidnight(p.y, 1, 1).getTime() - 1) };
    }
  }
}

/** Período ANTERIOR EQUIVALENTE: mesma duração, imediatamente antes do início. */
export function previousRange(range: BiRange): BiRange {
  const length = Math.max(0, range.end.getTime() - range.start.getTime());
  const end = range.start.getTime() - 1;
  return { start: new Date(end - length), end: new Date(end) };
}

/** Duração do período em dias (fracionário). */
export function rangeLengthDays(range: BiRange): number {
  return (range.end.getTime() - range.start.getTime() + 1) / MS_DAY;
}

/** A data está dentro do intervalo (inclusivo). */
export function inRange(date: Date, range: BiRange): boolean {
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

/** Rotula um intervalo para exibição ("01/03/2026 – 31/03/2026"). */
export function formatBiRange(range: BiRange): string {
  const f = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${f(range.start)} – ${f(range.end)}`;
}
