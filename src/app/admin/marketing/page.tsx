"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Users, UserPlus, Crown, Send, Ticket, Coins, TrendingUp, Shield, AlertTriangle,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarketingNav } from "@/components/admin/marketing/MarketingNav";
import { useMarketingData } from "@/components/admin/marketing/useMarketingData";
import { MarketingBars, MarketingLegend } from "@/components/admin/marketing/MarketingBars";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { getOrders } from "@/lib/firebase/orders";
import { computeDashboard } from "@/lib/marketing/analytics";
import { rangeForPreset, BI_PRESET_LABELS, type BiPeriodPreset } from "@/lib/bi/periods";
import { formatCurrency } from "@/lib/utils";
import type { Order } from "@/types";

const PERIODS: Exclude<BiPeriodPreset, "custom">[] = ["today", "last7", "last30", "thisMonth"];

function Kpi({ icon: Icon, label, value, hint, accent }: {
  icon: React.ElementType; label: string; value: string; hint?: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
        <Icon className={`w-4 h-4 ${accent}`} />
      </div>
      <p className="text-xl font-black text-[var(--color-text-primary)] mt-1.5">{value}</p>
      {hint && <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

export default function MarketingDashboardPage() {
  const { user } = useAuthStore();
  const { data, loading } = useMarketingData();
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<Exclude<BiPeriodPreset, "custom">>("last30");

  useEffect(() => {
    getOrders().then(setOrders).catch(() => undefined);
  }, []);

  const range = useMemo(() => rangeForPreset(period), [period]);

  const analytics = useMemo(
    () => computeDashboard({
      contacts: data.contacts,
      campaigns: data.campaigns,
      executions: data.executions,
      coupons: data.coupons,
      redemptions: data.redemptions,
      orders,
      settings: data.settings,
      range,
    }),
    [data, orders, range],
  );

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen pt-24 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-[var(--color-error)] mx-auto mb-3" />
          <p className="text-[var(--color-text-primary)] font-semibold">Acesso restrito</p>
          <p className="text-sm text-[var(--color-text-muted)]">Apenas o admin acessa o Marketing/CRM.</p>
        </div>
      </div>
    );
  }

  const k = analytics.kpis;

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader
          title="Marketing"
          subtitle="Segmentação, campanhas, automações e cupons de CRM."
        />

        <MarketingNav />

        {/* Period selector */}
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all border ${
                period === p
                  ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                  : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {BI_PRESET_LABELS[p]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
            <div className="skeleton h-72 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi icon={Users} label="Clientes" value={String(k.totalClients)}
                hint={`${k.active} ativos · ${k.atRisk} em risco`} accent="text-[var(--color-neon-blue)]" />
              <Kpi icon={UserPlus} label="Novos no período" value={String(k.newClients)}
                hint="cadastros" accent="text-emerald-400" />
              <Kpi icon={Crown} label="VIP" value={String(k.vip)}
                hint={`≥ ${formatCurrency(data.settings.bigSpenderThreshold)}`} accent="text-amber-400" />
              <Kpi icon={Send} label="Envios" value={String(k.messagesSent)}
                hint={`${k.campaignMessages} campanha · ${k.automationMessages} automação`} accent="text-purple-400" />
              <Kpi icon={Ticket} label="Cupons" value={`${k.couponsCreated} criados`}
                hint={`${k.couponsUsed} usados no período`} accent="text-pink-400" />
              <Kpi icon={Coins} label="Receita de campanhas" value={formatCurrency(k.revenue)}
                hint={`${k.recoveryUsers} clientes voltaram`} accent="text-[var(--color-success)]" />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Envios por dia</CardTitle>
                  <CardDescription>Execuções processadas no período (campanhas + automações).</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarketingBars
                    labels={analytics.enviosByType.map((p) => p.label)}
                    series={[
                      { name: "Campanhas", color: "var(--color-neon-blue)", values: analytics.enviosByType.map((p) => p.campaign) },
                      { name: "Automações", color: "var(--color-success)", values: analytics.enviosByType.map((p) => p.automation) },
                    ]}
                  />
                  <div className="mt-3">
                    <MarketingLegend
                      series={[
                        { name: "Campanhas", color: "var(--color-neon-blue)", values: analytics.enviosByType.map((p) => p.campaign) },
                        { name: "Automações", color: "var(--color-success)", values: analytics.enviosByType.map((p) => p.automation) },
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Receita de campanhas</CardTitle>
                  <CardDescription>Valor dos pedidos que usaram cupom de marketing no período.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarketingBars
                    labels={analytics.receita.map((p) => p.label)}
                    series={[{ name: "Receita", color: "var(--color-warning)", values: analytics.receita.map((p) => p.value) }]}
                    formatter={formatCurrency}
                    emptyText="Nenhum cupom de marketing foi usado no período."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Cupons usados por dia</CardTitle>
                  <CardDescription>Resgates de cupons de marketing no período.</CardDescription>
                </CardHeader>
                <CardContent>
                  <MarketingBars
                    labels={analytics.cupons.map((p) => p.label)}
                    series={[{ name: "Usos", color: "var(--color-neon-cyan)", values: analytics.cupons.map((p) => p.value) }]}
                    emptyText="Nenhum uso de cupom no período."
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Composição da base</CardTitle>
                  <CardDescription>Distribuição dos clientes por recência de compra.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analytics.composition.map((c) => {
                      const pct = k.totalClients > 0 ? Math.round((c.count / k.totalClients) * 1000) / 10 : 0;
                      return (
                        <div key={c.label}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-[var(--color-text-secondary)]">{c.label}</span>
                            <span className="font-semibold text-[var(--color-text-primary)]">
                              {c.count} <span className="text-[var(--color-text-muted)] font-normal">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[var(--color-bg-overlay)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${Math.min(pct, 100)}%`, background: c.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {k.neverBought > 0 && (
                    <div className="flex items-center gap-2 mt-4 rounded-lg border border-[var(--color-warning)]/30 bg-amber-500/10 px-3 py-2.5 text-xs text-[var(--color-warning)]">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{k.neverBought} clientes nunca compraram — candidate para a automação de boas-vindas/promoção.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Conversion banner */}
            <Card glow>
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--color-neon-blue)]/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-[var(--color-neon-blue)]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      Taxa de conversão: <span className="text-[var(--color-neon-blue)]">{k.conversionRate}%</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {k.recoveryUsers} cliente(s) que receberam mensagem de marketing voltaram e usaram o cupom no período.
                    </p>
                  </div>
                </div>
                <Badge variant="premium">Anti-spam ativo: máx. {data.settings.maxPerDay}/janela de {data.settings.windowHours}h</Badge>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
