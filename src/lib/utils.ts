import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NormalizedColor, ProductColor } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normaliza `colors` de um produto (strings legadas ou `{ name, image? }`)
 *  para uma lista estável de `NormalizedColor`. */
export function normalizeColors(colors?: ProductColor[]): NormalizedColor[] {
  return (colors ?? []).map(c =>
    typeof c === "string" ? { name: c } : { name: c.name, image: c.image },
  );
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) return (value as { toDate(): Date }).toDate();
  return new Date(value as string | number);
}

export function formatDate(date: unknown): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(toDate(date));
}

export function formatDateTime(date: unknown): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(toDate(date));
}

/** Converte "YYYY-MM-DD" em um Date LOCAL à meia-noite. Evita o bug de
 *  `new Date("YYYY-MM-DD")` ser interpretado como UTC (desloca -1 dia em
 *  fusos a oeste de Greenwich). */
export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Meia-noite local de hoje (mesma base de `parseLocalDate`). */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Data efetiva de um evento: a do encerramento, se houver período;
 *  caso contrário, a data única. */
export function eventTargetDate(e: { date: string; endDate?: string }): Date {
  return parseLocalDate(e.endDate || e.date);
}

/** Evento ainda ativo (hoje dentro da janela `data inicio → encerramento`). */
export function isEventUpcoming(e: { date: string; endDate?: string }): boolean {
  return eventTargetDate(e) >= startOfToday();
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
