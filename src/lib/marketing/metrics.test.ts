import { describe, it, expect } from "vitest";
import { campaignStats, countInLastDays, summarizeCampaigns } from "./metrics";
import type { MarketingCampaign, MarketingEvent, MarketingExecution } from "@/types/marketing";

function execution(overrides: Partial<MarketingExecution> = {}): MarketingExecution {
  return {
    id: "e1", campaignId: "c1", userId: "u1", channel: "app",
    title: "t", message: "m", dedupKey: "campaign:c1:u1",
    status: "processed", createdAt: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

function event(overrides: Partial<MarketingEvent> = {}): MarketingEvent {
  return {
    id: "ev1", userId: "u1", type: "campaign_clicked", campaignId: "c1",
    createdAt: "2026-08-08T12:00:00.000Z", ...overrides,
  };
}

describe("campaignStats — métricas honestas", () => {
  it("cliques contam só eventos campaign_clicked (toques reais)", () => {
    const stats = campaignStats(
      [execution(), execution({ id: "e2", dedupKey: "campaign:c1:u2", userId: "u2" })],
      [
        event(),
        // evento de envio (auditoria) NÃO é clique
        event({ id: "ev-sent", type: "campaign", message: "enviada" }),
      ],
    );
    expect(stats.sent).toBe(2);
    expect(stats.clicks).toBe(1);
    expect(stats.ctr).toBe(50);
  });

  it("CTR 0 quando não há envios", () => {
    const stats = campaignStats([], [event()]);
    expect(stats.ctr).toBe(0);
  });

  it("conta erros separadamente", () => {
    const stats = campaignStats([execution(), execution({ id: "e2", dedupKey: "campaign:c1:u2", userId: "u2", status: "error" })], []);
    expect(stats.errored).toBe(1);
  });
});

describe("countInLastDays", () => {
  it("conta apenas execuções dentro da janela", () => {
    const now = new Date("2026-08-09T00:00:00Z");
    const execs = [
      execution({ id: "a", dedupKey: "a", createdAt: "2026-08-08T00:00:00.000Z" }),
      execution({ id: "b", dedupKey: "b", createdAt: "2026-08-01T00:00:00.000Z" }),
    ];
    expect(countInLastDays(execs, 7, now)).toBe(1);
  });
});

describe("summarizeCampaigns", () => {
  const c = (id: string, status: MarketingCampaign["status"], sentCount?: number): MarketingCampaign => ({
    id, name: id, segmentId: "s", objective: "promo", channel: "app",
    title: "t", message: "m", status, scheduledFor: "",
    sentCount, createdAt: "", updatedAt: "",
  });

  it("agrega por status e soma mensagens enviadas", () => {
    const s = summarizeCampaigns([
      c("1", "sent", 10), c("2", "sent", 5), c("3", "draft"),
      c("4", "scheduled"), c("5", "cancelled"),
    ]);
    expect(s).toMatchObject({ total: 5, draft: 1, scheduled: 1, sent: 2, cancelled: 1, messagesSent: 15 });
  });
});
