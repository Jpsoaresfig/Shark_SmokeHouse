"use client";

/**
 * Painel de BI de vendas — agrega PDV + loja online (orders) usando o motor
 * puro em `src/lib/bi/*`. Componentes independentes por seção para compor as
 * abas da página de Relatórios Financeiros.
 */
import { useMemo, useState } from "react";
import {
  Download, TrendingUp, TrendingDown, RotateCcw, Package, Boxes,
  CalendarClock, MapPin, Users, CreditCard, TrendingUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart, type ChartPoint } from "@/components/admin/RevenueChart";
import { DonutChart, type DonutSlice } from "@/components/admin/DonutChart";
import { formatCurrency } from "@/lib/utils";
import {
  computePeriodComparison, evolution, productRanking, sortProductRanking,
  categoryRanking, salesByWeekday, salesByHour, salesByNeighborhood,
  salesBySeller, salesByPayment, productGrowth, BI_PAYMENT_LABELS,
} from "@/lib/bi/aggregate";
import {
  stockAnalysis, replenishmentRecommendations, STOCK_STATUS_META,
} from "@/lib/bi/insights";
import {
  downloadCsv, productRankingCsv, categoryRankingCsv, sellersCsv,
  neighborhoodsCsv, stockCsv, recommendationsCsv,
} from "@/lib/bi/export";
import type {
  BiEvolutionMetric, BiFilters, BiOrigin, BiRange, BiRankMode, BiSource,
} from "@/lib/bi/types";

const PALETTE = ["#34d399", "#22d3ee", "#fbbf24", "#a78bfa", "#fb923c", "#f472b6", "#60a5fa", "#c084fc"];

const EVO_METRICS: { key: BiEvolutionMetric; label: string }[] = [
  { key: "revenue", label: "Faturamento" },
  { key: "profit", label: "Lucro" },
  { key: "transactions", label: "Vendas" },
  { key: "units", label: "Unidades" },
];

const RANK_MODES: { key: BiRankMode; label: string }[] = [
  { key: "quantity_desc", label: "Vendidas ↓" },
  { key: "quantity_asc", label: "Vendidas ↑" },
  { key: "revenue_desc", label: "Faturamento ↓" },
  { key: "profit_desc", label: "Lucro ↓" },
  { key: "margin_desc", label: "Margem ↓" },
  { key: "margin_asc", label: "Margem ↑" },
];

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

const btnCsv =
  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/50 transition-all disabled:opacity-40";

interface BiViewProps {
  source: BiSource;
  range: BiRange;
  filters: BiFilters;
}

const pctStr = (n: number | null): string =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/* ── Barra de filtros combináveis ─────────────────────────────── */

