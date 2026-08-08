"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BellRing, CheckCircle2, PackageX, RefreshCw, ShoppingBag,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "@/stores/toastStore";
import { formatDateTime } from "@/lib/utils";
import { getSystemAlerts, resolveSystemAlert, fetchSystemMetrics } from "@/lib/firebase/observability";
import type { AlertSeverity, StockInconsistency, StuckOrderInfo, SystemAlert } from "@/types";

const SEVERITY_META: Record<AlertSeverity, { label: string; variant: "destructive" | "warning" | "secondary" }> = {
  critical: { label: "Crítico", variant: "destructive" },
  warning:  { label: "Atenção", variant: "warning" },
  info:     { label: "Info",    variant: "secondary" },
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  received: "Recebido",
  analyzing: "Em análise",
  approved: "Aprovado",
  preparing: "Preparando",
  out_for_delivery: "Saiu para entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
  reserved: "Reservado",
};

/** Aba "Alertas" — alertas do sistema, pedidos presos e inconsistências de estoque. */
export function AlertsTab() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [stuckOrders, setStuckOrders] = useState<StuckOrderInfo[]>([]);
  const [stockIssues, setStockIssues] = useState<StockInconsistency[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const operator = user?.email ?? user?.displayName ?? "admin";

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([getSystemAlerts(), fetchSystemMetrics("24h")]);
      setAlerts(a);
      setStuckOrders(m.stuckOrderSample ?? []);
      setStockIssues(m.stockInconsistencySample ?? []);
    } catch {
      toast.error("Não foi possível carregar os alertas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function resolve(id: string) {
    setActionId(id);
    try {
      await resolveSystemAlert(id, operator);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status: "resolved", resolvedBy: operator, resolvedAt: new Date().toISOString() } : a)));
      toast.success("Alerta resolvido.");
    } catch {
      toast.error("Erro ao resolver o alerta.");
    } finally {
      setActionId(null);
    }
  }

  const activeCount = alerts.filter((a) => a.status === "active").length;

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-[var(--color-text-muted)]">
          {activeCount} alerta{activeCount !== 1 ? "s" : ""} ativo{activeCount !== 1 ? "s" : ""} · {stuckOrders.length} pedido{stuckOrders.length !== 1 ? "s" : ""} preso{stuckOrders.length !== 1 ? "s" : ""} · {stockIssues.length} inconsistência{stockIssues.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={() => { setLoading(true); void load(); }}
          disabled={loading}
          className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Carregando alertas...</p>
      ) : (
        <>
          {/* Alertas do sistema */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <BellRing className="w-4 h-4 text-[var(--color-warning)]" /> Alertas do sistema
              </h2>
              {alerts.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum alerta registrado ainda.</p>
              ) : (
                <div className="space-y-2">
                  {alerts.map((a) => {
                    const sev = SEVERITY_META[a.severity] ?? SEVERITY_META.info;
                    return (
                      <div
                        key={a.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant={a.status === "active" ? sev.variant : "secondary"}>
                              {a.status === "active" ? sev.label : "Resolvido"}
                            </Badge>
                            <Badge variant="secondary">{a.type}</Badge>
                            {a.key && <span className="font-mono text-xs text-[var(--color-text-muted)]">{a.key}</span>}
                          </div>
                          <p className="text-sm text-[var(--color-text-primary)] break-words">{a.message}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                            {formatDateTime(a.timestamp)}
                            {a.resolvedBy ? ` · resolvido por ${a.resolvedBy}` : ""}
                          </p>
                        </div>
                        {a.status === "active" && (
                          <button
                            disabled={actionId === a.id}
                            onClick={() => resolve(a.id)}
                            className="flex items-center gap-1 px-2.5 h-8 shrink-0 rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-xs font-medium text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Resolver
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pedidos potencialmente presos */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <ShoppingBag className="w-4 h-4 text-[var(--color-warning)]" /> Pedidos potencialmente presos
              </h2>
              {stuckOrders.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Nenhum pedido preso. 👍</p>
              ) : (
                <div className="space-y-2">
                  {stuckOrders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-xs text-[var(--color-neon-blue)]">{o.id}</span>
                          <Badge variant="warning">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                          <Badge variant="secondary">{o.hoursInStatus} h no status</Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {o.customerName ? `${o.customerName} · ` : ""}
                          parado desde {formatDateTime(o.stuckSince)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inconsistências de estoque */}
          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-3">
                <PackageX className="w-4 h-4 text-[var(--color-warning)]" /> Inconsistências de estoque
              </h2>
              {stockIssues.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Estoque consistente. 👍</p>
              ) : (
                <div className="space-y-2">
                  {stockIssues.map((s, i) => (
                    <div
                      key={`${s.productId}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] p-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                          <span className="text-sm text-[var(--color-text-primary)]">{s.name}</span>
                          {s.sku && <span className="font-mono text-xs text-[var(--color-text-muted)]">{s.sku}</span>}
                          <span className="font-mono text-xs text-[var(--color-text-muted)]">{s.productId}</span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Atual: <b className="text-[var(--color-text-primary)]">{s.currentStock}</b> · Esperado:{" "}
                          <b className="text-[var(--color-text-primary)]">{s.expectedStock}</b> · Diferença:{" "}
                          <b className={s.difference < 0 ? "text-[var(--color-error)]" : "text-[var(--color-text-primary)]"}>
                            {s.difference > 0 ? "+" : ""}{s.difference}
                          </b>
                        </p>
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
