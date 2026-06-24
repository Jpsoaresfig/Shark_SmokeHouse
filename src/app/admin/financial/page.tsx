"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, Wallet, CircleDollarSign, Percent, Package2,
  PiggyBank, RefreshCw, BarChart3, Receipt, PieChart, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { RevenueChart, type ChartPoint } from "@/components/admin/RevenueChart";
import { DonutChart, type DonutSlice } from "@/components/admin/DonutChart";
import { formatCurrency } from "@/lib/utils";
import { getSales, SALE_PAYMENT_LABELS as PAYMENT_LABELS } from "@/lib/firebase/sales";
import { getProducts } from "@/lib/firebase/products";
import {
  saleStatus, saleIsRevenue, saleReceivedAmount, saleOutstanding,
  saleDiscountTotal, saleCost, saleGrossProfit, saleRealizedProfit, cashEntriesForSale,
} from "@/lib/sales/helpers";
import { toast } from "@/stores/toastStore";
import type { Sale, SalePaymentMethod } from "@/types";

const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(v: any): Date {
  if (!v) return new Date(0);
  if (typeof v === "string") return new Date(v);
  if (typeof v.toDate === "function") return v.toDate();
  return new Date(0);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Primeiro/último dia do mês atual (default do filtro). Computado uma vez no
 *  carregamento do módulo — fora do render, para não chamar `new Date()` durante
 *  a renderização (regra de pureza do React Compiler). */
function defaultRange(): { start: string; end: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: ymd(first), end: ymd(last) };
}
const DEFAULT_RANGE = defaultRange();

/* ── Métricas selecionáveis do gráfico de rosca ──────────────────────────────
 * O admin escolhe quais aparecem como fatias. `get` extrai o valor a partir dos
 * KPIs já calculados e da quebra por forma de pagamento. */
interface KpiValues {
  sold: number; received: number; pending: number; discounts: number;
  cost: number; profitProj: number; profitReal: number;
}
interface DonutMetricDef {
  key: string;
  label: string;
  color: string;
  get: (k: KpiValues, byMethod: Map<SalePaymentMethod, number>) => number;
}

const DONUT_METRICS: DonutMetricDef[] = [
  { key: "sold",       label: "Faturamento bruto", color: "#34d399", get: (k) => k.sold },
  { key: "received",   label: "Recebido (caixa)",  color: "var(--color-neon-blue)", get: (k) => k.received },
  { key: "pending",    label: "A receber",         color: "#fbbf24", get: (k) => k.pending },
  { key: "discounts",  label: "Descontos",         color: "#c084fc", get: (k) => k.discounts },
  { key: "cost",       label: "Custo das vendas",  color: "#fb923c", get: (k) => k.cost },
  { key: "profitProj", label: "Lucro projetado",   color: "#22d3ee", get: (k) => k.profitProj },
  { key: "profitReal", label: "Lucro realizado",   color: "#818cf8", get: (k) => k.profitReal },
  { key: "m_cash",     label: "Dinheiro",          color: "#4ade80", get: (_k, m) => m.get("cash") ?? 0 },
  { key: "m_credit",   label: "Crédito",           color: "#60a5fa", get: (_k, m) => m.get("credit") ?? 0 },
  { key: "m_debit",    label: "Débito",            color: "#f472b6", get: (_k, m) => m.get("debit") ?? 0 },
  { key: "m_pix",      label: "Pix",               color: "#2dd4bf", get: (_k, m) => m.get("pix") ?? 0 },
  { key: "m_card",     label: "Cartão",            color: "#a78bfa", get: (_k, m) => m.get("card") ?? 0 },
];

const DONUT_DEFAULT_KEYS = ["m_cash", "m_credit", "m_debit", "m_pix"];
const DONUT_STORAGE_KEY = "shark:financial:donut-metrics";

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all";