export function BiFiltersBar({
  source, filters, onChange,
}: {
  source: BiSource;
  filters: BiFilters;
  onChange: (filters: BiFilters) => void;
}) {
  const sellerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of source.sellers) if (s.role === "seller") map.set(s.uid, s.displayName || s.uid);
    for (const sa of source.sales) if (sa.sellerId && !map.has(sa.sellerId)) map.set(sa.sellerId, sa.sellerName || sa.sellerId);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [source]);

  const neighborhoodOptions = useMemo(() => {
    const set = new Set<string>();
    for (const o of source.orders) if (o.deliveryAddress?.neighborhood) set.add(o.deliveryAddress.neighborhood);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [source]);

  const paymentOptions = useMemo(() => Object.entries(BI_PAYMENT_LABELS), []);

  const set = (patch: Partial<BiFilters>) => onChange({ ...filters, ...patch });

  const hasFilter = !!filters.category || !!filters.productId || !!filters.sellerId || !!filters.paymentMethod || !!filters.neighborhood || filters.origin !== "all";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[130px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Origem</label>
            <select value={filters.origin} onChange={(e) => set({ origin: e.target.value as BiOrigin })} className={inputCls}>
              <option value="all">Todos</option>
              <option value="pdv">PDV</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Categoria</label>
            <select value={filters.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })} className={inputCls}>
              <option value="">Todas</option>
              {source.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Produto</label>
            <select value={filters.productId ?? ""} onChange={(e) => set({ productId: e.target.value || undefined })} className={inputCls}>
              <option value="">Todos</option>
              {source.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Vendedor</label>
            <select value={filters.sellerId ?? ""} onChange={(e) => set({ sellerId: e.target.value || undefined })} className={inputCls}>
              <option value="">Todos</option>
              {sellerOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Pagamento</label>
            <select value={filters.paymentMethod ?? ""} onChange={(e) => set({ paymentMethod: e.target.value || undefined })} className={inputCls}>
              <option value="">Todos</option>
              {paymentOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Bairro</label>
            <select value={filters.neighborhood ?? ""} onChange={(e) => set({ neighborhood: e.target.value || undefined })} className={inputCls}>
              <option value="">Todos</option>
              {neighborhoodOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            onClick={() => onChange({ origin: "all" })}
            disabled={!hasFilter}
            className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/50 transition-all disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Limpar
          </button>
        </div>
        {hasFilter && (
          <p className="text-[11px] text-[var(--color-text-muted)] mt-3">
            Análises filtradas. No ranking e no resumo, faturamento/custo consideram apenas os itens que casam o filtro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Comparação com o período anterior ────────────────────────── */

export function BiComparison({ source, range, filters }: BiViewProps) {
  const comparison = useMemo(() => computePeriodComparison(source, range, filters), [source, range, filters]);
  const cmpCards = [
    { label: "Faturamento", cur: comparison.current.revenue, prev: comparison.previous.revenue, delta: comparison.deltas.revenue },
    { label: "Lucro", cur: comparison.current.profit, prev: comparison.previous.profit, delta: comparison.deltas.profit },
    { label: "Vendas", cur: comparison.current.transactions, prev: comparison.previous.transactions, delta: comparison.deltas.transactions },
    { label: "Unidades", cur: comparison.current.unitsSold, prev: comparison.previous.unitsSold, delta: comparison.deltas.unitsSold },
    { label: "Ticket médio", cur: comparison.current.ticketAvg, prev: comparison.previous.ticketAvg, delta: comparison.deltas.ticketAvg },
  ];

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUpDown className="w-4 h-4 text-[var(--color-neon-blue)]" />
          Comparação com o período anterior
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {cmpCards.map((c) => (
            <div key={c.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">{c.label}</p>
              <p className="text-lg font-black text-[var(--color-text-primary)] truncate">{formatCurrency(c.cur)}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-[var(--color-text-muted)]">ant.: {formatCurrency(c.prev)}</span>
                <span className={`text-xs font-bold tabular-nums ${c.delta == null ? "text-[var(--color-text-muted)]" : c.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {pctStr(c.delta)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Evolução no período ──────────────────────────────────────── */

export function BiEvolution({ source, range, filters }: BiViewProps) {
  const [evoMetric, setEvoMetric] = useState<BiEvolutionMetric>("revenue");
  const evoPoints = useMemo<ChartPoint[]>(
    () => evolution(source, range, filters, evoMetric).map((p) => ({ label: p.label, fullLabel: p.fullLabel, value: p.value })),
    [source, range, filters, evoMetric],
  );

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-neon-blue)]" />
          Evolução no período
        </CardTitle>
        <div className="flex flex-wrap gap-1.5">
          {EVO_METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setEvoMetric(m.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                evoMetric === m.key
                  ? "border-transparent bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <RevenueChart data={evoPoints} />
      </CardContent>
    </Card>
  );
}

/* ── Ranking de produtos ──────────────────────────────────────── */

export function BiProductRanking({ source, range, filters }: BiViewProps) {
  const [rankMode, setRankMode] = useState<BiRankMode>("quantity_desc");
  const products = useMemo(() => sortProductRanking(productRanking(source, range, filters), rankMode), [source, range, filters, rankMode]);

  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="w-4 h-4 text-[var(--color-neon-blue)]" />
          Ranking de produtos
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {RANK_MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setRankMode(m.key)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-all ${
                  rankMode === m.key
                    ? "border-transparent bg-[var(--color-neon-blue)]/15 text-[var(--color-neon-blue)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)]"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <button onClick={() => downloadCsv("produtos.csv", productRankingCsv(products))} className={btnCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3 text-right">Unidades vendidas</th>
                <th className="py-2 pr-3 text-right">Faturamento</th>
                <th className="py-2 pr-3 text-right">Lucro</th>
                <th className="py-2 pr-3 text-right">Margem</th>
                <th className="py-2 pr-3 text-right">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhum produto vendido no período.</td></tr>
              )}
              {products.map((r, i) => (
                <tr key={r.productId} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-overlay)] transition-colors">
                  <td className="py-2 pr-3 text-[var(--color-text-muted)] tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-3 font-medium text-[var(--color-text-primary)]">
                    {r.productName}
                    {r.variationName && <span className="text-[11px] text-[var(--color-text-muted)]"> · {r.variationName}</span>}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.quantity}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-primary)]">{formatCurrency(r.revenue)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-emerald-400">{formatCurrency(r.profit)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.margin.toFixed(1)}%</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.stock == null ? "—" : r.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Categorias + Pagamento ───────────────────────────────────── */

export function BiCategoryPayment({ source, range, filters }: BiViewProps) {
  const categories = useMemo(() => categoryRanking(source, range, filters), [source, range, filters]);
  const payments = useMemo(() => salesByPayment(source, range, filters), [source, range, filters]);
  const paymentSlices = useMemo<DonutSlice[]>(
    () => payments.map((p, i) => ({ key: p.method, label: p.label, value: p.revenue, color: PALETTE[i % PALETTE.length] })),
    [payments],
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Boxes className="w-4 h-4 text-[var(--color-neon-blue)]" />
            Por categoria
          </CardTitle>
          <button onClick={() => downloadCsv("categorias.csv", categoryRankingCsv(categories))} className={btnCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Sem vendas no período.</p>
          ) : (
            <div className="space-y-2.5">
              {categories.map((c, i) => {
                const max = Math.max(...categories.map((x) => x.revenue), 1);
                return (
                  <div key={c.category}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-[var(--color-text-primary)]">{c.label}</span>
                      <span className="tabular-nums text-[var(--color-text-muted)]">{formatCurrency(c.revenue)} · {c.quantity} un</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(c.revenue / max) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[var(--color-neon-blue)]" />
            Formas de pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <DonutChart data={paymentSlices} centerLabel="Faturamento" />
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Dia da semana + Horário ──────────────────────────────────── */

export function BiTimeAnalysis({ source, range, filters }: BiViewProps) {
  const [timeMetric, setTimeMetric] = useState<"revenue" | "transactions">("revenue");
  const weekdays = useMemo(() => salesByWeekday(source, range, filters), [source, range, filters]);
  const hours = useMemo(() => salesByHour(source, range, filters), [source, range, filters]);
  const format = (v: number) => (timeMetric === "revenue" ? formatCurrency(v) : String(v));

  const weekdayBars = weekdays.map((w) => ({
    label: w.label.slice(0, 3),
    value: timeMetric === "revenue" ? w.revenue : w.transactions,
    hint: w.label,
  }));
  const hourBars = hours.map((h) => ({
    label: `${h.hour}h`,
    value: timeMetric === "revenue" ? h.revenue : h.transactions,
    hint: `${h.hour}h`,
  }));

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[var(--color-neon-blue)]" />
          Vendas por dia da semana e horário
        </CardTitle>
        <div className="flex gap-1.5">
          {(["revenue", "transactions"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setTimeMetric(m)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                timeMetric === m
                  ? "border-transparent bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)]"
              }`}
            >
              {m === "revenue" ? "Faturamento" : "Nº vendas"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MiniBarChart items={weekdayBars} format={format} />
        <MiniBarChart items={hourBars} format={format} height={180} />
      </CardContent>
    </Card>
  );
}

/* ── Vendedores + Bairros ─────────────────────────────────────── */

export function BiSellersNeighborhoods({ source, range, filters }: BiViewProps) {
  const sellers = useMemo(() => salesBySeller(source, range, filters), [source, range, filters]);
  const neighborhoods = useMemo(() => salesByNeighborhood(source, range, filters), [source, range, filters]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-0 flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-neon-blue)]" />
            Por vendedor
          </CardTitle>
          <button onClick={() => downloadCsv("vendedores.csv", sellersCsv(sellers))} className={btnCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          {sellers.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhuma venda PDV no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <th className="py-2 pr-3">Vendedor</th>
                    <th className="py-2 pr-3 text-right">Vendas</th>
                    <th className="py-2 pr-3 text-right">Faturamento</th>
                    <th className="py-2 pr-3 text-right">Lucro</th>
                    <th className="py-2 pr-3 text-right">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {sellers.map((s) => (
                    <tr key={s.sellerId} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-3 text-[var(--color-text-primary)]">{s.sellerName}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.transactions}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(s.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-emerald-400">{formatCurrency(s.profit)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{formatCurrency(s.commission)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0 flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[var(--color-neon-blue)]" />
            Por bairro
          </CardTitle>
          <button onClick={() => downloadCsv("bairros.csv", neighborhoodsCsv(neighborhoods))} className={btnCsv}>
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </CardHeader>
        <CardContent className="pt-4">
          {neighborhoods.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhum pedido online no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                    <th className="py-2 pr-3">Bairro</th>
                    <th className="py-2 pr-3 text-right">Pedidos</th>
                    <th className="py-2 pr-3 text-right">Faturamento</th>
                    <th className="py-2 pr-3 text-right">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {neighborhoods.map((n) => (
                    <tr key={n.neighborhood} className="border-b border-[var(--color-border)]/50">
                      <td className="py-2 pr-3 text-[var(--color-text-primary)]">{n.neighborhood}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n.transactions}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(n.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{formatCurrency(n.ticketAvg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Produtos em alta / queda ─────────────────────────────────── */

export function BiGrowth({ source, range, filters }: BiViewProps) {
  const growth = useMemo(() => productGrowth(source, range, filters), [source, range, filters]);

  const Row = ({ g, kind }: { g: { productId: string; productName: string; currentQty: number; previousQty: number; pct: number | null; isNew: boolean }; kind: "rising" | "falling" }) => (
    <div className="flex items-center justify-between rounded-lg bg-[var(--color-bg-overlay)] px-3 py-2">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{g.productName}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{g.previousQty} → {g.currentQty} un</p>
      </div>
      {kind === "rising" && g.isNew
        ? <span className="text-xs font-bold text-[var(--color-neon-blue)]">Novo</span>
        : <span className={`text-xs font-bold ${kind === "rising" ? "text-emerald-400" : "text-red-400"}`}>{pctStr(g.pct)}</span>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Em alta
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {growth.rising.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Nenhum produto em alta.</p>
          ) : (
            <div className="space-y-2">
              {growth.rising.map((g) => <Row key={g.productId} g={g} kind="rising" />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            Em queda
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {growth.falling.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">Nenhum produto em queda.</p>
          ) : (
            <div className="space-y-2">
              {growth.falling.map((g) => <Row key={g.productId} g={g} kind="falling" />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Análise de estoque ───────────────────────────────────────── */

export function BiStock({ source, range }: { source: BiSource; range: BiRange }) {
  const [now] = useState(() => new Date());
  const stock = useMemo(() => stockAnalysis(source, range, now), [source, range, now]);
  const recommendations = useMemo(() => replenishmentRecommendations(stock), [stock]);

  return (
    <Card>
      <CardHeader className="pb-0 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Boxes className="w-4 h-4 text-[var(--color-neon-blue)]" />
          Análise de estoque
          {recommendations.length > 0 && (
            <span className="rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold px-2 py-0.5">
              {recommendations.length} para repor
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={() => downloadCsv("estoque.csv", stockCsv(stock))} className={btnCsv}>
            <Download className="w-3.5 h-3.5" /> Estoque
          </button>
          <button
            onClick={() => downloadCsv("reposicao.csv", recommendationsCsv(recommendations))}
            disabled={recommendations.length === 0}
            className={btnCsv}
          >
            <Download className="w-3.5 h-3.5" /> Reposição
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {recommendations.length > 0 && (
          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs font-bold text-amber-400 mb-2">Recomendações de reposição</p>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((r) => (
                <span key={r.productId} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-2.5 py-1 text-xs">
                  {r.status === "reposicao_urgente" && <span className="text-red-400 font-bold">!</span>}
                  <span className="text-[var(--color-text-primary)]">{r.productName}</span>
                  <span className="text-[var(--color-text-muted)]">{r.stock} em estoque</span>
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
                <th className="py-2 pr-3">Produto</th>
                <th className="py-2 pr-3 text-right">Estoque</th>
                <th className="py-2 pr-3 text-right">Vendas 30d</th>
                <th className="py-2 pr-3 text-right">Vend. período</th>
                <th className="py-2 pr-3 text-right">Média/dia</th>
                <th className="py-2 pr-3 text-right">Dias estoque</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhum produto no catálogo.</td></tr>
              )}
              {stock.map((r) => {
                const meta = STOCK_STATUS_META[r.status];
                return (
                  <tr key={r.productId} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg-overlay)] transition-colors">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-[var(--color-text-primary)]">{r.productName}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{r.reason}</p>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.stock}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.salesWindow}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.salesPeriod}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.dailyAverage.toFixed(1)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-[var(--color-text-muted)]">{r.stockDays == null ? "—" : r.stockDays.toFixed(0)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${meta.tone}`}>
                        {meta.emoji} {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Mini gráfico de barras verticais (sem lib externa) ──────── */

function MiniBarChart({
  items, format, height = 200,
}: {
  items: { label: string; value: number; hint?: string }[];
  format: (v: number) => string;
  height?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {items.map((it, i) => (
        <div key={i} className="group relative flex-1 flex flex-col justify-end items-center h-full min-w-0">
          <div
            className="w-full rounded-t-md transition-all"
            style={{
              height: `${(it.value / max) * 100}%`,
              background: "linear-gradient(180deg, var(--color-electric-blue), var(--color-neon-cyan))",
              minHeight: it.value > 0 ? 3 : 2,
              opacity: it.value > 0 ? 1 : 0.12,
            }}
          />
          <span className="text-[9px] text-[var(--color-text-muted)] mt-1 truncate w-full text-center">{it.label}</span>
          {it.value > 0 && (
            <div className="absolute -top-8 opacity-0 group-hover:opacity-100 pointer-events-none rounded-md bg-[var(--color-bg-base)] border border-[var(--color-border)] px-2 py-1 text-[10px] z-10 whitespace-nowrap">
              <p className="font-bold text-[var(--color-text-primary)]">{format(it.value)}</p>
              {it.hint && <p className="text-[var(--color-text-muted)]">{it.hint}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
