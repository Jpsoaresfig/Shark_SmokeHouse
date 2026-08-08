import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import type {
  AlertSeverity, CronExecutionStatus, MetricsPeriod, OrderStatus,
  ServiceHealth, StockInconsistency, StuckOrderInfo, SystemAlertType,
  SystemError, SystemErrorType, SystemHealth, SystemMetrics, WebhookLogStatus,
} from "@/types";

/**
 * Observabilidade no SERVIDOR (Admin SDK). NUNCA importe em componentes de
 * cliente. Cria os registros de `systemErrors`, `webhookLogs`, `cronExecutions`,
 * `systemAlerts` e `systemMetrics`, além de rodar as checagens de saúde
 * (`/api/health`) e as métricas agregadas (`/api/metrics`).
 *
 * Toda escrita aqui é "best-effort" (nunca lança erro): o monitoramento não pode
 * derrubar a operação que está sendo monitorada.
 */

/* ── Sanitização de dados sensíveis ───────────────────────── */

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |)PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |)PRIVATE KEY-----/g,
  /APP_USR-[A-Za-z0-9-]{10,}/g,
  /TEST-[A-Za-z0-9-]{10,}/g,
  /re_[A-Za-z0-9]{14,}/g,
  /[A-Za-z0-9]{39,}-[A-Za-z0-9-]{30,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

/** Remove padrões de chaves/tokens antes de persistir qualquer log. */
function redact(value: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[REDACTED]"), value);
}

function redactOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  return redact(String(value)).slice(0, 5000);
}

/* Firestore rejeita `undefined` — remove campos vazios. */
function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as Partial<T>;
}

function isoNow(): string {
  return new Date().toISOString();
}

async function safeWrite(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error("[observability] falha ao registrar:", err);
  }
}

/* ── Autorização (somente admin) ──────────────────────────── */

/**
 * Valida no servidor que o chamador é um admin (role "admin" no Firestore).
 * Usa o ID token do Firebase enviado como `Authorization: Bearer <token>`.
 * Nunca confia apenas no frontend.
 */
export async function requireAdmin(request: Request): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const snap = await getAdminDb().collection("users").doc(decoded.uid).get();
    return snap.data()?.role === "admin";
  } catch {
    return false;
  }
}

/* ── Registro de erros ────────────────────────────────────── */

