import type { BusinessDayHours, BusinessHours } from "@/types";

export const DAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export const DAY_LABELS_FULL = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const ALL_DAYS_EMPTY: (BusinessDayHours | null)[] = [null, null, null, null, null, null, null];

/** Conta quantos dias da semana têm horário configurado. */
export function configuredDayCount(hours: BusinessHours | undefined): number {
  if (!hours?.days) return 0;
  return hours.days.filter((d) => !!d).length;
}

/** Se há pelo menos um dia com horário definido (indicando que o admin configurou). */
export function isBusinessHoursConfigured(hours: BusinessHours | undefined): boolean {
  return configuredDayCount(hours) > 0;
}

/** Horário do dia da semana informado (index 0 = domingo), ou null se fechado. */
export function dayHoursOf(
  hours: BusinessHours | undefined,
  dayIndex: number,
): BusinessDayHours | null {
  return hours?.days?.[dayIndex] ?? null;
}

/**
 * Verifica se a loja está aberta AGORA (usando o horário de hoje).
 * Retorna o objeto do dia + a flag `open`.
 */
export function isOpenNow(
  hours: BusinessHours | undefined,
  now: Date = new Date(),
): { open: boolean; dayHours: BusinessDayHours | null } {
  if (!hours?.enabled) return { open: true, dayHours: dayHoursOf(hours, now.getDay()) };
  const dayHours = dayHoursOf(hours, now.getDay());
  if (!dayHours) return { open: false, dayHours: null };
  const current = now.getHours() * 60 + now.getMinutes();
  const start = parseTime(dayHours.open);
  const end = parseTime(dayHours.close);
  const open = start !== null && end !== null && current >= start && current < end;
  return { open, dayHours };
}

/** Converte "HH:MM" em minutos do dia (ou null se inválido). */
function parseTime(value: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Formata "HH:MM" para exibição amigável ("10h" ou "10h30"). */
export function formatTime(value: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return min === 0 ? `${h}h` : `${h}h${String(min).padStart(2, "0")}`;
}

/** Formata um intervalo de horário ("10h às 22h"). */
export function formatDayRange(dayHours: BusinessDayHours | null | undefined): string {
  if (!dayHours) return "Fechado";
  return `${formatTime(dayHours.open)} às ${formatTime(dayHours.close)}`;
}

/** Resumo do horário de hoje (ex.: "Aberto: 10h às 22h" | "Fechado hoje"). */
export function formatTodayStatus(
  hours: BusinessHours | undefined,
  now: Date = new Date(),
): string {
  const dayHours = dayHoursOf(hours, now.getDay());
  if (!dayHours) return "Fechado hoje";
  return `Hoje: ${formatDayRange(dayHours)}`;
}

/** Dias da semana em ordem começando por hoje (para o editor). */
export function orderedDaysFrom(now: Date = new Date()): number[] {
  const start = now.getDay();
  return Array.from({ length: 7 }, (_, i) => (start + i) % 7);
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  enabled: false,
  days: ALL_DAYS_EMPTY,
  closedMessage: "",
};
