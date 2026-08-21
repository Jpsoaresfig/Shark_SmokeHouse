/**
 * Motor de agregação do BI de vendas. Lógica PURA — recebe a fonte de dados
 * (sales + orders + products + categories + sellers) e devolve as análises.
 *
 * Regras de negócio reaproveitadas do sistema (não recriadas):
 *  - vendas PDV canceladas (`paymentStatus === "cancelled"`) nunca contam;
 *  - pedido online conta como venda válida SOMENTE quando está finalizado:
 *    entregue (`status === "delivered"`) E com pagamento confirmado (`paid`).
 *    Pedidos em andamento (aguardando comprovante, em rota, preparando, etc.)
 *    e cancelados/estornados nunca entram no BI;
 *  - vendas legadas (sem `paymentStatus`) são quitadas (= "paid");
 *  - o custo do PDV usa o custo CONGELADO no item (`item.costPrice`), com
 *    fallback para o custo atual do produto (mesmo fallback do financeiro);
 *  - pedidos online usam o custo atual do produto (não congelam custo);
 *  - quando há filtro de categoria/marca/produto, o faturamento/custo do resumo
 *    usa os ITENS do filtro (subtotais), mantendo coerência com o ranking.
 */
import {
  saleStatus, saleCost, saleGrossProfit, saleCommission,
} from "@/lib/sales/helpers";
import { DAY_LABELS } from "@/lib/businessHours";
import { inRange, previousRange, storeParts, monthStoreKey, rangeLengthDays } from "./periods";
import type {
  BiCategoryRow, BiEvolutionMetric, BiEvolutionPoint, BiFilters, BiGrowthResult,
  BiHourRow, BiLine, BiNeighborhoodRow, BiOrigin, BiPaymentRow, BiPeriodComparison,
  BiProductRow, BiProductTrend, BiRankMode, BiSellerRow, BiSource, BiSummary,
  BiTxnRow, BiWeekdayRow,
} from "./types";
import type { Category, Order } from "@/types";

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

/** Rótulos combinados de forma de pagamento (PDV + online + legados). */
export const BI_PAYMENT_LABELS: Record<string, string> = {
  pix_manual: "PIX (comprovante)",
  mercadopago: "Mercado Pago (PIX)",
  on_delivery: "Na entrega",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  whatsapp: "WhatsApp",
  loyalty: "Pontos (fidelidade)",
  online: "PIX (online)",
  on_arrival: "Na entrega",
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
  pending: "—",
};

/** Resolve o pagamento de um pedido (espelho do helper de pagamentos, sem
 *  puxar a cadeia de gateways — o BI é lógica pura). */
function orderPayment(order: Order): { method: string; status: string } {
  const legacyMethod = order.paymentMethod ?? "pending";
  const legacyStatus = order.paymentStatus ?? "pending";
  return {
    method: order.payment?.method ?? legacyMethod,
    status: order.payment?.status ?? legacyStatus,
  };
}

/** Pedido online FINALIZADO: entregue e com pagamento confirmado. Pedidos em
 *  andamento (aguardando comprovante, em rota, preparando, etc.) ou que foram
 *  cancelados/estornados não contam como venda no BI. */
function isFinalizedOrder(order: Order): boolean {
  if (order.status !== "delivered") return false;
  return orderPayment(order).status === "paid";
}

/** Mapa productId → custo atual (fallback para itens sem custo congelado). */
function costMapOf(source: BiSource): Map<string, number> {
  return new Map(source.products.map((p) => [p.id, p.costPrice ?? 0]));
}

/** Mapa slug → rótulo de categoria. */
export function categoryLabelsOf(categories: Category[]): Record<string, string> {
  return Object.fromEntries(categories.map((c) => [c.slug, c.label]));
}

/* ── Linhas unificadas ─────────────────────────────────────── */