export interface LogSystemErrorInput {
  type: SystemErrorType;
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  userRole?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export function logSystemError(input: LogSystemErrorInput): Promise<void> {
  return safeWrite(async () => {
    const metadata = input.metadata
      ? (JSON.parse(redact(JSON.stringify(input.metadata))) as Record<string, unknown>)
      : undefined;
    const doc: Omit<SystemError, "id"> = {
      type: input.type,
      message: redact(input.message).slice(0, 2000),
      ...(redactOrNull(input.stack) ? { stack: redactOrNull(input.stack)! } : {}),
      ...(redactOrNull(input.route) ? { route: String(input.route).slice(0, 200) } : {}),
      ...(input.method ? { method: input.method.slice(0, 10) } : {}),
      ...(input.statusCode ? { statusCode: input.statusCode } : {}),
      ...(input.userId ? { userId: input.userId } : {}),
      ...(input.userRole ? { userRole: input.userRole } : {}),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      ...(metadata ? { metadata } : {}),
      timestamp: isoNow(),
      environment: process.env.NODE_ENV ?? "production",
      resolved: false,
    };
    await getAdminDb().collection("systemErrors").add(clean(doc));
  });
}

/* ── Registro de webhooks ─────────────────────────────────── */

export interface LogWebhookEventInput {
  provider: string;
  type?: string;
  providerRef?: string;
  orderId?: string;
  status: WebhookLogStatus;
  statusCode?: number;
  processingTime?: number;
  requestId?: string;
  error?: string;
}

export function logWebhookEvent(input: LogWebhookEventInput): Promise<void> {
  return safeWrite(async () => {
    await getAdminDb().collection("webhookLogs").add(
      clean({
        provider: input.provider,
        ...(input.type ? { type: input.type } : {}),
        ...(input.providerRef ? { providerRef: String(input.providerRef).slice(0, 100) } : {}),
        ...(input.orderId ? { orderId: input.orderId } : {}),
        status: input.status,
        ...(input.statusCode ? { statusCode: input.statusCode } : {}),
        ...(input.processingTime != null ? { processingTime: Math.round(input.processingTime) } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        ...(redactOrNull(input.error) ? { error: redactOrNull(input.error)! } : {}),
        timestamp: isoNow(),
      }),
    );
  });
}

/* ── Registro de crons ────────────────────────────────────── */

export interface LogCronExecutionInput {
  job: string;
  status: CronExecutionStatus;
  startedAt: string;
  processed?: number;
  failed?: number;
  error?: string;
  requestId?: string;
}

export function logCronExecution(input: LogCronExecutionInput): Promise<void> {
  return safeWrite(async () => {
    const startedAt = new Date(input.startedAt).getTime();
    const finishedAt = Date.now();
    await getAdminDb().collection("cronExecutions").add(
      clean({
        job: input.job,
        startedAt: input.startedAt,
        finishedAt: new Date(finishedAt).toISOString(),
        duration: Math.max(0, finishedAt - startedAt),
        status: input.status,
        ...(input.processed != null ? { processed: input.processed } : {}),
        ...(input.failed != null ? { failed: input.failed } : {}),
        ...(redactOrNull(input.error) ? { error: redactOrNull(input.error)! } : {}),
        ...(input.requestId ? { requestId: input.requestId } : {}),
        timestamp: isoNow(),
      }),
    );
  });
}

/* ── Alertas ──────────────────────────────────────────────── */

export interface CreateSystemAlertInput {
  /** Chave de deduplicação do incidente (ex.: "cron:loyalty-maintenance"). */
  key: string;
  type: SystemAlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
}

/** Cria um alerta ativo, a menos que já exista um ativo com a mesma chave. */
export async function createSystemAlert(input: CreateSystemAlertInput): Promise<void> {
  return safeWrite(async () => {
    const db = getAdminDb();
    const existing = await db
      .collection("systemAlerts")
      .where("key", "==", input.key)
      .limit(20)
      .get();
    const hasActive = existing.docs.some((d) => d.data().status === "active");
    if (hasActive) return;
    await db.collection("systemAlerts").add(
      clean({
        key: input.key,
        type: input.type,
        severity: input.severity,
        message: redact(input.message).slice(0, 500),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        status: "active",
        timestamp: isoNow(),
      }),
    );
  });
}

/* ── Contador de requisições monitoradas ──────────────────── */

function dayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Incrementa o contador diário de requisições monitoradas (webhook, cron,
 * pagamentos). Um doc por dia (`systemMetrics/{YYYY-MM-DD}`) com buckets por
 * hora (`hours.HH`) e por endpoint (`byEndpoint.<nome>`) — leitura barata e
 * permite contar janelas parciais do dia atual.
 */
export function recordMonitoredRequest(endpoint: string): Promise<void> {
  return safeWrite(async () => {
    const now = new Date();
    const hour = String(now.getHours()).padStart(2, "0");
    await getAdminDb().collection("systemMetrics").doc(dayKey(now)).set(
      {
        day: dayKey(now),
        requests: FieldValue.increment(1),
        [`hours.${hour}`]: FieldValue.increment(1),
        [`byEndpoint.${endpoint}`]: FieldValue.increment(1),
      },
      { merge: true },
    );
  });
}

/* ── Checagens de saúde ───────────────────────────────────── */

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.name === "AbortError" ? "Timeout" : err.message;
  return String(err);
}

function checkApi(): ServiceHealth {
  return { status: "operational", responseTime: 1, lastCheckedAt: isoNow() };
}

async function checkFirestore(): Promise<ServiceHealth> {
  const started = Date.now();
  try {
    await getAdminDb().collection("settings").doc("site").get();
    return { status: "operational", responseTime: Date.now() - started, lastCheckedAt: isoNow() };
  } catch (err) {
    return {
      status: "down",
      responseTime: Date.now() - started,
      lastCheckedAt: isoNow(),
      message: errMessage(err),
    };
  }
}

async function checkMercadoPago(): Promise<ServiceHealth> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return { status: "unknown", lastCheckedAt: isoNow(), message: "Não configurado" };
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rt = Date.now() - started;
    if (res.ok) return { status: "operational", responseTime: rt, lastCheckedAt: isoNow() };
    if (res.status === 401 || res.status === 403) {
      return { status: "degraded", responseTime: rt, lastCheckedAt: isoNow(), message: "Credencial inválida" };
    }
    return { status: "degraded", responseTime: rt, lastCheckedAt: isoNow(), message: `Resposta ${res.status}` };
  } catch (err) {
    return { status: "down", responseTime: Date.now() - started, lastCheckedAt: isoNow(), message: errMessage(err) };
  }
}

