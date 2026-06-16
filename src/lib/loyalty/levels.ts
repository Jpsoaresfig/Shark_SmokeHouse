/**
 * Engine de regras do Clube Shark (Task 3.7) — FONTE ÚNICA DA VERDADE.
 *
 * Módulo puro (sem Firebase) para ser testável e compartilhado entre cliente
 * (estimativa no checkout, exibição do nível) e servidor (crédito de pontos,
 * cron de expiração/aniversário). Não importe Firestore aqui.
 */

export type LoyaltyLevelName =
  | "Baby Shark"
  | "Hunter Shark"
  | "Predatory Shark"
  | "Megalodon";

export interface LoyaltyLevel {
  name: LoyaltyLevelName;
  /** Faixa de pontos (saldo) que coloca o cliente neste nível. */
  min: number;
  /** Limite superior INCLUSIVO da faixa (Infinity no topo). */
  max: number;
  /** Pontos ganhos por R$ 1,00 gasto neste nível. */
  earnRate: number;
  /** Bônus creditado no mês do aniversário (0 = sem bônus). */
  birthdayBonus: number;
  color: string;
  glow: string;
}

/** Tabela de equivalência e níveis (Task 3.7). Ordem crescente por `min`. */
export const LOYALTY_LEVELS: readonly LoyaltyLevel[] = [
  { name: "Baby Shark",      min: 0,     max: 2999,     earnRate: 10, birthdayBonus: 0,   color: "#7dd3fc", glow: "rgba(125,211,252,0.2)" },
  { name: "Hunter Shark",    min: 3000,  max: 5999,     earnRate: 11, birthdayBonus: 0,   color: "#38bdf8", glow: "rgba(56,189,248,0.2)"  },
  { name: "Predatory Shark", min: 6000,  max: 9999,     earnRate: 13, birthdayBonus: 200, color: "#0ea5e9", glow: "rgba(14,165,233,0.2)"  },
  { name: "Megalodon",       min: 10000, max: Infinity, earnRate: 15, birthdayBonus: 500, color: "#6366f1", glow: "rgba(99,102,241,0.25)" },
] as const;

/** Bônus de boas-vindas creditado ao concluir o cadastro (Task 3.7). */
export const WELCOME_BONUS_POINTS = 50;

/**
 * Pontos creditados ao INDICADOR quando o indicado conclui a 1ª compra paga.
 * Fonte única client-safe — o servidor (referrals.server) reexporta este valor.
 */
export const REFERRAL_BONUS_POINTS = 50;

/** Validade dos pontos: expiram 180 dias após a data de geração (Task 3.7). */
export const POINTS_VALIDITY_DAYS = 180;

/** Nível atual do cliente a partir do saldo de pontos. */
export function getLevel(points: number): LoyaltyLevel {
  const p = Math.max(0, points ?? 0);
  return LOYALTY_LEVELS.find((l) => p >= l.min && p <= l.max) ?? LOYALTY_LEVELS[0];
}

/** Próximo nível (ou null se já é Megalodon). */
export function getNextLevel(points: number): LoyaltyLevel | null {
  const idx = LOYALTY_LEVELS.indexOf(getLevel(points));
  return idx === LOYALTY_LEVELS.length - 1 ? null : LOYALTY_LEVELS[idx + 1];
}

/** Progresso (0–100%) rumo ao próximo nível. 100 quando já está no topo. */
export function getLevelProgress(points: number): number {
  const level = getLevel(points);
  const next = getNextLevel(points);
  if (!next) return 100;
  const span = next.min - level.min;
  if (span <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round(((points - level.min) / span) * 100)));
}

/**
 * Pontos que uma compra gera. Regras do Clube Shark:
 *  - Identificação obrigatória: sem CPF preenchido, a compra NÃO computa pontos;
 *  - R$ gasto (base elegível, p.ex. subtotal de produtos) × taxa do nível atual;
 *  - `multiplier` cobre campanhas de "Pontos em Dobro" (Task 3.5), default 1.
 */
