import { toDate } from "@/lib/utils";

/**
 * Formata um timestamp como tempo relativo em pt-BR ("agora", "há 2 min",
 * "há 1 hora", "há 3 dias"). Usado para mostrar há quanto tempo o entregador
 * reportou a localização. Valores no futuro ou inválidos caem em "agora".
 */
export function formatTimeAgo(value: unknown, now: Date = new Date()): string {
  const date = toDate(value);
  const diffMs = now.getTime() - date.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "agora";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} hora${hours > 1 ? "s" : ""}`;

  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? "s" : ""}`;
}