async function checkCloudinary(): Promise<ServiceHealth> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim();
  if (!cloudName) {
    return { status: "unknown", lastCheckedAt: isoNow(), message: "Não configurado" };
  }
  const started = Date.now();
  try {
    // Verificação de alcance do cloud name (qualquer resposta HTTP = reachable).
    const res = await fetchWithTimeout(
      `https://res.cloudinary.com/${encodeURIComponent(cloudName)}/image/list/healthcheck.json`,
    );
    const rt = Date.now() - started;
    if (res.ok) return { status: "operational", responseTime: rt, lastCheckedAt: isoNow() };
    if (res.status >= 500) {
      return { status: "degraded", responseTime: rt, lastCheckedAt: isoNow(), message: `Resposta ${res.status}` };
    }
    return { status: "operational", responseTime: rt, lastCheckedAt: isoNow() };
  } catch (err) {
    return { status: "down", responseTime: Date.now() - started, lastCheckedAt: isoNow(), message: errMessage(err) };
  }
}

async function checkResend(): Promise<ServiceHealth> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { status: "unknown", lastCheckedAt: isoNow(), message: "Não configurado" };
  const started = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const rt = Date.now() - started;
    if (res.ok) return { status: "operational", responseTime: rt, lastCheckedAt: isoNow() };
    if (res.status === 401 || res.status === 403) {
      return { status: "degraded", responseTime: rt, lastCheckedAt: isoNow(), message: "Credencial inválida" };
    }
    return { status: "degraded", responseTime: rt, lastCheckedAt: isoNow(), message: `Resposta ${res.status}` };
  } catch (err) {
    return { status: "down", responseTime: Date.now() - started, lastCheckedAt: isoNow(), message: errMessage(err) };
  }
}

/** Atraso máximo (h) aceito na última execução de um cron (uma vez por dia). */
const CRON_MAX_AGE_HOURS = 26;

async function checkCron(): Promise<ServiceHealth> {
  try {
    const snap = await getAdminDb()
      .collection("cronExecutions")
      .orderBy("timestamp", "desc")
      .limit(30)
      .get();
    if (snap.empty) {
      return { status: "unknown", lastCheckedAt: isoNow(), message: "Nenhuma execução registrada ainda" };
    }
    const now = Date.now();
    const jobs = new Map<string, { ok: boolean; at: number }>();
    for (const d of snap.docs) {
      const data = d.data();
      const job = String(data.job ?? "");
      if (!job || jobs.has(job)) continue;
      const at = typeof data.timestamp === "string" ? new Date(data.timestamp).getTime() : 0;
      if (!at) continue;
      jobs.set(job, { ok: data.status === "success", at });
    }
    const expected = ["loyalty-maintenance", "orders-queue"];
    const missing = expected.filter((j) => !jobs.has(j));
    const overdue = [...jobs.entries()].filter(([, v]) => now - v.at > CRON_MAX_AGE_HOURS * 3600_000);
    const failed = [...jobs.entries()].filter(([, v]) => !v.ok);
    if (missing.length > 0 || overdue.length > 0) {
      return {
        status: "degraded",
        lastCheckedAt: isoNow(),
        message: "Execução diária pendente ou não registrada",
      };
    }
    if (failed.length > 0) {
      return { status: "degraded", lastCheckedAt: isoNow(), message: `Falha: ${failed.map(([j]) => j).join(", ")}` };
    }
    return { status: "operational", lastCheckedAt: isoNow(), message: "Execuções diárias ok" };
  } catch (err) {
    return { status: "unknown", lastCheckedAt: isoNow(), message: `Sem dados de execução (${errMessage(err)})` };
  }
}

