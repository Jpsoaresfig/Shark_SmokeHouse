"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { MessageSquareWarning, CheckCircle, RotateCcw, Trash2, User, ExternalLink, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getReports, updateReportStatus, deleteReport } from "@/lib/firebase/reports";
import { formatDateTime } from "@/lib/utils";
import { toast } from "@/stores/toastStore";
import type { Report, ReportStatus } from "@/types";

const FILTERS: { value: ReportStatus | "all"; label: string }[] = [
  { value: "open",     label: "Abertos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "all",      label: "Todos" },
];

export default function AdminReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReportStatus | "all">("open");
  const [actionId, setActionId] = useState<string | null>(null);

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
  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

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

        {/* Filtros */}
        <div className="flex gap-2 mb-6">
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
            {filtered.map((r, i) => (
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
                        <a
                          href={r.page}
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
                      {r.userAgent && <span className="truncate max-w-[240px]" title={r.userAgent}>{r.userAgent}</span>}
                    </div>

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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