/** Monta as linhas de item unificadas (PDV + online), excluindo vendas inválidas. */
export function buildLines(source: BiSource): BiLine[] {
  const productMap = new Map(source.products.map((p) => [p.id, p]));
  const lines: BiLine[] = [];
  for (const s of source.sales) {
    if (saleStatus(s) === "cancelled") continue;
    for (const item of s.items) {
      lines.push({
        transactionId: s.id,
        source: "pdv",
        productId: item.productId,
        productName: item.productName,
        variationId: item.variationId,
        variationName: item.variationName,
        sku: item.sku,
        category: item.category,
        brand: productMap.get(item.productId)?.brand,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.subtotal ?? item.price * item.quantity,
        costUnit: item.costPrice ?? productMap.get(item.productId)?.costPrice,
        date: toDate(s.createdAt),
        sellerId: s.sellerId,
        sellerName: s.sellerName,
        paymentMethod: s.paymentMethod,
      });
    }
  }
  for (const o of source.orders) {
    if (!isFinalizedOrder(o)) continue;
    const pay = orderPayment(o);
    for (const item of o.items) {
      const prod = productMap.get(item.productId);
      lines.push({
        transactionId: o.id,
        source: "online",
        productId: item.productId,
        productName: item.name,
        variationId: item.variationId,
        variationName: item.color,
        sku: item.variationSku,
        category: prod?.category,
        brand: prod?.brand,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotal: item.price * item.quantity,
        costUnit: prod?.costPrice,
        date: toDate(o.createdAt),
        paymentMethod: pay.method,
        neighborhood: o.deliveryAddress?.neighborhood,
      });
    }
  }
  return lines;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === "object" && "toDate" in value) return (value as { toDate(): Date }).toDate();
  return new Date(value as string | number);
}

function matchesItemFilter(
  item: { productId: string; category?: string; brand?: string },
  filters: BiFilters,
): boolean {
  if (filters.productId && item.productId !== filters.productId) return false;
  if (filters.category && item.category !== filters.category) return false;
  if (filters.brand && item.brand !== filters.brand) return false;
  return true;
}

/** Filtra linhas pelo período + filtros combináveis. */
export function filterLines(lines: BiLine[], range: { start: Date; end: Date }, filters: BiFilters): BiLine[] {
  return lines.filter(
    (l) =>
      inRange(l.date, range) &&
      (filters.origin === "all" || l.source === filters.origin) &&
       (!filters.category || l.category === filters.category) &&
       (!filters.brand || l.brand === filters.brand) &&
       (!filters.productId || l.productId === filters.productId) &&
      (!filters.paymentMethod || l.paymentMethod === filters.paymentMethod) &&
      (!filters.sellerId || l.sellerId === filters.sellerId) &&
      (!filters.neighborhood || l.neighborhood === filters.neighborhood),
  );
}

/* ── Transações (base dos KPIs) ─────────────────────────────── */

/**
 * Linhas de TRANSAÇÃO (venda/pedido inteiro) no período que casam os filtros.
 * - Sem filtro de categoria/marca/produto: faturamento = total da transação,
 *   custo = custo da transação (mesma base do financeiro).
 * - Com filtro de categoria/marca/produto: usa os subtotais dos itens que casam,
 *   mantendo coerência com o ranking de produtos/categorias.
 */
