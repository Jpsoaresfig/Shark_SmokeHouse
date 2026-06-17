"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Receipt, TrendingUp, Percent, ShoppingCart, RefreshCw, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AdminTopNav } from "@/components/admin/AdminTopNav";
import { getSales, SALE_PAYMENT_LABELS as PAYMENT_LABELS } from "@/lib/firebase/sales";
import { formatCurrency, toDate } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import type { Sale } from "@/types";

export default function SellerDashboard() {
  const { user } = useAuthStore();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const rate = user?.commissionRate; // % ou undefined
  const hasCommission = rate != null && rate > 0;

  const load = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const all = await getSales();
      setSales(all.filter((s) => s.sellerId === user.uid));
    } catch {
      toast.error("Não foi possível carregar suas vendas.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  /* ── Resumo: mês atual e total ── */
  const stats = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    // `*Total` = total cobrado (com frete/taxa) para exibição; `*Base` = só produtos,
    // que é a base da comissão. Vendas antigas (sem subtotal) tinham total = produtos.
    let monthCount = 0, monthTotal = 0, allTotal = 0, monthBase = 0, allBase = 0;
    for (const s of sales) {
      const base = Math.max(0, (s.subtotal ?? s.total ?? 0) - (s.discount ?? 0));
      allTotal += s.total ?? 0;
      allBase += base;
      const d = toDate(s.createdAt);
      if (d.getMonth() === m && d.getFullYear() === y) {
        monthCount++;
        monthTotal += s.total ?? 0;
        monthBase += base;
      }
    }
    const commission = (v: number) => (hasCommission ? v * (rate! / 100) : 0);
    return {
      monthCount,
      monthTotal,
      monthCommission: commission(monthBase),
      allCount: sales.length,
      allTotal,
      allCommission: commission(allBase),
    };
  }, [sales, hasCommission, rate]);

  const recent = useMemo(
    () => [...sales].sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime()).slice(0, 8),
    [sales],
  );

  const statCards = [
    { title: "Vendido no mês", value: formatCurrency(stats.monthTotal), icon: TrendingUp, color: "text-[var(--color-neon-blue)]", bg: "bg-[var(--color-neon-blue-glow)]" },
    { title: "Comissão no mês", value: hasCommission ? formatCurrency(stats.monthCommission) : "—", icon: Percent, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { title: "Vendido total", value: formatCurrency(stats.allTotal), icon: Receipt, color: "text-purple-400", bg: "bg-purple-500/10" },
    { title: "Comissão total", value: hasCommission ? formatCurrency(stats.allCommission) : "—", icon: Percent, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Meu Painel</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">
              {user?.displayName ?? "Vendedor"}
              {hasCommission
                ? <> · comissão de <span className="text-[var(--color-neon-blue)] font-semibold">{rate}%</span> sobre as vendas</>
                : <> · sem comissão configurada</>}
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
            <Button variant="premium" size="sm" asChild>
              <Link href="/admin/sales">
                <ShoppingCart className="w-4 h-4" /> Nova Venda
              </Link>
            </Button>
          </div>
        </div>

        {/* Navegação — apenas desktop; no mobile usa a barra inferior */}
        <div className="mb-8 hidden md:block">
          <AdminTopNav />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-4">
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Card>
                  <CardContent className="p-5">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center mb-4`}>
                      {loading
                        ? <div className="w-5 h-5 rounded-full bg-[var(--color-bg-overlay)] animate-pulse" />
                        : <Icon className={`w-5 h-5 ${stat.color}`} />}
                    </div>
                    {loading
                      ? <div className="h-7 w-24 rounded bg-[var(--color-bg-overlay)] animate-pulse mb-1" />
                      : <p className="text-xl sm:text-2xl font-black text-[var(--color-text-primary)] mb-1">{stat.value}</p>}
                    <p className="text-xs text-[var(--color-text-muted)]">{stat.title}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-[var(--color-text-muted)] mb-8">
          {stats.monthCount} venda{stats.monthCount !== 1 ? "s" : ""} este mês · {stats.allCount} no total
          {!hasCommission && " · defina uma comissão com o administrador para acompanhar seus ganhos"}
        </p>

        {/* Vendas recentes */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-0">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" /> Minhas Vendas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded bg-[var(--color-bg-overlay)] animate-pulse" />)}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <Receipt className="w-8 h-8 text-[var(--color-text-muted)]" />
                <p className="text-sm text-[var(--color-text-muted)]">Você ainda não registrou vendas.</p>
                <Button variant="secondary" size="sm" asChild className="mt-1">
                  <Link href="/admin/sales">Registrar primeira venda</Link>
                </Button>
              </div>
            ) : (
              recent.map((sale, i) => {
                const d = toDate(sale.createdAt);
                return (
                  <div key={sale.id}>
                    <div className="flex items-center gap-4 py-3">
                      <div className="text-center shrink-0 w-12">
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">
                          {d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                          #{sale.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {sale.items.length} {sale.items.length === 1 ? "item" : "itens"} · {PAYMENT_LABELS[sale.paymentMethod]}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-[var(--color-neon-blue)] block">{formatCurrency(sale.total)}</span>
                        {hasCommission && (
                          <Badge variant="success" className="text-[10px] mt-0.5">
                            +{formatCurrency(Math.max(0, (sale.subtotal ?? sale.total) - (sale.discount ?? 0)) * (rate! / 100))}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {i < recent.length - 1 && <Separator />}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