/** Saúde agregada de todos os serviços (GET /api/health). */
export async function runHealthCheck(): Promise<SystemHealth> {
  const [firestore, mercadopago, cloudinary, resend, cron] = await Promise.all([
    checkFirestore(),
    checkMercadoPago(),
    checkCloudinary(),
    checkResend(),
    checkCron(),
  ]);
  const services: SystemHealth["services"] = {
    api: checkApi(),
    firestore,
    mercadopago,
    cloudinary,
    resend,
    cron,
  };
  const statuses = Object.values(services).map((s) => s.status);
  const status = statuses.includes("down")
    ? "unhealthy"
    : statuses.includes("degraded") || statuses.includes("unknown")
      ? "degraded"
      : "healthy";
  return { status, timestamp: isoNow(), services };
}

/* ── Pedidos potencialmente presos ────────────────────────── */

const STUCK_STATUSES: OrderStatus[] = [
  "received", "analyzing", "approved", "preparing", "out_for_delivery",
];

const STUCK_THRESHOLD_HOURS: Record<OrderStatus, number> = {
  reserved: 0,
  received: 6,
  analyzing: 6,
  approved: 24,
  preparing: 4,
  out_for_delivery: 4,
  delivered: 0,
  cancelled: 0,
};

function toTimestamp(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  if (typeof value === "object") {
    const v = value as { toDate?: () => Date; seconds?: unknown };
    if (typeof v.toDate === "function") return v.toDate();
    if (typeof v.seconds === "number") return new Date(v.seconds * 1000);
  }
  return null;
}

function lastStatusChangeAt(order: Record<string, unknown>): Date | null {
  const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
  if (history.length > 0) {
    const last = history[history.length - 1] as { timestamp?: unknown };
    const t = toTimestamp(last.timestamp);
    if (t) return t;
  }
  return toTimestamp(order.createdAt);
}

/** Detecta pedidos há tempo excessivo num status de processamento. Só alerta. */
export async function detectStuckOrders(limit = 25): Promise<StuckOrderInfo[]> {
  const db = getAdminDb();
  const now = Date.now();
  const snap = await db.collection("orders").where("status", "in", STUCK_STATUSES).get();
  const stuck: StuckOrderInfo[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const status = data.status as OrderStatus;
    const threshold = STUCK_THRESHOLD_HOURS[status];
    if (!threshold) continue;
    const lastChange = lastStatusChangeAt(data);
    if (!lastChange) continue;
    const hours = (now - lastChange.getTime()) / 3600_000;
    if (hours >= threshold) {
      stuck.push({
        id: d.id,
        status,
        customerName: typeof data.customerName === "string" ? data.customerName : undefined,
        stuckSince: lastChange.toISOString(),
        hoursInStatus: Math.round(hours * 100) / 100,
      });
      if (stuck.length >= limit) break;
    }
  }
  return stuck.sort((a, b) => b.hoursInStatus - a.hoursInStatus);
}

/* ── Inconsistências de estoque ───────────────────────────── */

/**
 * Detecta estoque negativo e divergência entre o estoque agregado do produto e
 * a soma das variações. Apenas detecta — nunca corrige automaticamente.
 */
