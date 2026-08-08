"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Cloud, Database, HelpCircle,
  Mail, QrCode, RefreshCw, RotateCcw, Server, ShieldAlert, Timer, Trash2, Wrench, XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import { formatDateTime } from "@/lib/utils";
import {
  fetchSystemHealth,
  fetchSystemMetrics,
  getSystemErrors,
  setSystemErrorResolved,
  deleteSystemError,
  getWebhookLogs,
  getCronExecutions,
} from "@/lib/firebase/observability";
import type {
  CronExecution, MetricsPeriod, ServiceHealth, ServiceStatus, SystemError,
  SystemHealth, SystemMetrics, SystemServiceName, WebhookLog,
} from "@/types";

const SERVICE_META: { key: SystemServiceName; label: string; icon: typeof Server }[] = [
  { key: "api",         label: "API",            icon: Server },
  { key: "firestore",   label: "Firestore",      icon: Database },
  { key: "mercadopago", label: "Mercado Pago",   icon: QrCode },
  { key: "cloudinary",  label: "Cloudinary",     icon: Cloud },
  { key: "resend",      label: "Resend (e-mail)", icon: Mail },
  { key: "cron",        label: "Cron jobs",      icon: Timer },
];

const STATUS_META: Record<ServiceStatus, { label: string; variant: "success" | "warning" | "destructive" | "secondary"; icon: typeof CheckCircle2 }> = {
  operational: { label: "Operacional",  variant: "success",     icon: CheckCircle2 },
  degraded:    { label: "Degradado",    variant: "warning",     icon: AlertTriangle },
  down:        { label: "Fora do ar",   variant: "destructive", icon: XCircle },
  unknown:     { label: "Desconhecido", variant: "secondary",   icon: HelpCircle },
};

const ERROR_TYPE_LABELS: Record<string, string> = {
  api: "API", payment: "Pagamento", webhook: "Webhook", cron: "Cron",
  firestore: "Firestore", cloudinary: "Cloudinary", resend: "E-mail",
  stock: "Estoque", order: "Pedido", other: "Outro",
};

const PERIODS: { value: MetricsPeriod; label: string }[] = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

const CRON_JOB_LABELS: Record<string, string> = {
  "loyalty-maintenance": "Manutenção do Clube Shark",
  "orders-queue": "Fila de pedidos reservados",
};

