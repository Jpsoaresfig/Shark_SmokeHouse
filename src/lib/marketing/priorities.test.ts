import { describe, it, expect } from "vitest";
import {
  AUTOMATION_PRIORITY, AUTOMATION_EVENT_LABELS, CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS, CAMPAIGN_OBJECTIVE_LABELS, shouldSend,
} from "./priorities";
import type { MarketingAutomationEvent } from "@/types/marketing";

describe("shouldSend — anti-spam", () => {
  it("abaixo do limite permite enviar", () => {
    expect(shouldSend({ recentExecutions: 1, maxPerDay: 2, windowHours: 24 })).toEqual({ ok: true });
  });
  it("no limite bloqueia com motivo", () => {
    const r = shouldSend({ recentExecutions: 2, maxPerDay: 2, windowHours: 24 });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("anti-spam");
  });
  it("zero envios recentes sempre libera", () => {
    expect(shouldSend({ recentExecutions: 0, maxPerDay: 1, windowHours: 24 }).ok).toBe(true);
  });
});

describe("prioridade de automações — menor número vence", () => {
  it("boas-vindas antes de aniversário; promoção por último", () => {
    expect(AUTOMATION_PRIORITY.welcome).toBeLessThan(AUTOMATION_PRIORITY.birthday);
    expect(AUTOMATION_PRIORITY.birthday).toBeLessThan(AUTOMATION_PRIORITY.promo_product);
  });
  it("cada evento tem rótulo", () => {
    const events = Object.keys(AUTOMATION_PRIORITY) as MarketingAutomationEvent[];
    expect(events.length).toBe(Object.keys(AUTOMATION_EVENT_LABELS).length);
  });
});

describe("canais — apenas canais realmente suportados", () => {
  it("não oferece e-mail (envio não existe no módulo)", () => {
    expect(Object.keys(CAMPAIGN_CHANNEL_LABELS).sort()).toEqual(["app", "whatsapp"]);
  });
});

describe("rótulos completos da UI", () => {
  it("status e objetivos têm rótulo por valor", () => {
    expect(Object.keys(CAMPAIGN_STATUS_LABELS).sort()).toEqual([
      "cancelled", "draft", "scheduled", "sent",
    ]);
    expect(Object.keys(CAMPAIGN_OBJECTIVE_LABELS)).toContain("recover");
    expect(Object.keys(CAMPAIGN_OBJECTIVE_LABELS)).toContain("abandoned_cart");
  });
});