export async function detectStockInconsistencies(limit = 25): Promise<StockInconsistency[]> {
  const db = getAdminDb();
  const out: StockInconsistency[] = [];

  // 1) Estoque negativo (query de faixa, índice automático).
  const negative = await db.collection("products").where("stock", "<", 0).get();
  for (const d of negative.docs) {
    const p = d.data();
    const current = typeof p.stock === "number" ? p.stock : 0;
    out.push({
      productId: d.id,
      name: typeof p.name === "string" ? p.name : d.id,
      sku: typeof p.sku === "string" ? p.sku : undefined,
      currentStock: current,
      expectedStock: 0,
      difference: current,
    });
    if (out.length >= limit) return out;
  }

  // 2) Produtos com variações onde `stock` ≠ soma das variações (varredura do
  //    catálogo — pequeno para uma tabacaria, aceitável sob demanda).
  const all = await db.collection("products").get();
  for (const d of all.docs) {
    const p = d.data();
    const variations = Array.isArray(p.variations) ? p.variations : [];
    if (variations.length === 0) continue;
    const expected = variations.reduce<number>(
      (sum, v) => sum + (typeof (v as { stock?: unknown }).stock === "number" ? ((v as { stock: number }).stock) : 0),
      0,
    );
    const current = typeof p.stock === "number" ? p.stock : 0;
    if (current !== expected) {
      out.push({
        productId: d.id,
        name: typeof p.name === "string" ? p.name : d.id,
        sku: typeof p.sku === "string" ? p.sku : undefined,
        currentStock: current,
        expectedStock: expected,
        difference: current - expected,
      });
      if (out.length >= limit) return out;
    }
  }

  return out;
}

/* ── Métricas agregadas ───────────────────────────────────── */

const PERIOD_HOURS: Record<MetricsPeriod, number> = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 168,
  "30d": 720,
};

/** True quando o valor é um período válido de métricas. */
export function isMetricsPeriod(value: string): value is MetricsPeriod {
  return value in PERIOD_HOURS;
}

/** Soma os contadores horários dentro da janela do período. */
function countRequestsSince(docs: Array<{ data(): unknown }>, since: Date): number {
  let total = 0;
  const now = Date.now();
  for (const d of docs) {
    const data = d.data() as { day?: string; hours?: Record<string, unknown> };
    if (!data.day) continue;
    const dayStart = new Date(data.day).getTime();
    if (!Number.isFinite(dayStart)) continue;
    const hours = data.hours ?? {};
    for (const [hh, count] of Object.entries(hours)) {
      if (typeof count !== "number" || !/^\d{2}$/.test(hh)) continue;
      const slot = dayStart + Number(hh) * 3600_000;
      if (slot >= since.getTime() && slot <= now) total += count;
    }
  }
  return total;
}

/** Métricas agregadas do sistema (GET /api/metrics). */
export async function computeMetrics(period: MetricsPeriod): Promise<SystemMetrics> {
  const since = new Date(Date.now() - PERIOD_HOURS[period] * 3600_000);
  const sinceIso = since.toISOString();
  const db = getAdminDb();

  const [errorSnap, webhookSnap, cronSnap, metricsSnap, stuckOrders, stockInconsistencies] =
    await Promise.all([
      db.collection("systemErrors").where("timestamp", ">=", sinceIso).get(),
      db.collection("webhookLogs").where("timestamp", ">=", sinceIso).get(),
      db.collection("cronExecutions").where("timestamp", ">=", sinceIso).get(),
      db.collection("systemMetrics").get(),
      detectStuckOrders(),
      detectStockInconsistencies(),
    ]);

  const errorsCount = errorSnap.size;
  const requests = countRequestsSince(metricsSnap.docs, since);
  const webhookFailures = webhookSnap.docs.filter((d) => d.data().status === "failed").length;
  const webhookDuplicates = webhookSnap.docs.filter((d) => d.data().status === "duplicate").length;
  const cronFailures = cronSnap.docs.filter((d) => d.data().status === "failed").length;

  return {
    period,
    requests,
    errors: errorsCount,
    errorRate: requests > 0 ? Math.round((errorsCount / requests) * 10000) / 100 : 0,
    openErrors: errorSnap.docs.filter((d) => d.data().resolved === false).length,
    webhooks: webhookSnap.size,
    webhookFailures,
    webhookDuplicates,
    cronExecutions: cronSnap.size,
    cronFailures,
    stuckOrders: stuckOrders.length,
    stockInconsistencies: stockInconsistencies.length,
    stuckOrderSample: stuckOrders.slice(0, 10),
    stockInconsistencySample: stockInconsistencies.slice(0, 10),
  };
}