function serviceHealthCard(name: SystemServiceName, meta: typeof SERVICE_META[number], health?: ServiceHealth) {
  const Icon = meta.icon;
  const status = health?.status ?? "unknown";
  const sm = STATUS_META[status];
  const StatusIcon = sm.icon;
  return (
    <Card key={name}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[var(--color-text-muted)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">{meta.label}</span>
          </div>
          <Badge variant={sm.variant}>
            <StatusIcon className="w-3 h-3" /> {sm.label}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {health?.lastCheckedAt ? formatDateTime(health.lastCheckedAt) : "—"}
          </span>
          {health?.responseTime != null && (
            <span className="font-mono">{health.responseTime} ms</span>
          )}
        </div>
        {health?.message && (
          <p className="mt-2 text-xs text-[var(--color-text-secondary)] break-words">{health.message}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Aba "Sistema" — saúde dos serviços, métricas, erros, webhooks e crons. */
export function SystemTab() {
  const { user, firebaseReady } = useAuthStore();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookLog[]>([]);
  const [crons, setCrons] = useState<CronExecution[]>([]);
  const [period, setPeriod] = useState<MetricsPeriod>("24h");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const operator = user?.email ?? user?.displayName ?? "admin";

  const load = useCallback(async () => {
    try {
      const [h, m, e, w, c] = await Promise.all([
        fetchSystemHealth(),
        fetchSystemMetrics(period),
        getSystemErrors(),
        getWebhookLogs(),
        getCronExecutions(),
      ]);
      setHealth(h);
      setMetrics(m);
      setErrors(e);
      setWebhooks(w);
      setCrons(c);
    } catch {
      toast.error("Não foi possível carregar os dados do sistema.");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { if (firebaseReady) void load(); }, [firebaseReady, load]);

  async function toggleResolve(err: SystemError) {
    setActionId(err.id);
    try {
      await setSystemErrorResolved(err.id, !err.resolved, operator);
      setErrors((prev) => prev.map((e) => (e.id === err.id ? { ...e, resolved: !err.resolved } : e)));
      toast.success(err.resolved ? "Erro reaberto." : "Erro resolvido.");
    } catch {
      toast.error("Erro ao atualizar o registro.");
    } finally {
      setActionId(null);
    }
  }

  async function removeError(id: string) {
    setActionId(id);
    try {
      await deleteSystemError(id);
      setErrors((prev) => prev.filter((e) => e.id !== id));
      toast.success("Registro excluído.");
    } catch {
      toast.error("Erro ao excluir o registro.");
    } finally {
      setActionId(null);
    }
  }

  const overallStatus = health?.status === "unhealthy" ? "destructive"
    : health?.status === "degraded" ? "warning"
    : health?.status === "healthy" ? "success" : "secondary";

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={overallStatus}>
            <Activity className="w-3 h-3" />
            {health ? `Status geral: ${health.status}` : "Sem status"}
          </Badge>
          <span className="text-sm text-[var(--color-text-muted)]">
            {health?.timestamp ? `Verificado em ${formatDateTime(health.timestamp)}` : "Aguardando verificação..."}
          </span>
        </div>
        <button
          onClick={() => { setLoading(true); void load(); }}
          disabled={loading}
          className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Verificar agora
        </button>
      </div>

      {loading && !health ? (
        <p className="text-sm text-[var(--color-text-muted)]">Verificando serviços...</p>
      ) : (
        <>
          {/* Saúde dos serviços */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {SERVICE_META.map((m) => serviceHealthCard(m.key, m, health?.services[m.key]))}
          </div>

          {/* Métricas do período */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[var(--color-neon-blue)]" /> Métricas do período
                </h2>
                <div className="flex gap-1">
                  {PERIODS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => setPeriod(p.value)}
                      className={`px-2.5 h-7 rounded-md text-xs font-medium transition-all ${
                        period === p.value
                          ? "bg-[var(--color-neon-blue)] text-white"
                          : "border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Requisições</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{metrics?.requests ?? 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Erros</p>
                  <p className={`text-lg font-bold ${(metrics?.errors ?? 0) > 0 ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]"}`}>{metrics?.errors ?? 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Taxa de erro</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{metrics?.errorRate ?? 0}%</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Webhooks</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{metrics?.webhooks ?? 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Pedidos presos</p>
                  <p className={`text-lg font-bold ${(metrics?.stuckOrders ?? 0) > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]"}`}>{metrics?.stuckOrders ?? 0}</p>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Inconsist. estoque</p>
                  <p className={`text-lg font-bold ${(metrics?.stockInconsistencies ?? 0) > 0 ? "text-[var(--color-warning)]" : "text-[var(--color-text-primary)]"}`}>{metrics?.stockInconsistencies ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Erros do sistema */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" /> Erros registrados
              </h2>
              {errors.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum erro registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {errors.map((err) => (
                    <div
                      key={err.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={err.resolved ? "success" : "destructive"}>
                            {err.resolved ? "Resolvido" : "Aberto"}
                          </Badge>
                          <Badge variant="secondary">{ERROR_TYPE_LABELS[err.type] ?? err.type}</Badge>
                          {err.route && (
                            <span className="font-mono text-xs text-[var(--color-neon-blue)] truncate">{err.route}</span>
                          )}
                          {err.statusCode && (
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">{err.statusCode}</span>
                          )}
                          {err.requestId && (
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">{err.requestId}</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--color-text-primary)] break-words">{err.message}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                          {formatDateTime(err.timestamp)}{err.resolvedBy ? ` · por ${err.resolvedBy}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          disabled={actionId === err.id}
                          onClick={() => toggleResolve(err)}
                          title={err.resolved ? "Reabrir" : "Marcar como resolvido"}
                          className="flex items-center gap-1 px-2.5 h-8 rounded-lg border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-colors disabled:opacity-50"
                        >
                          {err.resolved ? <RotateCcw className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {err.resolved ? "Reabrir" : "Resolver"}
                        </button>
                        <button
                          disabled={actionId === err.id}
                          onClick={() => removeError(err.id)}
                          title="Excluir registro"
                          className="flex items-center px-2.5 h-8 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 text-xs font-medium text-[var(--color-error)] hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhooks recebidos */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4 text-[var(--color-neon-blue)]" /> Webhooks recebidos
              </h2>
              {webhooks.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum webhook recebido ainda.</p>
              ) : (
                <div className="space-y-2">
                  {webhooks.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge
                            variant={
                              w.status === "success" ? "success"
                              : w.status === "failed" ? "destructive"
                              : w.status === "duplicate" ? "warning"
                              : "secondary"
                            }
                          >
                            {w.status}
                          </Badge>
                          <span className="font-mono text-xs text-[var(--color-neon-blue)]">
                            {w.provider}{w.type ? `/${w.type}` : ""}
                          </span>
                          {w.providerRef && (
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">ref {w.providerRef}</span>
                          )}
                          {w.orderId && (
                            <span className="font-mono text-xs text-[var(--color-text-muted)]">pedido {w.orderId}</span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatDateTime(w.timestamp)}
                          {w.processingTime != null ? ` · ${w.processingTime} ms` : ""}
                          {w.requestId ? ` · ${w.requestId}` : ""}
                        </p>
                        {w.error && (
                          <p className="mt-1 text-xs text-[var(--color-error)] break-words">{w.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Execuções de cron */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <Timer className="w-4 h-4 text-[var(--color-neon-blue)]" /> Execuções de cron jobs
              </h2>
              {crons.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhuma execução registrada ainda.</p>
              ) : (
                <div className="space-y-2">
                  {crons.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={c.status === "success" ? "success" : "destructive"}>{c.status}</Badge>
                          <span className="text-sm text-[var(--color-text-primary)]">
                            {CRON_JOB_LABELS[c.job] ?? c.job}
                          </span>
                          <span className="font-mono text-xs text-[var(--color-text-muted)]">{c.job}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatDateTime(c.startedAt)}
                          {c.duration != null ? ` · ${Math.round(c.duration)} ms` : ""}
                          {c.processed != null ? ` · ${c.processed} processados` : ""}
                          {c.requestId ? ` · ${c.requestId}` : ""}
                        </p>
                        {c.error && (
                          <p className="mt-1 text-xs text-[var(--color-error)] break-words">{c.error}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
