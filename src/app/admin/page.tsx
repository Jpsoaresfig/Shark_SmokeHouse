"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, ShoppingBag, Users, Package, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Clock, CheckCircle, Truck, LayoutDashboard, CalendarDays, Receipt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { getOrders } from "@/lib/firebase/orders";
import { getAllUsers } from "@/lib/firebase/users";
import { getProducts } from "@/lib/firebase/products";
import { toast } from "@/stores/toastStore";
import type { Order, Product } from "@/types";

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
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [dashStats, setDashStats] = useState({
    monthRevenue: 0,
    prevMonthRevenue: 0,
    todayOrders: 0,
    yesterdayOrders: 0,
    totalCustomers: 0,
    criticalStock: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const [orders, users, products] = await Promise.all([
          getOrders(),
          getAllUsers(),
          getProducts(),
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
        setRecentOrders(orders.slice(0, 5));
        setLowStockItems(critical.slice(0, 5));
      } catch {
        toast.error("Não foi possível carregar os dados do dashboard.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black text-[var(--color-text-primary)]">Dashboard</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Badge variant="premium">Admin Master</Badge>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            const isPositive = (stat.change ?? 0) >= 0;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className={stat.isAlert ? "border-amber-500/30" : ""}>
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
                    <p className="text-xs text-[var(--color-text-muted)]">{stat.title}</p>
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
                            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-overlay)] flex items-center justify-center">
                              <ShoppingBag className="w-4 h-4 text-[var(--color-text-muted)]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-[var(--color-text-primary)]">#{order.id.slice(-4).toUpperCase()}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">—</span>
                                <span className="text-sm text-[var(--color-text-secondary)] truncate">{order.customerName}</span>
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)]">{timeAgo(toDate(order.createdAt))}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={cfg.variant} className="text-xs">
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
    </div>
  );
}
