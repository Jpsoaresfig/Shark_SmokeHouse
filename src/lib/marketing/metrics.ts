/**
 * Métricas do módulo de marketing — módulo puro e testável.
 * Agrega execuções e eventos persistidos para o dashboard e o histórico.
 */
import type {
  MarketingCampaign,
  MarketingEvent,
  MarketingExecution,
} from "@/types/marketing";

const DAY_MS = 86400000;

export interface CampaignStats {
  /** Execuções persistidas (mensagens enviadas). */
  sent: number;
  /** Execuções com status "error"/"failed". */
  errored: number;
  /** Envios bloqueados (anti-spam/opt-out) — NÃO contam como enviados. */
  skipped: number;
  /** Toques reais na notificação/link (eventos "campaign_clicked", um por
   *  notificação, deduplicado no servidor pelo doc id `click:<notifId>`). */
  clicks: number;
  /** Clicks ÷ sentes (%). */
  ctr: number;
}

/** Métricas de uma campanha a partir de suas execuções e eventos. */
export function campaignStats(
  executions: MarketingExecution[],
  events: MarketingEvent[],
): CampaignStats {
  // Só "processed" é mensagem entregue. Registros de bloqueio (skipped_spam —
  // anti-spam/opt-out), cancelados e erros também ficam em marketingExecutions
  // com o campaignId e antes inflavam "Enviadas" (e derrubavam o CTR).
  const sent = executions.filter((e) => e.status === "processed").length;
  const errored = executions.filter((e) => e.status === "error" || e.status === "failed").length;
  const skipped = executions.filter((e) => e.status === "skipped_spam").length;
  const clicks = events.filter((e) => e.type === "campaign_clicked").length;
  return {
    sent,
    errored,
    skipped,
    clicks,
    ctr: sent > 0 ? Math.round((clicks / sent) * 1000) / 10 : 0,
  };
}

/** Execuções (mensagens) criadas nos últimos N dias. */
export function countInLastDays(executions: MarketingExecution[], days: number, now: Date = new Date()): number {
  const cutoff = new Date(now.getTime() - days * DAY_MS).getTime();
  return executions.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
}

/** Status das campanhas para resumo do dashboard. */
export function summarizeCampaigns(campaigns: MarketingCampaign[]): {
  total: number;
  draft: number;
  scheduled: number;
  sent: number;
  cancelled: number;
  messagesSent: number;
} {
  const total = campaigns.length;
  let draft = 0;
  let scheduled = 0;
  let sent = 0;
  let cancelled = 0;
  let messagesSent = 0;
  for (const c of campaigns) {
    if (c.status === "draft") draft++;
    else if (c.status === "scheduled") scheduled++;
    else if (c.status === "sent") {
      sent++;
      messagesSent += c.sentCount ?? 0;
    } else if (c.status === "cancelled") cancelled++;
  }
  return { total, draft, scheduled, sent, cancelled, messagesSent };
}
