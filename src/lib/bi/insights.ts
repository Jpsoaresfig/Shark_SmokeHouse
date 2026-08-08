/**
 * Análise de estoque + velocidade de venda + insights de compra.
 * Lógica PURA e explicável — usa apenas métricas objetivas:
 * estoque atual, vendas históricas, média diária, dias de estoque,
 * estoque mínimo e dias sem venda. Não inventa previsões.
 */
import { buildLines, unitsByProduct } from "./aggregate";
import { inRange } from "./periods";
import { BI_CONSTANTS, type BiRange, type BiSource } from "./types";

const DAY_MS = 86400000;

export type StockStatus =
  | "esgotado"
  | "reposicao_urgente"
  | "reposicao_recomendada"
  | "baixa_saida"
  | "estoque_parado"
  | "saudavel";

export interface BiStockRow {
  productId: string;
  productName: string;
  category?: string;
  stock: number;
  minStock: number;
  /** Unidades vendidas na janela de velocidade (últimos 30 dias). */
  salesWindow: number;
  /** Unidades vendidas no período selecionado. */
  salesPeriod: number;
  /** Média diária = salesWindow / janela. */
  dailyAverage: number;
  /** Dias estimados de estoque (null = dados insuficientes). */
  stockDays: number | null;
  lastSaleAt: Date | null;
  /** Dias sem venda (null = nunca vendeu). */
  daysWithoutSale: number | null;
  status: StockStatus;
  reason: string;
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; emoji: string; tone: string }> = {
  esgotado: { label: "Esgotado", emoji: "🔴", tone: "text-red-400" },
  reposicao_urgente: { label: "Reposição urgente", emoji: "🔴", tone: "text-red-400" },
  reposicao_recomendada: { label: "Reposição recomendada", emoji: "🟠", tone: "text-orange-400" },
  baixa_saida: { label: "Baixa saída", emoji: "🔴", tone: "text-red-400" },
  estoque_parado: { label: "Estoque parado", emoji: "🔴", tone: "text-red-400" },
  saudavel: { label: "Estoque saudável", emoji: "🟢", tone: "text-emerald-400" },
};

function floor1(n: number): number {
  return Math.floor(n * 10) / 10;
}

/** Classifica o status de estoque de uma linha (regras explicáveis e testadas). */
export function classifyStock(
  row: Pick<BiStockRow, "stock" | "minStock" | "salesWindow" | "stockDays" | "daysWithoutSale">,
  constants: typeof BI_CONSTANTS = BI_CONSTANTS,
): { status: StockStatus; reason: string } {
  const { URGENT_STOCK_DAYS, RESTOCK_STOCK_DAYS, HIGH_STOCK_DAYS, STUCK_DAYS } = constants;
  if (row.stock <= 0) return { status: "esgotado", reason: "Estoque zerado." };

  if (row.salesWindow <= 0) {
    const days = row.daysWithoutSale;
    if (days == null || days >= STUCK_DAYS) {
      return {
        status: "estoque_parado",
        reason: days == null
          ? "Nunca vendeu — estoque parado."
          : `Sem vendas há ${days} dias — estoque parado.`,
      };
    }
    return { status: "baixa_saida", reason: `Última venda há ${days} dias — saída muito lenta.` };
  }

  const days = row.stockDays;
  if (days != null && days <= URGENT_STOCK_DAYS) {
    return {
      status: "reposicao_urgente",
      reason: `Alta velocidade + estoque para apenas ${floor1(days)} dia${days <= 1 ? "" : "s"}.`,
    };
  }
  if ((days != null && days <= RESTOCK_STOCK_DAYS) || row.stock <= row.minStock) {
    return {
      status: "reposicao_recomendada",
      reason: days != null && days <= RESTOCK_STOCK_DAYS
        ? `Estoque estimado em ${floor1(days)} dias — perto do mínimo (${row.minStock}).`
        : `Estoque (${row.stock}) igual ou abaixo do mínimo (${row.minStock}).`,
    };
  }
  if (days != null && days >= HIGH_STOCK_DAYS) {
    return { status: "baixa_saida", reason: `Estoque para ${floor1(days)} dias — saída lenta.` };
  }
  return { status: "saudavel", reason: "Estoque compatível com a demanda atual." };
}