export default function AdminFinancial() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [costMap, setCostMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(DEFAULT_RANGE.start);
  const [endDate, setEndDate] = useState(DEFAULT_RANGE.end);
  // Lazy init: lê a seleção salva uma única vez (mesmo padrão do NotificationCenter).
  const [donutKeys, setDonutKeys] = useState<string[]>(() => {
    if (typeof window === "undefined") return DONUT_DEFAULT_KEYS;
    try {
      const raw = localStorage.getItem(DONUT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return parsed.filter((k: string) => DONUT_METRICS.some((m) => m.key === k));
      }
    } catch { /* ignora storage inválido */ }
    return DONUT_DEFAULT_KEYS;
  });

  const load = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [allSales, products] = await Promise.all([
        getSales(undefined, undefined, force), // todas: KPIs por data da venda, caixa por data do recebimento
        getProducts(force),
      ]);
      setSales(allSales);
      setCostMap(new Map(products.map((p) => [p.id, p.costPrice ?? 0])));
    } catch {
      toast.error("Não foi possível carregar os dados financeiros.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Persiste a seleção de métricas do donut sempre que muda. */
  useEffect(() => {
    try { localStorage.setItem(DONUT_STORAGE_KEY, JSON.stringify(donutKeys)); } catch { /* */ }
  }, [donutKeys]);

  const rangeStart = useMemo(() => { const d = new Date(startDate); d.setHours(0, 0, 0, 0); return d; }, [startDate]);
  const rangeEnd = useMemo(() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; }, [endDate]);

  /* KPIs por COMPETÊNCIA: vendas cuja data está no período. */
  const kpis = useMemo(() => {
    let sold = 0, received = 0, pending = 0, discounts = 0, cost = 0, profitProj = 0, profitReal = 0;
    let countPaid = 0, countPending = 0, countCancelled = 0;
    for (const s of sales) {
      const d = toDate(s.createdAt);
      if (d < rangeStart || d > rangeEnd) continue;
      const st = saleStatus(s);
      if (st === "cancelled") { countCancelled++; continue; }
      if (st === "paid") countPaid++; else countPending++;
      if (saleIsRevenue(s)) sold += s.total;
      received += saleReceivedAmount(s);
      pending += saleOutstanding(s);
      discounts += saleDiscountTotal(s);
      cost += saleCost(s, costMap);
      profitProj += saleGrossProfit(s, costMap);
      profitReal += saleRealizedProfit(s, costMap);
    }
    const margin = sold > 0 ? (profitProj / sold) * 100 : 0;
    return { sold, received, pending, discounts, cost, profitProj, profitReal, countPaid, countPending, countCancelled, margin };
  }, [sales, rangeStart, rangeEnd, costMap]);

  /* FLUXO DE CAIXA por data do RECEBIMENTO (inclui pagamentos de vendas antigas). */
  const { cashTotal, cashByMethod, cashChart } = useMemo(() => {
    const buckets = new Map<string, number>();
    // pré-popula cada dia do período (mantém zeros visíveis no gráfico)
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      buckets.set(ymd(new Date(d)), 0);
    }
    const byMethod = new Map<SalePaymentMethod, number>();
    let total = 0;
    for (const s of sales) {
      for (const e of cashEntriesForSale(s)) {
        const when = toDate(e.at);
        if (when < rangeStart || when > rangeEnd) continue;
        total += e.amount;
        byMethod.set(e.method, (byMethod.get(e.method) ?? 0) + e.amount);
        const key = ymd(when);
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + e.amount);
      }
    }
    const chart: ChartPoint[] = Array.from(buckets.entries())
      .map(([key, value]) => {
        const [y, m, day] = key.split("-").map(Number);
        return {
          label: `${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}`,
          fullLabel: `${day} de ${MONTH_NAMES_FULL[m - 1]}, ${y}`,
          value,
          sortKey: new Date(y, m - 1, day).getTime(),
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ sortKey, ...rest }) => { void sortKey; return rest; });
    return { cashTotal: total, cashByMethod: byMethod, cashChart: chart };
  }, [sales, rangeStart, rangeEnd]);

  /* Fatias do donut conforme métricas escolhidas (mantém a ordem do registry). */
  const donutSlices = useMemo<DonutSlice[]>(() => {
    return DONUT_METRICS
      .filter((m) => donutKeys.includes(m.key))
      .map((m) => ({ key: m.key, label: m.label, color: m.color, value: m.get(kpis, cashByMethod) }));
  }, [donutKeys, kpis, cashByMethod]);

  const toggleDonutKey = (key: string) =>
    setDonutKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const setPreset = (preset: "thisMonth" | "lastMonth" | "last30") => {
    const now = new Date();
    if (preset === "thisMonth") {
      setStartDate(ymd(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    } else if (preset === "lastMonth") {
      setStartDate(ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setEndDate(ymd(new Date(now.getFullYear(), now.getMonth(), 0)));
    } else {
      const from = new Date(now); from.setDate(from.getDate() - 29);
      setStartDate(ymd(from));
      setEndDate(ymd(now));
    }
  };

  const kpiCards = [
    { label: "Faturamento bruto", value: formatCurrency(kpis.sold), hint: "vendas do período (competência)", icon: Receipt, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Recebido (caixa)", value: formatCurrency(kpis.received), hint: `${kpis.countPaid} pagas`, icon: Wallet, color: "text-[var(--color-neon-blue)]", bg: "bg-[var(--color-neon-blue-glow)]" },
    { label: "A receber", value: formatCurrency(kpis.pending), hint: `${kpis.countPending} pendentes`, icon: CircleDollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Descontos", value: formatCurrency(kpis.discounts), hint: `${kpis.countCancelled} canceladas`, icon: Percent, color: "text-purple-400", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <AdminPageHeader
          title="Relatórios Financeiros"
          subtitle="Faturamento, lucro e fluxo de caixa. Vendido (competência) × recebido (caixa)."
          action={
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/50 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </button>
          }
        />

        {/* Filtro de período */}
        <Card className="mb-6">
          <CardContent className="p-4 flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">De</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1.5">Até</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setPreset("thisMonth")}>Este mês</Button>
              <Button variant="secondary" size="sm" onClick={() => setPreset("lastMonth")}>Mês passado</Button>
              <Button variant="secondary" size="sm" onClick={() => setPreset("last30")}>30 dias</Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card>
                <CardContent className="p-4">
                  <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                    {loading ? <div className="w-4 h-4 rounded-full bg-[var(--color-bg-overlay)] animate-pulse" /> : <c.icon className={`w-4 h-4 ${c.color}`} />}
                  </div>
                  {loading
                    ? <div className="h-6 w-20 rounded bg-[var(--color-bg-overlay)] animate-pulse mb-1" />
                    : <p className="text-xl font-black text-[var(--color-text-primary)] truncate">{c.value}</p>}
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{c.label}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{c.hint}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Lucro: projetado × realizado + custo/margem */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="border-emerald-500/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <PiggyBank className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Lucro projetado</p>
              </div>
              <p className="text-2xl font-black text-emerald-400">{formatCurrency(kpis.profitProj)}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Se todas as vendas do período forem pagas · margem {kpis.margin.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-[var(--color-neon-blue)]/20">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-[var(--color-neon-blue)]" />
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Lucro realizado</p>
              </div>
              <p className="text-2xl font-black text-[var(--color-neon-blue)]">{formatCurrency(kpis.profitReal)}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Proporcional ao que já entrou no caixa (não conta fiado pendente)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Package2 className="w-4 h-4 text-amber-400" />
                <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Custo das vendas</p>
              </div>
              <p className="text-2xl font-black text-[var(--color-text-primary)]">{formatCurrency(kpis.cost)}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                Custo dos produtos vendidos (custo congelado na venda)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de rosca configurável */}
        <Card className="mb-6">
          <CardHeader className="pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[var(--color-neon-blue)]" />
              Composição — gráfico de rosca
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Seletor de métricas */}
            <div className="flex flex-wrap gap-2 mb-5">
              {DONUT_METRICS.map((m) => {
                const active = donutKeys.includes(m.key);
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => toggleDonutKey(m.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? "border-transparent text-[var(--color-bg-base)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]"
                    }`}
                    style={active ? { background: m.color } : undefined}
                  >
                    {active
                      ? <Check className="w-3 h-3" />
                      : <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />}
                    {m.label}
                  </button>
                );
              })}
            </div>

            {loading
              ? <div className="skeleton h-56 rounded-xl" />
              : <DonutChart data={donutSlices} centerLabel="Total selecionado" />}
          </CardContent>
        </Card>

        {/* Fluxo de caixa */}
        <Card className="mb-6">
          <CardHeader className="pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[var(--color-neon-blue)]" />
              Fluxo de Caixa — entradas no período
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-4">
              <span className="text-2xl font-black text-[var(--color-neon-blue)]">{formatCurrency(cashTotal)}</span>
              <span className="text-xs text-[var(--color-text-muted)]">recebido de fato no período (por data do pagamento)</span>
            </div>
            <RevenueChart data={cashChart} loading={loading} />

            {/* Quebra por forma de pagamento */}
            {cashByMethod.size > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {Array.from(cashByMethod.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([method, amount]) => (
                    <div key={method} className="rounded-lg bg-[var(--color-bg-overlay)] p-3">
                      <p className="text-sm font-bold text-[var(--color-text-primary)]">{formatCurrency(amount)}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{PAYMENT_LABELS[method] ?? method}</p>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-[11px] text-[var(--color-text-muted)]">
          O lucro usa o custo congelado em cada venda. Vendas registradas antes desta atualização não têm custo
          gravado — nesses casos é usado o custo atual do produto como estimativa (0 se o produto não existir mais).
        </p>
      </div>
    </div>
  );
}
