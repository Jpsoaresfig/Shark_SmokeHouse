import {
  collection, getDocs, updateDoc, deleteDoc, doc,
  query, orderBy, limit,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type {
  SystemError, WebhookLog, CronExecution, SystemAlert,
  SystemHealth, SystemMetrics, MetricsPeriod,
} from "@/types";

/**
 * Acesso do admin às coleções de observabilidade (Centro de Operações).
 *
 * As ESCRITAS de criação são feitas exclusivamente no servidor (Admin SDK) e
 * as regras do Firestore negam criação por clientes. O admin pode ler, resolver
 * (apenas os campos de resolução) e excluir. A autenticação das rotas de API
 * (`/api/health`, `/api/metrics`) é validada no servidor via ID token.
 */

const ERRORS_COL = "systemErrors";
const WEBHOOKS_COL = "webhookLogs";
const CRONS_COL = "cronExecutions";
const ALERTS_COL = "systemAlerts";

/* ── Helpers ──────────────────────────────────────────────── */

/** Chama uma rota de API de observabilidade com o ID token do admin. */
async function adminGet<T>(path: string): Promise<T> {
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const res = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Falha na requisição (HTTP ${res.status}).`);
  return res.json() as Promise<T>;
}

function mapDocs<T>(snap: { docs: Array<{ id: string; data(): Record<string, unknown> }> }): T[] {
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as T));
}

/* ── Erros do sistema ─────────────────────────────────────── */

/** Admin: erros recentes (mais recentes primeiro). Filtros aplicados no cliente. */
export async function getSystemErrors(max = 100): Promise<SystemError[]> {
  const snap = await getDocs(
    query(collection(db, ERRORS_COL), orderBy("timestamp", "desc"), limit(max))
  );
  return mapDocs<SystemError>(snap);
}

/** Admin: marca um erro como resolvido/reaberto (regras restringem estes campos). */
export async function setSystemErrorResolved(
  id: string,
  resolved: boolean,
  by: string,
): Promise<void> {
  await updateDoc(doc(db, ERRORS_COL, id), {
    resolved,
    resolvedAt: resolved ? new Date().toISOString() : null,
    resolvedBy: resolved ? by : null,
  });
}

/** Admin: exclui um erro. */
export async function deleteSystemError(id: string): Promise<void> {
  await deleteDoc(doc(db, ERRORS_COL, id));
}

/* ── Webhooks ─────────────────────────────────────────────── */

/** Admin: registros de webhook recentes. */
export async function getWebhookLogs(max = 40): Promise<WebhookLog[]> {
  const snap = await getDocs(
    query(collection(db, WEBHOOKS_COL), orderBy("timestamp", "desc"), limit(max))
  );
  return mapDocs<WebhookLog>(snap);
}

/* ── Cron jobs ────────────────────────────────────────────── */

/** Admin: execuções recentes dos cron jobs. */
export async function getCronExecutions(max = 30): Promise<CronExecution[]> {
  const snap = await getDocs(
    query(collection(db, CRONS_COL), orderBy("timestamp", "desc"), limit(max))
  );
  return mapDocs<CronExecution>(snap);
}

/* ── Alertas ──────────────────────────────────────────────── */

/** Admin: alertas recentes (ativos primeiro, mais novos por último). */
export async function getSystemAlerts(max = 40): Promise<SystemAlert[]> {
  const snap = await getDocs(
    query(collection(db, ALERTS_COL), orderBy("timestamp", "desc"), limit(max))
  );
  return mapDocs<SystemAlert>(snap)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return a.timestamp.localeCompare(b.timestamp);
    });
}

/** Admin: resolve um alerta (regras restringem os campos alteráveis). */
export async function resolveSystemAlert(id: string, by: string): Promise<void> {
  await updateDoc(doc(db, ALERTS_COL, id), {
    status: "resolved",
    resolvedAt: new Date().toISOString(),
    resolvedBy: by,
  });
}

/* ── API (health + metrics) ───────────────────────────────── */

/** Saúde dos serviços — GET /api/health (autenticação validada no servidor). */
export async function fetchSystemHealth(): Promise<SystemHealth> {
  return adminGet<SystemHealth>("/api/health");
}

/** Métricas agregadas — GET /api/metrics?period=... */
export async function fetchSystemMetrics(period: MetricsPeriod): Promise<SystemMetrics> {
  return adminGet<SystemMetrics>(`/api/metrics?period=${period}`);
}