export function buildTxnRows(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiTxnRow[] {
  const costMap = costMapOf(source);
  const productMap = new Map(source.products.map((p) => [p.id, p]));
  const hasItemFilter = !!filters.category || !!filters.brand || !!filters.productId;
  const rows: BiTxnRow[] = [];

  for (const s of source.sales) {
    if (saleStatus(s) === "cancelled") continue;
    if (filters.origin === "online") continue;
    if (filters.sellerId && s.sellerId !== filters.sellerId) continue;
    if (filters.paymentMethod && s.paymentMethod !== filters.paymentMethod) continue;
    if (filters.neighborhood) continue; // vendas PDV não têm bairro
    const d = toDate(s.createdAt);
    if (!inRange(d, range)) continue;

    let revenue: number;
    let cost: number;
    let units: number;
    if (hasItemFilter) {
      const match = s.items.filter((it) => matchesItemFilter({ ...it, brand: productMap.get(it.productId)?.brand }, filters));
      if (match.length === 0) continue;
      revenue = match.reduce((a, it) => a + (it.subtotal ?? it.price * it.quantity), 0);
      cost = match.reduce((a, it) => a + (it.costPrice ?? costMap.get(it.productId) ?? 0) * it.quantity, 0);
      units = match.reduce((a, it) => a + it.quantity, 0);
    } else {
      revenue = s.total ?? 0;
      cost = saleCost(s, costMap);
      units = s.items.reduce((a, it) => a + it.quantity, 0);
    }
    rows.push({ transactionId: s.id, source: "pdv", date: d, revenue, cost, units, sellerId: s.sellerId, sellerName: s.sellerName, paymentMethod: s.paymentMethod });
  }

  for (const o of source.orders) {
    if (!isFinalizedOrder(o)) continue;
    const pay = orderPayment(o);
    if (filters.origin === "pdv") continue;
    if (filters.sellerId) continue; // pedidos online não têm vendedor
    if (filters.paymentMethod && pay.method !== filters.paymentMethod) continue;
    if (filters.neighborhood && o.deliveryAddress?.neighborhood !== filters.neighborhood) continue;
    const d = toDate(o.createdAt);
    if (!inRange(d, range)) continue;

    let revenue: number;
    let cost: number;
    let units: number;
    if (hasItemFilter) {
      const match = o.items.filter((it) => {
        const prod = productMap.get(it.productId);
        return matchesItemFilter({ productId: it.productId, category: prod?.category, brand: prod?.brand }, filters);
      });
      if (match.length === 0) continue;
      revenue = match.reduce((a, it) => a + it.price * it.quantity, 0);
      cost = match.reduce((a, it) => a + (productMap.get(it.productId)?.costPrice ?? 0) * it.quantity, 0);
      units = match.reduce((a, it) => a + it.quantity, 0);
    } else {
      revenue = o.total ?? 0;
      cost = o.items.reduce((a, it) => a + (productMap.get(it.productId)?.costPrice ?? 0) * it.quantity, 0);
      units = o.items.reduce((a, it) => a + it.quantity, 0);
    }
    rows.push({ transactionId: o.id, source: "online", date: d, revenue, cost, units, paymentMethod: pay.method, neighborhood: o.deliveryAddress?.neighborhood });
  }
  return rows;
}

/* ── Resumo do período ──────────────────────────────────────── */

export function computeSummary(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiSummary {
  const rows = buildTxnRows(source, range, filters);
  let revenue = 0, cost = 0, units = 0;
  for (const r of rows) {
    revenue += r.revenue;
    cost += r.cost;
    units += r.units;
  }
  const profit = revenue - cost;
  return {
    revenue,
    cost,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    transactions: rows.length,
    unitsSold: units,
    ticketAvg: rows.length > 0 ? revenue / rows.length : 0,
  };
}

/** Resumo do período + comparação com o período anterior equivalente. */
export function computePeriodComparison(
  source: BiSource,
  range: { start: Date; end: Date },
  filters: BiFilters,
): BiPeriodComparison {
  const current = computeSummary(source, range, filters);
  const previous = computeSummary(source, previousRange(range), filters);
  const pct = (cur: number, prev: number): number | null => (prev !== 0 ? ((cur - prev) / prev) * 100 : null);
  return {
    current,
    previous,
    deltas: {
      revenue: pct(current.revenue, previous.revenue),
      profit: pct(current.profit, previous.profit),
      transactions: pct(current.transactions, previous.transactions),
      unitsSold: pct(current.unitsSold, previous.unitsSold),
      ticketAvg: pct(current.ticketAvg, previous.ticketAvg),
    },
  };
}

/* ── Ranking de produtos ────────────────────────────────────── */

export function productRanking(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiProductRow[] {
  const lines = filterLines(buildLines(source), range, filters);
  const productMap = new Map(source.products.map((p) => [p.id, p]));
  const map = new Map<string, BiProductRow>();
  for (const l of lines) {
    const key = l.productId;
    const cost = (l.costUnit ?? 0) * l.quantity;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += l.quantity;
      existing.revenue += l.subtotal;
      existing.cost += cost;
    } else {
      map.set(key, {
        productId: l.productId,
        productName: l.productName,
        variationName: l.variationName,
        category: l.category,
        quantity: l.quantity,
        revenue: l.subtotal,
        cost,
        profit: l.subtotal - cost,
        margin: l.subtotal > 0 ? ((l.subtotal - cost) / l.subtotal) * 100 : 0,
        stock: productMap.get(l.productId)?.stock ?? null,
      });
    }
  }
  const rows = [...map.values()];
  for (const r of rows) r.profit = r.revenue - r.cost;
  for (const r of rows) r.margin = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
  return sortProductRanking(rows, "quantity_desc");
}

export function sortProductRanking(rows: BiProductRow[], mode: BiRankMode): BiProductRow[] {
  const sorted = [...rows];
  switch (mode) {
    case "quantity_desc": sorted.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue); break;
    case "quantity_asc": sorted.sort((a, b) => a.quantity - b.quantity || a.revenue - b.revenue); break;
    case "revenue_desc": sorted.sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity); break;
    case "profit_desc": sorted.sort((a, b) => b.profit - a.profit || b.revenue - a.revenue); break;
    case "margin_desc": sorted.sort((a, b) => b.margin - a.margin || b.revenue - a.revenue); break;
    case "margin_asc": sorted.sort((a, b) => a.margin - b.margin || b.revenue - a.revenue); break;
  }
  return sorted;
}

