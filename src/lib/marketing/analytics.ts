/**
 * Analytics do painel de marketing — módulo puro e testável.
 * Agrega contatos, execuções, eventos, cupons e usos em KPIs e séries diárias
 * para o dashboard (/admin/marketing). Não importa Firebase.
 */
import type { BiRange } from "@/lib/bi/types";
import type {
  MarketingCampaign,
  MarketingContact,
  MarketingExecution,
  MarketingSettings,
} from "@/types/marketing";
import type { Coupon, CouponRedemption, Order } from "@/types";

const DAY_MS = 86400000;

export function isMarketingCoupon(c: Coupon): boolean {
  return Boolean(
    c.source === "marketing" ||
      c.marketingCampaignId ||
      c.marketingAutomationId ||
      (c.code && c.code.toUpperCase().startsWith("SHARK-")),
  );
}

/** Pedido online FINALIZADO: entregue e com pagamento confirmado (mesmo critério
 *  do BI). Pedidos em andamento, cancelados ou estornados não contam como venda. */
function isFinalizedOrder(order: Order): boolean {
  if (order.status !== "delivered") return false;
  const status = order.payment?.status ?? order.paymentStatus ?? "pending";
  return status === "paid";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function labelOf(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

function fullLabelOf(d: Date): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function dayStart(iso: string | undefined): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function inRange(t: number, range: BiRange): boolean {
  return Number.isFinite(t) && t >= range.start.getTime() && t <= range.end.getTime();
}

/** Dias do intervalo (inclusive) — datas em passos de 24h. */
function daysOf(range: BiRange): Date[] {
  const out: Date[] = [];
  const start = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
  for (let t = start.getTime(); t <= range.end.getTime(); t += DAY_MS) {
    out.push(new Date(t));
  }
  return out;
}

export interface SeriesPoint {
  label: string;
  fullLabel: string;
  value: number;
}

export interface DashboardAnalytics {
  kpis: {
    totalClients: number;
    active: number;
    atRisk: number;
    lost: number;
    neverBought: number;
    vip: number;
    newClients: number;
    messagesSent: number;
    campaignMessages: number;
    automationMessages: number;
    couponsCreated: number;
    couponsUsed: number;
    revenue: number;
    conversionRate: number;
    recoveryUsers: number;
  };
  composition: { label: string; count: number; color: string }[];
  envios: SeriesPoint[];
  enviosByType: { label: string; campaign: number; automation: number }[];
  cupons: SeriesPoint[];
  receita: SeriesPoint[];
}

export interface DashboardInput {
  contacts: MarketingContact[];
  campaigns: MarketingCampaign[];
  executions: MarketingExecution[];
  coupons: Coupon[];
  redemptions: CouponRedemption[];
  orders: Order[];
  settings: MarketingSettings;
  range: BiRange;
  now?: Date;
}

/** Bucketiza um conjunto {iso, value} por dia do intervalo. */
function bucketize(
  days: Date[],
  rows: { at: number; value: number }[],
): SeriesPoint[] {
  return days.map((d) => {
    const dayMs = d.getTime();
    const next = dayMs + DAY_MS;
    let value = 0;
    for (const r of rows) {
      if (r.at >= dayMs && r.at < next) value += r.value;
    }
    return { label: labelOf(d), fullLabel: fullLabelOf(d), value: Math.round(value * 100) / 100 };
  });
}

export function computeDashboard(input: DashboardInput): DashboardAnalytics {
  const { range } = input;
  const days = daysOf(range);

  /* Cupons de marketing */
  const marketingCoupons = input.coupons.filter(isMarketingCoupon);
  const marketingIds = new Set(marketingCoupons.map((c) => c.id));
  const marketingCodes = new Set(marketingCoupons.map((c) => c.code.toUpperCase()));

  /* Usos de cupons de marketing no período */
  const redemptionsInRange = input.redemptions.filter((r) => {
    if (!marketingIds.has(r.couponId) && !marketingCodes.has(r.code.toUpperCase())) return false;
    const t = dayStart(r.createdAt);
    return inRange(t, range);
  });
  const redemptionOrderIds = new Set(redemptionsInRange.map((r) => r.orderId).filter(Boolean));
  const marketingOrders = input.orders.filter(
    (o) => redemptionOrderIds.has(o.id) && isFinalizedOrder(o),
  );
  const revenue = Math.round(marketingOrders.reduce((sum, o) => sum + (o.total ?? 0), 0) * 100) / 100;

  const usedUsers = new Set(redemptionsInRange.map((r) => r.userId).filter(Boolean));
  const recoveryUsers = usedUsers.size;

  /* Envios (execuções processadas) no período */
  const processed = input.executions.filter(
    (e) => e.status === "processed" && inRange(dayStart(e.createdAt), range),
  );
  const receivedUsers = new Set(processed.map((e) => e.userId));
  const conversionRate =
    receivedUsers.size > 0 ? Math.round((recoveryUsers / receivedUsers.size) * 1000) / 10 : 0;

  const campaignMessages = processed.filter((e) => e.campaignId && !e.automationId).length;
  const automationMessages = processed.filter((e) => e.automationId).length;

  /* Segmentação dos clientes */
  let active = 0;
  let atRisk = 0;
  let lost = 0;
  let neverBought = 0;
  let vip = 0;
  let newClients = 0;
  for (const c of input.contacts) {
    if (c.ordersCount === 0) neverBought++;
    if (c.lastOrderDays != null) {
      if (c.lastOrderDays <= 30) active++;
      else if (c.lastOrderDays <= 90) atRisk++;
      else lost++;
    } else if (c.daysSinceActivity >= 90) {
      lost++;
    }
    if (c.totalSpent >= input.settings.bigSpenderThreshold) vip++;
    const t = dayStart(c.createdAt);
    if (inRange(t, range)) newClients++;
  }

  /* Séries diárias */
  const enviosRows = processed.map((e) => ({ at: dayStart(e.createdAt), value: 1 }));
  const envios = bucketize(days, enviosRows);
  const enviosByType = days.map((d) => {
    const dayMs = d.getTime();
    const next = dayMs + DAY_MS;
    let campaign = 0;
    let automation = 0;
    for (const e of processed) {
      const t = dayStart(e.createdAt);
      if (t >= dayMs && t < next) {
        if (e.automationId) automation++;
        else campaign++;
      }
    }
    return { label: labelOf(d), campaign, automation };
  });
  const cupons = bucketize(
    days,
    redemptionsInRange.map((r) => ({ at: dayStart(r.createdAt), value: 1 })),
  );
  const receita = bucketize(
    days,
    marketingOrders.map((o) => ({ at: dayStart(o.createdAt), value: o.total ?? 0 })),
  );

  return {
    kpis: {
      totalClients: input.contacts.length,
      active,
      atRisk,
      lost,
      neverBought,
      vip,
      newClients,
      messagesSent: processed.length,
      campaignMessages,
      automationMessages,
      couponsCreated: marketingCoupons.length,
      couponsUsed: redemptionsInRange.length,
      revenue,
      conversionRate,
      recoveryUsers,
    },
    composition: [
      { label: "Ativos (compra em ≤30d)", count: active, color: "var(--color-success)" },
      { label: "Em risco (30–90d)", count: atRisk, color: "var(--color-warning)" },
      { label: "Perdidos (90d+)", count: lost, color: "var(--color-error)" },
      { label: "Nunca compraram", count: neverBought, color: "var(--color-text-muted)" },
    ],
    envios,
    enviosByType,
    cupons,
    receita,
  };
}

/** Estatísticas rápidas de execução para o histórico (total por status). */
export function summarizeExecutions(executions: MarketingExecution[]): {
  total: number;
  processed: number;
  skipped: number;
  errored: number;
} {
  const total = executions.length;
  const processed = executions.filter((e) => e.status === "processed").length;
  const skipped = executions.filter((e) => e.status === "skipped_spam").length;
  const errored = executions.filter((e) => e.status === "error" || e.status === "failed").length;
  return { total, processed, skipped, errored };
}
