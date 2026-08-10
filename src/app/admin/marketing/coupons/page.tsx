"use client";

import { useMemo, useState } from "react";
import { Ticket, Shield, ExternalLink } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarketingNav } from "@/components/admin/marketing/MarketingNav";
import { useMarketingData } from "@/components/admin/marketing/useMarketingData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { isMarketingCoupon } from "@/lib/marketing/analytics";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function MarketingCouponsPage() {
  const { user } = useAuthStore();
  const { data, loading } = useMarketingData();
  const [onlyActive, setOnlyActive] = useState(true);
  const [search, setSearch] = useState("");

  const campaignName = useMemo(() => new Map(data.campaigns.map((c) => [c.id, c.name])), [data.campaigns]);
  const automationName = useMemo(() => new Map(data.automations.map((a) => [a.id, a.name])), [data.automations]);

  const redemptionsByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of data.redemptions) {
      const key = (r.couponId || r.code).toUpperCase();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [data.redemptions]);

  const coupons = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.coupons
      .filter(isMarketingCoupon)
      .filter((c) => (onlyActive ? c.active : true))
      .filter((c) => (q ? c.code.toLowerCase().includes(q) : true))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, [data.coupons, onlyActive, search]);

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

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader
          title="Cupons de marketing"
          subtitle="Códigos gerados por campanhas e automações"
          action={
            <Button variant="secondary" onClick={() => { window.location.href = "/admin/coupons"; }}>
              <ExternalLink className="w-4 h-4" /> Gestão completa
            </Button>
          }
        />

        <MarketingNav />

        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar código…"
            className="w-full sm:w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
          />
          <label className="flex items-center gap-2 cursor-pointer shrink-0">
            <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-neon-blue)]" />
            <span className="text-sm text-[var(--color-text-secondary)]">Somente ativos</span>
          </label>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Ticket className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhum cupom de marketing encontrado.</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Os cupons aparecem aqui quando uma campanha ou automação os gera no envio.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((c) => {
              const uses = redemptionsByCode.get(c.code.toUpperCase()) ?? 0;
              const source = c.marketingCampaignId
                ? { kind: "Campanha", name: campaignName.get(c.marketingCampaignId) }
                : c.marketingAutomationId
                  ? { kind: "Automação", name: automationName.get(c.marketingAutomationId) }
                  : { kind: "Manual", name: undefined };
              return (
                <Card key={c.id}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="font-mono font-bold text-[var(--color-neon-blue)]">{c.code}</code>
                        <Badge variant={c.active ? "success" : "destructive"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                        <Badge variant={source.kind === "Automação" ? "purple" : "default"}>{source.kind}</Badge>
                        {source.name && <Badge variant="secondary">{source.name}</Badge>}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{c.type === "percent" ? `${c.value}%` : formatCurrency(c.value)}
                          {c.minOrder != null ? ` · mín. ${formatCurrency(c.minOrder)}` : ""}</span>
                        <span>· Validade: {c.expiresAt ? formatDate(c.expiresAt) : "sem validade"}</span>
                        <span>· Limite/CPF: {c.usageLimitPerCpf != null ? c.usageLimitPerCpf : "ilimitado"}</span>
                        <span>· Criado: {formatDate(c.createdAt)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)]">{uses} uso(s)</span>
                      <Badge variant="premium">{formatCurrency(c.value)}</Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