export function computeOrderPoints(opts: {
  /** Base elegível em reais (subtotal de produtos — frete/resgates não contam). */
  eligibleReais: number;
  /** Saldo atual do cliente (define o nível e, logo, a taxa). */
  currentPoints: number;
  /** CPF preenchido? (gate de identificação obrigatória). */
  cpfPresent: boolean;
  /** Multiplicador de campanha (ex.: 2 = pontos em dobro). Default 1. */
  multiplier?: number;
}): number {
  if (!opts.cpfPresent) return 0;
  if (!(opts.eligibleReais > 0)) return 0;
  const level = getLevel(opts.currentPoints);
  const multiplier = opts.multiplier && opts.multiplier > 0 ? opts.multiplier : 1;
  return Math.round(opts.eligibleReais * level.earnRate * multiplier);
}

/**
 * Pontos de uma compra somando item a item, cada um com seu próprio multiplicador
 * (Task 3.5 — "Pontos em Dobro"). A taxa do nível é a mesma para todos os itens
 * (nível atual do cliente); o multiplicador (1 ou 2) é por item, conforme a
 * campanha congelada na compra. Mantém o gate de CPF.
 */
export function computeOrderPointsForItems(opts: {
  items: { reais: number; multiplier?: number }[];
  currentPoints: number;
  cpfPresent: boolean;
}): number {
  if (!opts.cpfPresent) return 0;
  const level = getLevel(opts.currentPoints);
  let total = 0;
  for (const item of opts.items) {
    if (!(item.reais > 0)) continue;
    const multiplier = item.multiplier && item.multiplier > 0 ? item.multiplier : 1;
    total += item.reais * level.earnRate * multiplier;
  }
  return Math.round(total);
}

/** Bônus de aniversário do nível atual (0 nos níveis sem bônus). */
export function birthdayBonusFor(points: number): number {
  return getLevel(points).birthdayBonus;
}

/** Data (ISO) em que um lote de pontos gerado em `generatedAtISO` expira. */
export function expiresAt(generatedAtISO: string): string {
  const d = new Date(generatedAtISO);
  d.setDate(d.getDate() + POINTS_VALIDITY_DAYS);
  return d.toISOString();
}

/** Um lote de pontos gerado em `generatedAtISO` já passou da validade? */
export function isExpired(generatedAtISO: string, now: Date = new Date()): boolean {
  return new Date(expiresAt(generatedAtISO)).getTime() <= now.getTime();
}

/** O mês de `birthDate` ("YYYY-MM-DD") é o mês corrente? */
export function isBirthdayMonth(birthDate: string | undefined, now: Date = new Date()): boolean {
  if (!birthDate || birthDate.length < 7) return false;
  const month = Number(birthDate.slice(5, 7));
  return month === now.getMonth() + 1;
}

/** Lote de pontos creditado (transação positiva) candidato a expirar. */
export interface PointGrant {
  id: string;
  points: number;
  createdAt: string;
}

export interface ExpiryPlanItem {
  id: string;
  /** Quantos pontos deste lote efetivamente debitar (≤ pontos do lote). */
  expiredPoints: number;
}

export interface ExpiryPlan {
  /** Total a debitar do saldo (≤ saldo atual — nunca deixa negativo). */
  totalExpire: number;
  /** Lotes que devem ser debitados, com o quanto debitar de cada. */
  items: ExpiryPlanItem[];
  /** Todos os lotes vencidos (marcar como `expired` p/ não reprocessar). */
  markExpiredIds: string[];
}

/**
 * Planeja a expiração de pontos vencidos (≥ 180 dias) para UM cliente, sem
 * deixar o saldo negativo. Debita do lote mais antigo para o mais novo, limitado
 * ao saldo atual — o excedente já foi consumido por resgates anteriores, então só
 * marcamos os lotes como vencidos (para não reprocessar) sem debitar além do saldo.
 */
export function planExpiry(
  grants: PointGrant[],
  currentBalance: number,
  now: Date = new Date(),
): ExpiryPlan {
  const matured = grants
    .filter((g) => g.points > 0 && isExpired(g.createdAt, now))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let remaining = Math.max(0, currentBalance);
  const items: ExpiryPlanItem[] = [];
  let totalExpire = 0;
  for (const g of matured) {
    const expiredPoints = Math.min(g.points, remaining);
    if (expiredPoints > 0) {
      items.push({ id: g.id, expiredPoints });
      remaining -= expiredPoints;
      totalExpire += expiredPoints;
    }
  }
  return { totalExpire, items, markExpiredIds: matured.map((g) => g.id) };
}