/** Analisa todos os produtos do catálogo (exclui internos). `range` é usado
 *  apenas para a coluna "vendido no período"; a velocidade usa os últimos 30
 *  dias terminando em `now`. */
export function stockAnalysis(
  source: BiSource,
  range: BiRange,
  now: Date = new Date(),
): BiStockRow[] {
  const lines = buildLines(source);
  const allUnits = unitsByProduct(lines);
  const periodUnits = unitsByProduct(lines.filter((l) => inRange(l.date, range)));
  const windowStart = new Date(now.getTime() - BI_CONSTANTS.VELOCITY_WINDOW_DAYS * DAY_MS);
  const windowUnits = unitsByProduct(lines.filter((l) => inRange(l.date, { start: windowStart, end: now })));

  const rows: BiStockRow[] = [];
  for (const p of source.products) {
    if (p.internal === true) continue;
    const stock = p.stock ?? 0;
    const minStock = p.minStock ?? 0;
    const salesWindow = windowUnits.get(p.id)?.quantity ?? 0;
    const salesPeriod = periodUnits.get(p.id)?.quantity ?? 0;
    const lastSaleAt = allUnits.get(p.id)?.lastSaleAt ?? null;
    const dailyAverage = salesWindow / BI_CONSTANTS.VELOCITY_WINDOW_DAYS;
    const stockDays = dailyAverage > 0 ? stock / dailyAverage : null;
    const daysWithoutSale = lastSaleAt ? Math.floor((now.getTime() - lastSaleAt.getTime()) / DAY_MS) : null;
    const base = { stock, minStock, salesWindow, stockDays, daysWithoutSale };
    const { status, reason } = classifyStock(base);
    rows.push({
      productId: p.id,
      productName: p.name,
      category: p.category,
      stock,
      minStock,
      salesWindow,
      salesPeriod,
      dailyAverage,
      stockDays,
      lastSaleAt,
      daysWithoutSale,
      status,
      reason,
    });
  }
  return rows.sort((a, b) => b.salesWindow - a.salesWindow || a.stock - b.stock);
}

/** 📦 Recomendações de reposição — alta velocidade + estoque baixo/near min.
 *  Urgentes primeiro, depois por dias de estoque (menor primeiro). */
export function replenishmentRecommendations(rows: BiStockRow[]): BiStockRow[] {
  const urgent = rows.filter((r) => r.status === "reposicao_urgente");
  const normal = rows.filter((r) => r.status === "reposicao_recomendada");
  urgent.sort((a, b) => (a.stockDays ?? 1e9) - (b.stockDays ?? 1e9) || b.salesWindow - a.salesWindow);
  normal.sort((a, b) => (a.stockDays ?? 1e9) - (b.stockDays ?? 1e9) || b.salesWindow - a.salesWindow);
  return [...urgent, ...normal];
}

/** ⚠ Produtos com baixa demanda — pouca saída + estoque elevado. */
export function lowDemandProducts(rows: BiStockRow[]): BiStockRow[] {
  return rows
    .filter((r) => r.status === "baixa_saida" || r.status === "estoque_parado")
    .sort((a, b) => (a.stockDays ?? 0) - (b.stockDays ?? 0) || (a.daysWithoutSale ?? 0) - (b.daysWithoutSale ?? 0));
}

/** 🔴 Estoque parado — produtos com dias sem venda acima do limiar e estoque > 0. */
export function stuckStock(rows: BiStockRow[], thresholdDays: number): BiStockRow[] {
  return rows
    .filter((r) => r.stock > 0 && (r.daysWithoutSale != null ? r.daysWithoutSale >= thresholdDays : thresholdDays <= 30))
    .sort((a, b) => (b.daysWithoutSale ?? 0) - (a.daysWithoutSale ?? 0));
}
