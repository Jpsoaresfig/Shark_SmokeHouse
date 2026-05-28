"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, ShoppingBag, Users, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle, Truck, LayoutDashboard, CalendarDays, Receipt,
  BarChart3, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import { getOrders } from "@/lib/firebase/orders";
import { getAllUsers } from "@/lib/firebase/users";
import { getProducts } from "@/lib/firebase/products";
import { getSales } from "@/lib/firebase/sales";
import { toast } from "@/stores/toastStore";
import { RevenueChart, type ChartPoint } from "@/components/admin/RevenueChart";
import type { Order, Product, Sale } from "@/types";

const MONTH_NAMES_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
const MONTH_NAMES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(0);
}

function timeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

const statusConfig = {
  received: { label: "Recebido", variant: "secondary" as const, icon: Clock },
  analyzing: { label: "Em Análise", variant: "warning" as const, icon: Clock },
  approved: { label: "Aprovado", variant: "default" as const, icon: CheckCircle },
  preparing: { label: "Preparando", variant: "purple" as const, icon: Package },
  out_for_delivery: { label: "Saiu p/ Entrega", variant: "orange" as const, icon: Truck },
  delivered: { label: "Entregue", variant: "success" as const, icon: CheckCircle },
  cancelled: { label: "Cancelado", variant: "destructive" as const, icon: AlertTriangle },
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [revenueOpen, setRevenueOpen] = useState(false);
  const [chartRange, setChartRange] = useState<"daily" | "monthly">("daily");
  const [dashStats, setDashStats] = useState({
    monthRevenue: 0,
    prevMonthRevenue: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    totalCustomers: 0,
    criticalStock: 0,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
        // Dashboard only needs recent data — limit to avoid fetching entire collections
        const [orders, sales, users, products] = await Promise.all([
          getOrders(200),    // last 200 orders covers months of stats
          getSales(),        // all PDV sales for revenue calculation
          getAllUsers(500),   // last 500 users enough for customer count
          getProducts(),     // all products needed for low-stock calculation
        ]);


        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
        const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        let monthRevenue = 0;
        let prevMonthRevenue = 0;
        let todayOrders = 0;
        let yesterdayOrders = 0;

        // Online orders (excluindo cancelados — não geraram receita)
        for (const order of orders) {
          if (order.status === "cancelled") continue;
          const d = toDate(order.createdAt);
          const m = d.getMonth();
          const y = d.getFullYear();
          if (m === thisMonth && y === thisYear) {
            monthRevenue += order.total ?? 0;
            if (d >= todayStart) todayOrders++;
            else if (d >= yesterdayStart) yesterdayOrders++;
          } else if (m === prevMonth && y === prevYear) {
            prevMonthRevenue += order.total ?? 0;
          }
        }

        // PDV sales — todas as vendas presenciais
        for (const sale of sales) {
          const d = toDate(sale.createdAt);
          const m = d.getMonth();
          const y = d.getFullYear();
          if (m === thisMonth && y === thisYear) {
            monthRevenue += sale.total ?? 0;
            if (d >= todayStart) todayOrders++;
            else if (d >= yesterdayStart) yesterdayOrders++;
          } else if (m === prevMonth && y === prevYear) {
            prevMonthRevenue += sale.total ?? 0;
          }
        }

        const customers = users.filter(u => u.role === "customer");

        const critical = products
          .filter(p => p.active !== false && p.stock <= p.minStock)
          .sort((a, b) => (a.stock / (a.minStock || 1)) - (b.stock / (b.minStock || 1)));

        setDashStats({
          monthRevenue,
          prevMonthRevenue,
          todayOrders,
          yesterdayOrders,
          totalCustomers: customers.length,
          criticalStock: critical.length,
        });
        setAllOrders(orders);
        setAllSales(sales);
        setRecentOrders(orders.slice(0, 5));
        setLowStockItems(critical.slice(0, 5));
      } catch (err) {
        console.error("[dashboard load]", err);
        toast.error("Não foi possível carregar os dados do dashboard.");
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ── Chart data — daily (last 30 days) or monthly (last 12 months) ── */
  const dailyChart: ChartPoint[] = useMemo(() => {
    const days = 30;
    const buckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, 0);
    }
    const addToDay = (createdAt: unknown, amount: number) => {
      const d = toDate(createdAt);
      d.setHours(0, 0, 0, 0);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
    };
    for (const order of allOrders) {
      if (order.status === "cancelled") continue;
      addToDay(order.createdAt, order.total ?? 0);
    }
    for (const sale of allSales) {
      addToDay(sale.createdAt, sale.total ?? 0);
    }
    return Array.from(buckets.entries()).map(([key, value]) => {
      const [y, m, d] = key.split("-").map(Number);
      return {
        label: `${String(d).padStart(2, "0")}/${String(m + 1).padStart(2, "0")}`,
        fullLabel: `${d} de ${MONTH_NAMES_FULL[m]}, ${y}`,
        value,
        sortKey: new Date(y, m, d).getTime(),
      };
    }).sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey, ...rest }) => { void sortKey; return rest; });
  }, [allOrders, allSales]);

  const monthlyChart: ChartPoint[] = useMemo(() => {
    const months = 12;
    const buckets = new Map<string, number>();
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0);
    }
    const addToMonth = (createdAt: unknown, amount: number) => {
      const d = toDate(createdAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + amount);
    };
    for (const order of allOrders) {
      if (order.status === "cancelled") continue;
      addToMonth(order.createdAt, order.total ?? 0);
    }
    for (const sale of allSales) {
      addToMonth(sale.createdAt, sale.total ?? 0);
    }
    return Array.from(buckets.entries()).map(([key, value]) => {
      const [y, m] = key.split("-").map(Number);
      return {
        label: `${MONTH_NAMES_SHORT[m]}/${String(y).slice(-2)}`,
        fullLabel: `${MONTH_NAMES_FULL[m]} de ${y}`,
        value,
        sortKey: new Date(y, m, 1).getTime(),
      };
    }).sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey, ...rest }) => { void sortKey; return rest; });
  }, [allOrders, allSales]);

  const revenueChange =
    dashStats.prevMonthRevenue > 0
      ? Math.round(((dashStats.monthRevenue - dashStats.prevMonthRevenue) / dashStats.prevMonthRevenue) * 1000) / 10
      : null;

  const ordersChange =
    dashStats.yesterdayOrders > 0
      ? Math.round(((dashStats.todayOrders - dashStats.yesterdayOrders) / dashStats.yesterdayOrders) * 1000) / 10
      : null;

  const stats = [
    {
      title: "Receita do Mês",
      value: formatCurrency(dashStats.monthRevenue),
      change: revenueChange,
      icon: TrendingUp,
      color: "text-[var(--color-neon-blue)]",
      bg: "bg-[var(--color-neon-blue-glow)]",
      border: "border-[var(--color-neon-blue)]/20",
      onClick: () => setRevenueOpen(true),
      clickHint: "Ver gráfico",
    },
    {
      title: "Pedidos Hoje",
      value: String(dashStats.todayOrders),
      change: ordersChange,
      icon: ShoppingBag,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
    },
    {
      title: "Clientes Ativos",
      value: dashStats.totalCustomers.toLocaleString("pt-BR"),
      change: null,
      icon: Users,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      title: "Estoque Crítico",
      value: String(dashStats.criticalStock),
      change: null,
      icon: Package,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      isAlert: dashStats.criticalStock > 0,
    },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Dashboard</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => load()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/50 transition-all disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
            <Badge variant="premium">Admin Master</Badge>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const isPositive = (stat.change ?? 0) >= 0;
            const isClickable = !!stat.onClick;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  onClick={stat.onClick}
                  className={`relative transition-all ${
                    stat.isAlert ? "border-amber-500/30" : ""
                  } ${
                    isClickable
                      ? "cursor-pointer hover:border-[var(--color-neon-blue)]/60 hover:shadow-[var(--shadow-neon-sm)] active:scale-[0.99] group"
                      : ""
                  }`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center`}>
                        {loading ? (
                          <div className="w-5 h-5 rounded-full bg-[var(--color-bg-overlay)] animate-pulse" />
                        ) : (
                          <Icon className={`w-5 h-5 ${stat.color}`} />
                        )}
                      </div>
                      {stat.change !== null && (
                        <div className={`flex items-center gap-1 text-xs font-semibold ${isPositive ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}`}>
                          {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                          {Math.abs(stat.change)}%
                        </div>
                      )}
                    </div>
                    {loading ? (
                      <div className="h-8 w-24 rounded bg-[var(--color-bg-overlay)] animate-pulse mb-1" />
                    ) : (
                      <p className="text-2xl font-black text-[var(--color-text-primary)] mb-1">{stat.value}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-[var(--color-text-muted)]">{stat.title}</p>
                      {isClickable && !loading && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--color-neon-blue)] opacity-70 group-hover:opacity-100 transition-opacity">
                          <BarChart3 className="w-3 h-3" />
                          {stat.clickHint}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Content grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent orders */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex-row items-center justify-between pb-0">
                <CardTitle className="text-base">Pedidos Recentes</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/admin/orders">Ver todos</a>
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-10 rounded bg-[var(--color-bg-overlay)] animate-pulse" />
                    ))}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">Nenhum pedido ainda.</p>
                ) : (
                  <div className="space-y-1">
                    {recentOrders.map((order, i) => {
                      const cfg = statusConfig[order.status as keyof typeof statusConfig] ?? statusConfig.received;
                      const StatusIcon = cfg.icon;
                      return (
                        <div key={order.id}>
                          <div className="flex items-center gap-3 py-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center shrink-0">
                              <ShoppingBag className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">#{order.id.slice(-4).toUpperCase()}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">—</span>
                                <span className="text-sm text-[var(--color-text-secondary)] truncate">{order.customerName}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(toDate(order.createdAt))}</p>
                                <Badge variant={cfg.variant} className="text-xs sm:hidden">
                                  <StatusIcon className="w-3 h-3" />
                                  {cfg.label}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                              <Badge variant={cfg.variant} className="text-xs hidden sm:flex">
                                <StatusIcon className="w-3 h-3" />
                                {cfg.label}
                              </Badge>
                              <span className="text-sm font-semibold text-[var(--color-neon-blue)] whitespace-nowrap">
                                {formatCurrency(order.total)}
                              </span>
                            </div>
                          </div>
                          {i < recentOrders.length - 1 && <Separator />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Low stock */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-amber-500/20">
              <CardHeader className="flex-row items-center justify-between pb-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Estoque Crítico
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <a href="/admin/inventory">Gerenciar</a>
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                {loading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-8 rounded bg-[var(--color-bg-overlay)] animate-pulse" />
                    ))}
                  </div>
                ) : lowStockItems.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">Estoque em dia!</p>
                ) : (
                  <div className="space-y-3">
                    {lowStockItems.map((item, i) => {
                      const pct = Math.round((item.stock / (item.minStock || 1)) * 100);
                      return (
                        <div key={item.id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-medium text-[var(--color-text-secondary)] truncate max-w-[160px]">
                              {item.name}
                            </p>
                            <span className="text-xs font-bold text-amber-400">{item.stock} un.</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--color-bg-overlay)]">
                            <div
                              className="h-full rounded-full bg-amber-400/70 transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          {i < lowStockItems.length - 1 && <div className="mt-3" />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
        >
          {[
            { label: "Produtos", href: "/admin/products", icon: Package, color: "text-[var(--color-neon-blue)]", bg: "bg-[var(--color-neon-blue-glow)]" },
            { label: "Pedidos", href: "/admin/orders", icon: ShoppingBag, color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "Usuários", href: "/admin/users", icon: Users, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Estoque", href: "/admin/inventory", icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Vendas", href: "/admin/sales", icon: Receipt, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Seções", href: "/admin/sections", icon: LayoutDashboard, color: "text-pink-400", bg: "bg-pink-500/10" },
            { label: "Agenda Lounge", href: "/admin/lounge", icon: CalendarDays, color: "text-[var(--color-neon-cyan)]", bg: "bg-[var(--color-neon-cyan)]/10" },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.label}
                href={action.href}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 flex flex-col items-center gap-3 hover:border-[var(--color-neon-blue)] transition-all duration-200 text-center"
              >
                <div className={`w-10 h-10 rounded-xl ${action.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <Icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <span className="text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                  {action.label}
                </span>
              </a>
            );
          })}
        </motion.div>
      </div>

      {/* ── Revenue chart dialog ── */}
      <Dialog open={revenueOpen} onOpenChange={setRevenueOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[var(--color-neon-blue)]" />
              Evolução da Receita
            </DialogTitle>
            <DialogDescription>
              {chartRange === "daily"
                ? "Receita diária dos últimos 30 dias — pedidos online + vendas PDV (exclui pedidos cancelados)."
                : "Receita mensal dos últimos 12 meses — pedidos online + vendas PDV (exclui pedidos cancelados)."}
            </DialogDescription>
          </DialogHeader>

          {/* Range tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-overlay)] border border-[var(--color-border)] w-fit mt-1">
            <button
              onClick={() => setChartRange("daily")}
              className={`px-4 h-9 rounded-lg text-xs font-semibold transition-all ${
                chartRange === "daily"
                  ? "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              30 dias
            </button>
            <button
              onClick={() => setChartRange("monthly")}
              className={`px-4 h-9 rounded-lg text-xs font-semibold transition-all ${
                chartRange === "monthly"
                  ? "bg-[var(--color-neon-blue)] text-[var(--color-bg-base)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              12 meses
            </button>
          </div>

          <div className="mt-4">
            <RevenueChart
              data={chartRange === "daily" ? dailyChart : monthlyChart}
              loading={loading}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
