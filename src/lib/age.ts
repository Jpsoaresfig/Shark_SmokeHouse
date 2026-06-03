/** Verificação de maioridade (18+). Proibida a venda para menores. */

export const LEGAL_AGE = 18;

/** Idade em anos completos a partir de uma data ISO ("YYYY-MM-DD"). */
export function ageFrom(birthDate: string): number {
  const b = new Date(`${birthDate}T00:00:00`);
  if (isNaN(b.getTime())) return NaN;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

/** True se a pessoa já completou a maioridade hoje. */
export function isOfLegalAge(birthDate: string): boolean {
  const age = ageFrom(birthDate);
  return !isNaN(age) && age >= LEGAL_AGE;
}

/** Data (ISO "YYYY-MM-DD") em que a pessoa completa a maioridade. */
export function legalAgeDate(birthDate: string): string {
  const b = new Date(`${birthDate}T00:00:00`);
  const d = new Date(b.getFullYear() + LEGAL_AGE, b.getMonth(), b.getDate());
  return d.toISOString().slice(0, 10);
}

/**
 * Avalia o bloqueio de um perfil por menoridade. Usa `blockedUntil` quando
 * presente; senão deriva de `birthDate`. O bloqueio se desfaz sozinho quando a
 * data de liberação chega (hoje >= liberação).
 */
export function minorBlock(
  profile: { birthDate?: string; blockedUntil?: string } | null | undefined,
): { blocked: boolean; until?: string } {
  if (!profile) return { blocked: false };
  const until =
    profile.blockedUntil ?? (profile.birthDate ? legalAgeDate(profile.birthDate) : undefined);
  if (!until) return { blocked: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const unblock = new Date(`${until}T00:00:00`);
  return { blocked: today < unblock, until };
}

/** Formata uma data ISO "YYYY-MM-DD" como "DD/MM/AAAA". */
export function formatBrDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
