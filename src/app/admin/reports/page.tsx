"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquareWarning, CheckCircle, RotateCcw, Trash2, User, ExternalLink, RefreshCw,
  ChevronDown, Globe, Monitor, Smartphone, Languages, Clock, Wifi, WifiOff, CornerDownRight, Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getReports, updateReportStatus, deleteReport } from "@/lib/firebase/reports";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import { REPORT_CATEGORIES, REPORT_CATEGORY_BY_VALUE } from "@/lib/reports-meta";
import type { Report, ReportStatus, ReportCategory } from "@/types";

const FILTERS: { value: ReportStatus | "all"; label: string }[] = [
  { value: "open",     label: "Abertos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "all",      label: "Todos" },
];

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [catFilter, setCatFilter] = useState<ReportCategory | "all">("all");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReports(await getReports());
    } catch {
      toast.error("Não foi possível carregar os reportes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCount = useMemo(() => reports.filter((r) => r.status === "open").length, [reports]);
  const filtered = useMemo(
    () =>
      reports
        .filter((r) => filter === "all" || r.status === filter)
        .filter((r) => catFilter === "all" || (r.category ?? "other") === catFilter),
    [reports, filter, catFilter]
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function copyDetails(r: Report) {
    const lines = [
      `Categoria: ${REPORT_CATEGORY_BY_VALUE[r.category ?? "other"].label}`,
      `Mensagem: ${r.message}`,
      `Página: ${r.context?.fullUrl ?? r.page}`,
      `Usuário: ${r.userName ? `${r.userName}${r.userEmail ? ` (${r.userEmail})` : ""}` : "Visitante"}`,
      `Quando: ${formatDateTime(r.createdAt)}`,
      r.context?.viewport && `Janela: ${r.context.viewport}`,
      r.context?.screen && `Tela: ${r.context.screen}`,
      r.context?.platform && `Plataforma: ${r.context.platform}`,
      r.context?.language && `Idioma: ${r.context.language}`,
      r.context?.timezone && `Fuso: ${r.context.timezone}`,
      r.context?.referrer && `Veio de: ${r.context.referrer}`,
      r.userAgent && `User-Agent: ${r.userAgent}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Detalhes copiados.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function setStatus(id: string, status: ReportStatus) {
    setActionId(id);
    try {
      await updateReportStatus(id, status);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
      toast.success(status === "resolved" ? "Marcado como resolvido." : "Reaberto.");
    } catch {
      toast.error("Erro ao atualizar o reporte.");
    } finally {
      setActionId(null);
    }
  }

  async function remove(id: string) {
    setActionId(id);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Reporte excluído.");
    } catch {
      toast.error("Erro ao excluir o reporte.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader
          title="Reportes"
          subtitle={loading ? "Carregando..." : `${reports.length} reporte${reports.length !== 1 ? "s" : ""} · ${openCount} aberto${openCount !== 1 ? "s" : ""}`}
          action={
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-3 h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          }
        />

        {/* Filtros por status */}
        <div className="flex gap-2 mb-3">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.value
                  ? "bg-[var(--color-neon-blue)] text-white"
                  : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filtros por categoria */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCatFilter("all")}
            className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all ${
              catFilter === "all"
                ? "bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] border border-[var(--color-neon-blue)]/40"
                : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            Todas as categorias
          </button>
          {REPORT_CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = catFilter === c.value;
            const count = reports.filter((r) => (r.category ?? "other") === c.value).length;
            return (
              <button
                key={c.value}
                onClick={() => setCatFilter(c.value)}
                className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? "bg-[var(--color-bg-overlay)] text-[var(--color-text-primary)] border border-[var(--color-neon-blue)]/40"
                    : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {c.label}
                <span className="opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]">Carregando reportes...</p>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <MessageSquareWarning className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--color-text-secondary)]">
                {filter === "open" ? "Nenhum reporte aberto. Tudo certo! 🎉" : "Nenhum reporte aqui."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r, i) => {
              const cat = REPORT_CATEGORY_BY_VALUE[r.category ?? "other"];
              const CatIcon = cat.icon;
              const isOpen = expanded.has(r.id);
              const ctx = r.context;
              const techRows = [
                ctx?.fullUrl  && { icon: Globe,           label: "URL completa", value: ctx.fullUrl, mono: true },
                ctx?.viewport && { icon: Monitor,         label: "Janela",       value: ctx.viewport },
                ctx?.screen   && { icon: Monitor,         label: "Tela",         value: ctx.screen },
                ctx?.platform && { icon: Smartphone,      label: "Plataforma",   value: ctx.platform },
                ctx?.language && { icon: Languages,       label: "Idioma",       value: ctx.language },
                ctx?.timezone && { icon: Clock,           label: "Fuso horário", value: ctx.timezone },
                ctx?.referrer && { icon: CornerDownRight, label: "Veio de",      value: ctx.referrer, mono: true },
                r.userAgent   && { icon: Monitor,         label: "User-Agent",   value: r.userAgent, mono: true },
              ].filter(Boolean) as { icon: typeof Globe; label: string; value: string; mono?: boolean }[];
              const hasTech = techRows.length > 0 || ctx?.online !== undefined;

              return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={r.status === "open" ? "warning" : "success"}>
                          {r.status === "open" ? "Aberto" : "Resolvido"}
                        </Badge>
                        <Badge variant={cat.badge}>
                          <CatIcon className="w-3 h-3" /> {cat.label}
                        </Badge>
                        <a
                          href={r.context?.fullUrl ?? r.page}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-neon-blue)] hover:underline"
                        >
                          {r.page} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatDateTime(r.createdAt)}</span>
                    </div>

                    <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap mb-3">{r.message}</p>

                    <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {r.userName ? `${r.userName}${r.userEmail ? ` · ${r.userEmail}` : ""}` : "Visitante (não logado)"}
                      </span>
                      {ctx?.online !== undefined && (
                        <span className="inline-flex items-center gap-1">
                          {ctx.online ? <Wifi className="w-3 h-3 text-[var(--color-success)]" /> : <WifiOff className="w-3 h-3 text-[var(--color-error)]" />}
                          {ctx.online ? "Online" : "Offline"}
                        </span>
                      )}
                    </div>

                    {/* Detalhes técnicos — capturados automaticamente no envio. */}
                    {hasTech && (
                      <div className="mb-3">
                        <button
                          onClick={() => toggleExpanded(r.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                        >
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          Detalhes técnicos
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                                {techRows.map((row) => {
                                  const RowIcon = row.icon;
                                  return (
                                    <div key={row.label} className="flex items-start gap-2 min-w-0">
                                      <RowIcon className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{row.label}</p>
                                        <p className={`text-xs text-[var(--color-text-secondary)] break-all ${row.mono ? "font-mono" : ""}`}>{row.value}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => copyDetails(r)}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors"
                              >
                                <Copy className="w-3 h-3" /> Copiar detalhes
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {r.status === "open" ? (
                        <button
                          disabled={actionId === r.id}
                          onClick={() => setStatus(r.id, "resolved")}
                          className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-50"
                        >
                          <CheckCircle className="w-3 h-3" /> Marcar como resolvido
                        </button>
                      ) : (
                        <button
                          disabled={actionId === r.id}
                          onClick={() => setStatus(r.id, "open")}
                          className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 text-xs font-medium text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20 transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3 h-3" /> Reabrir
                        </button>
                      )}
                      <button
                        disabled={actionId === r.id}
                        onClick={() => remove(r.id)}
                        className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 text-xs font-medium text-[var(--color-error)] hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