/* ── Ranking por categoria ──────────────────────────────────── */

export function categoryRanking(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiCategoryRow[] {
  const lines = filterLines(buildLines(source), range, filters);
  const labels = categoryLabelsOf(source.categories);
  const map = new Map<string, BiCategoryRow>();
  for (const l of lines) {
    const key = l.category ?? "(sem categoria)";
    const cost = (l.costUnit ?? 0) * l.quantity;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += l.quantity;
      existing.revenue += l.subtotal;
      existing.cost += cost;
    } else {
      map.set(key, {
        category: key,
        label: key in labels ? labels[key] : key,
        quantity: l.quantity,
        revenue: l.subtotal,
        cost,
        profit: l.subtotal - cost,
        margin: l.subtotal > 0 ? ((l.subtotal - cost) / l.subtotal) * 100 : 0,
      });
    }
  }
  const rows = [...map.values()];
  for (const r of rows) r.profit = r.revenue - r.cost;
  for (const r of rows) r.margin = r.revenue > 0 ? (r.profit / r.revenue) * 100 : 0;
  return rows.sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

/* ── Dia da semana e horário (fuso da loja) ─────────────────── */

export function salesByWeekday(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiWeekdayRow[] {
  const rows = buildTxnRows(source, range, filters);
  const buckets: BiWeekdayRow[] = DAY_LABELS.map((label, weekday) => ({ weekday, label, transactions: 0, revenue: 0, ticketAvg: 0 }));
  for (const r of rows) {
    const dow = storeParts(r.date).dow;
    buckets[dow].transactions += 1;
    buckets[dow].revenue += r.revenue;
  }
  for (const b of buckets) b.ticketAvg = b.transactions > 0 ? b.revenue / b.transactions : 0;
  return buckets;
}

export function salesByHour(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiHourRow[] {
  const rows = buildTxnRows(source, range, filters);
  const buckets: BiHourRow[] = Array.from({ length: 24 }, (_, hour) => ({ hour, transactions: 0, revenue: 0 }));
  for (const r of rows) {
    const h = storeParts(r.date).hour;
    buckets[h].transactions += 1;
    buckets[h].revenue += r.revenue;
  }
  return buckets;
}

/* ── Bairro (pedidos online) ────────────────────────────────── */

export function salesByNeighborhood(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiNeighborhoodRow[] {
  const rows = buildTxnRows(source, range, filters).filter((r) => r.source === "online" && !!r.neighborhood);
  const map = new Map<string, BiNeighborhoodRow>();
  for (const r of rows) {
    const key = r.neighborhood!;
    const existing = map.get(key);
    if (existing) {
      existing.transactions += 1;
      existing.revenue += r.revenue;
    } else {
      map.set(key, { neighborhood: key, transactions: 1, revenue: r.revenue, ticketAvg: 0 });
    }
  }
  const out = [...map.values()];
  for (const b of out) b.ticketAvg = b.transactions > 0 ? b.revenue / b.transactions : 0;
  return out.sort((a, b) => b.revenue - a.revenue || b.transactions - a.transactions);
}

/* ── Vendedor (PDV) ─────────────────────────────────────────── */

export function salesBySeller(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiSellerRow[] {
  const costMap = costMapOf(source);
  const productMap = new Map(source.products.map((p) => [p.id, p]));
  const rateMap = new Map(source.sellers.map((s) => [s.uid, s.commissionRate ?? 0]));
  const hasItemFilter = !!filters.category || !!filters.brand || !!filters.productId;
  const map = new Map<string, BiSellerRow>();
  for (const s of source.sales) {
    if (saleStatus(s) === "cancelled") continue;
    if (filters.origin === "online") continue;
    if (filters.sellerId && s.sellerId !== filters.sellerId) continue;
    if (filters.paymentMethod && s.paymentMethod !== filters.paymentMethod) continue;
    if (filters.neighborhood) continue;
    if (!inRange(toDate(s.createdAt), range)) continue;
    if (hasItemFilter) {
      const match = s.items.filter((it) => matchesItemFilter({ ...it, brand: productMap.get(it.productId)?.brand }, filters));
      if (match.length === 0) continue;
    }
    const key = s.sellerId ?? "(sem vendedor)";
    const rate = rateMap.get(s.sellerId ?? "") ?? 0;
    let row = map.get(key);
    if (!row) {
      row = { sellerId: s.sellerId ?? "", sellerName: s.sellerName || "(sem vendedor)", transactions: 0, revenue: 0, ticketAvg: 0, profit: 0, commission: 0, commissionRate: rate };
      map.set(key, row);
    }
    row.transactions += 1;
    if (hasItemFilter) {
      const match = s.items.filter((it) => matchesItemFilter(it, filters));
      row.revenue += match.reduce((a, it) => a + (it.subtotal ?? it.price * it.quantity), 0);
      row.profit += match.reduce((a, it) => a + (it.subtotal ?? it.price * it.quantity) - (it.costPrice ?? costMap.get(it.productId) ?? 0) * it.quantity, 0);
    } else {
      row.revenue += s.total ?? 0;
      row.profit += saleGrossProfit(s, costMap);
    }
    const comm = saleCommission(s, rate);
    if (comm) row.commission += comm.amount;
  }
  const out = [...map.values()];
  for (const r of out) r.ticketAvg = r.transactions > 0 ? r.revenue / r.transactions : 0;
  return out.sort((a, b) => b.revenue - a.revenue || b.transactions - a.transactions);
}

/* ── Forma de pagamento ─────────────────────────────────────── */

export function salesByPayment(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiPaymentRow[] {
  const rows = buildTxnRows(source, range, filters);
  const map = new Map<string, { transactions: number; revenue: number }>();
  let totalRevenue = 0;
  for (const r of rows) {
    const key = r.paymentMethod ?? "pending";
    const existing = map.get(key);
    if (existing) { existing.transactions += 1; existing.revenue += r.revenue; }
    else map.set(key, { transactions: 1, revenue: r.revenue });
    totalRevenue += r.revenue;
  }
  return [...map.entries()]
    .map(([method, v]) => ({
      method,
      label: BI_PAYMENT_LABELS[method] ?? method,
      transactions: v.transactions,
      revenue: v.revenue,
      percent: totalRevenue > 0 ? (v.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.transactions - a.transactions);
}

/* ── Evolução (diária ou mensal) ────────────────────────────── */

export function evolution(
  source: BiSource,
  range: { start: Date; end: Date },
  filters: BiFilters,
  metric: BiEvolutionMetric,
): BiEvolutionPoint[] {
  const rows = buildTxnRows(source, range, filters);
  const daily = rangeLengthDays(range) <= 62;
  const buckets = new Map<string, BiEvolutionPoint>();
  for (const r of rows) {
    const p = storeParts(r.date);
    const key = daily ? p.iso : monthStoreKey(r.date);
    let bucket = buckets.get(key);
    if (!bucket) {
      const sortKey = daily
        ? new Date(Date.UTC(p.y, p.m - 1, p.d)).getTime()
        : new Date(Date.UTC(p.y, p.m - 1, 1)).getTime();
      bucket = {
        label: daily
          ? `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`
          : `${MONTH_NAMES_SHORT[p.m - 1]}/${String(p.y).slice(-2)}`,
        fullLabel: daily
          ? `${p.d} de ${MONTH_NAMES_FULL[p.m - 1]}, ${p.y}`
          : `${MONTH_NAMES_FULL[p.m - 1]} de ${p.y}`,
        sortKey,
        value: 0,
      };
      buckets.set(key, bucket);
    }
    const value =
      metric === "revenue" ? r.revenue :
      metric === "profit" ? r.revenue - r.cost :
      metric === "transactions" ? 1 :
      r.units;
    bucket.value += value;
  }
  return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
}

/* ── Produtos em alta / em queda ────────────────────────────── */

export function productGrowth(source: BiSource, range: { start: Date; end: Date }, filters: BiFilters): BiGrowthResult {
  const currentLines = filterLines(buildLines(source), range, filters);
  const prevRange = previousRange(range);
  const prevLines = filterLines(buildLines(source), prevRange, filters);
  const qty = (lines: BiLine[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
    return m;
  };
  const current = qty(currentLines);
  const previous = qty(prevLines);
  const ids = new Set([...current.keys(), ...previous.keys()]);
  const nameOf = (id: string): string =>
    currentLines.find((l) => l.productId === id)?.productName ??
    prevLines.find((l) => l.productId === id)?.productName ??
    id;

  const rows: BiProductTrend[] = [];
  for (const id of ids) {
    const c = current.get(id) ?? 0;
    const p = previous.get(id) ?? 0;
    const isNew = p === 0 && c > 0;
    rows.push({
      productId: id,
      productName: nameOf(id),
      currentQty: c,
      previousQty: p,
      pct: p > 0 ? ((c - p) / p) * 100 : null,
      isNew,
    });
  }
  const rising = rows
    .filter((r) => r.currentQty > r.previousQty)
    .sort((a, b) => (b.pct ?? 1e9) - (a.pct ?? 1e9));
  const falling = rows
    .filter((r) => r.currentQty < r.previousQty)
    .sort((a, b) => (a.pct ?? -1e9) - (b.pct ?? -1e9));
  return { rising, falling };
}

/** Unidades vendidas por produto num período (para o BI de estoque). */
export function unitsByProduct(lines: BiLine[]): Map<string, { quantity: number; lastSaleAt: Date | null }> {
  const m = new Map<string, { quantity: number; lastSaleAt: Date | null }>();
  for (const l of lines) {
    const e = m.get(l.productId) ?? { quantity: 0, lastSaleAt: null };
    e.quantity += l.quantity;
    if (!e.lastSaleAt || l.date.getTime() > e.lastSaleAt.getTime()) e.lastSaleAt = l.date;
    m.set(l.productId, e);
  }
  return m;
}

/** Filtra pedidos/linhas por origem para rótulos de exibição. */
export function originLabel(origin: BiOrigin): string {
  return origin === "all" ? "Todos" : origin === "online" ? "Online" : "PDV";
}
