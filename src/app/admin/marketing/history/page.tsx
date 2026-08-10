"use client";

import { useMemo, useState } from "react";
import { History, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MarketingNav } from "@/components/admin/marketing/MarketingNav";
import { useMarketingData } from "@/components/admin/marketing/useMarketingData";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Shield } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { summarizeExecutions } from "@/lib/marketing/analytics";
import { AUTOMATION_EVENT_LABELS } from "@/lib/marketing/priorities";
import { formatDateTime } from "@/lib/utils";
import type { MarketingExecution } from "@/types/marketing";

const PAGE_SIZE = 20;

type PeriodFilter = "all" | "today" | "last7" | "last30";
const PERIODS: { value: PeriodFilter; label: string; days: number | null }[] = [
  { value: "all", label: "Todo o período", days: null },
  { value: "today", label: "Hoje", days: 1 },
  { value: "last7", label: "Últimos 7 dias", days: 7 },
  { value: "last30", label: "Últimos 30 dias", days: 30 },
];

function statusVariant(status: MarketingExecution["status"]): "default" | "secondary" | "success" | "destructive" | "warning" {
  switch (status) {
    case "processed": return "success";
    case "pending": return "warning";
    case "skipped_spam": return "secondary";
    case "cancelled": return "secondary";
    default: return "destructive";
  }
}

function statusLabel(status: MarketingExecution["status"]): string {
  switch (status) {
    case "processed": return "Enviada";
    case "pending": return "Pendente";
    case "failed": return "Falhou";
    case "cancelled": return "Cancelada";
    case "skipped_spam": return "Bloqueada (anti-spam)";
    case "error": return "Erro";
  }
}

export default function MarketingHistoryPage() {
  const { user } = useAuthStore();
  const { data, loading } = useMarketingData();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [campaignId, setCampaignId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [now] = useState(() => Date.now());

  const summary = useMemo(() => summarizeExecutions(data.executions), [data.executions]);

  const nameByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of data.contacts) map.set(c.uid, c.name);
    return map;
  }, [data.contacts]);
  const campaignName = useMemo(() => new Map(data.campaigns.map((c) => [c.id, c.name])), [data.campaigns]);
  const automationName = useMemo(() => new Map(data.automations.map((a) => [a.id, a.name])), [data.automations]);

  const filtered = useMemo(() => {
    const cutoff = period === "all" ? null : now - (PERIODS.find((p) => p.value === period)?.days ?? 0) * 86400000;
    const q = search.trim().toLowerCase();
    return data.executions.filter((e) => {
      if (cutoff != null && new Date(e.createdAt).getTime() < cutoff) return false;
      if (campaignId !== "all") {
        if (campaignId.startsWith("auto:")) {
          if (e.automationId !== campaignId.slice(5)) return false;
        } else if (e.campaignId !== campaignId) return false;
      }
      if (status !== "all" && e.status !== status) return false;
      if (q) {
        const name = nameByUid.get(e.userId) ?? "";
        const id = `${e.id} ${e.couponCode ?? ""} ${e.title}`.toLowerCase();
        if (!`${name} ${id}`.includes(q)) return false;
      }
      return true;
    });
  }, [data.executions, period, campaignId, status, search, nameByUid, now]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const sourceLabel = (e: MarketingExecution): { label: string; kind: "campaign" | "automation" } => {
    if (e.automationId) {
      return { label: automationName.get(e.automationId) ?? (e.automationEvent ? AUTOMATION_EVENT_LABELS[e.automationEvent] ?? e.automationEvent : "Automação"), kind: "automation" };
    }
    if (e.campaignId) return { label: campaignName.get(e.campaignId) ?? "Campanha", kind: "campaign" };
    return { label: "Manual", kind: "campaign" };
  };

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
      <div className="max-w-6xl mx-auto">
        <AdminPageHeader
          title="Histórico de envios"
          subtitle="Execuções de campanhas e automações"
        />

        <MarketingNav />

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Total</p>
            <p className="text-xl font-black text-[var(--color-text-primary)] mt-1">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Enviadas</p>
            <p className="text-xl font-black text-[var(--color-success)] mt-1">{summary.processed}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Bloqueadas (anti-spam)</p>
            <p className="text-xl font-black text-[var(--color-warning)] mt-1">{summary.skipped}</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Erros</p>
            <p className="text-xl font-black text-[var(--color-error)] mt-1">{summary.errored}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-3 mb-4">
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map((p) => (
              <button key={p.value} onClick={() => { setPeriod(p.value); setPage(0); }}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-all ${
                  period === p.value
                    ? "border-[var(--color-neon-blue)] bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                    : "border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setPage(0); }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">Todas as campanhas/automações</option>
              {data.campaigns.map((c) => <option key={c.id} value={c.id}>Campanha: {c.name}</option>)}
              {data.automations.map((a) => <option key={a.id} value={`auto:${a.id}`}>Automação: {a.name}</option>)}
            </select>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">Todos os status</option>
              {["processed", "pending", "skipped_spam", "cancelled", "failed", "error"].map((s) => (
                <option key={s} value={s}>{statusLabel(s as MarketingExecution["status"])}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mb-6">
          <Input icon={<Search className="w-4 h-4" />} placeholder="Buscar por cliente, cupom ou mensagem…"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <History className="w-10 h-10 text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-secondary)]">Nenhuma execução encontrada com esses filtros.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visible.map((e) => {
                const source = sourceLabel(e);
                return (
                  <Card key={e.id}>
                    <CardContent className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--color-text-primary)]">
                            {nameByUid.get(e.userId) ?? e.userId}
                          </span>
                          <Badge variant={source.kind === "automation" ? "purple" : "default"}>{source.label}</Badge>
                          <Badge variant={statusVariant(e.status)}>{statusLabel(e.status)}</Badge>
                        </div>
                        <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{e.message}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 flex flex-wrap gap-x-3">
                          <span>{formatDateTime(e.createdAt)}</span>
                          {e.couponCode && <span>Cupom: <code className="font-mono text-[var(--color-neon-blue)]">{e.couponCode}</code></span>}
                          {e.reason && <span className="text-[var(--color-warning)]">· {e.reason}</span>}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] disabled:opacity-40 transition-all">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-[var(--color-text-muted)]">{filtered.length} registro(s) · página {page + 1}/{pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1}
                  className="p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] disabled:opacity-40 transition-all">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
