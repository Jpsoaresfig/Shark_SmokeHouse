import { describe, it, expect } from "vitest";
import { planCampaign, planAutomations, type PlannerContext } from "./planner";
import { automationCouponCode } from "./ids";
import { baseContact } from "./contacts.fixture";
import type {
  MarketingAutomation, MarketingCampaign, MarketingCartSession, MarketingSegment, MarketingSettings,
} from "@/types/marketing";

function ctx(overrides: Partial<PlannerContext> = {}): PlannerContext {
  return {
    existing: new Set(),
    sentAutoUser: new Set(),
    recentByUser: new Map(),
    maxPerDay: 5,
    windowHours: 24,
    dayKey: "2026-08-09",
    ...overrides,
  };
}

function segment(overrides: Partial<MarketingSegment> = {}): MarketingSegment {
  return {
    id: "seg-1", name: "Todos", kind: "all", rules: [], userIds: [],
    active: true, createdAt: "", updatedAt: "", ...overrides,
  };
}

function campaign(overrides: Partial<MarketingCampaign> = {}): MarketingCampaign {
  return {
    id: "c1", name: "Promo", segmentId: "seg-1", objective: "promo",
    channel: "app", title: "Mimo 🦈", message: "Olá {{nome}}, cupom {{cupom}}",
    status: "scheduled", scheduledFor: "2026-08-09T00:00:00.000Z",
    createdAt: "", updatedAt: "", ...overrides,
  };
}

function automation(event: MarketingAutomation["event"], overrides: Partial<MarketingAutomation> = {}): MarketingAutomation {
  return {
    id: `a-${event}`, name: event, event, title: "Auto", message: "Oi {{nome}}",
    active: true, createdAt: "", updatedAt: "", ...overrides,
  };
}

function settings(overrides: Partial<MarketingSettings> = {}): MarketingSettings {
  return {
    active: true, maxPerDay: 5, windowHours: 24, minDaysBetweenAuto: 0,
    bigSpenderThreshold: 400, maxAudiencePerCampaign: 200, updatedAt: "",
    ...overrides,
  };
}

const now = new Date("2026-08-09T12:00:00Z");

describe("planCampaign", () => {
  it("envia para o público e renderiza o cupom", () => {
    const { planned, skipped } = planCampaign({
      campaign: campaign({ couponCode: "SHARK-123" }),
      segment: segment(),
      contacts: [baseContact({ uid: "u1", name: "Ana" })],
      ctx: ctx(),
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].message).toBe("Olá Ana, cupom SHARK-123");
    expect(planned[0].dedupKey).toBe("campaign:c1:u1");
    expect(skipped).toHaveLength(0);
  });

  it("não duplica cliente já executado (dedup)", () => {
    const { planned, skipped } = planCampaign({
      campaign: campaign(),
      segment: segment(),
      contacts: [baseContact({ uid: "u1" })],
      ctx: ctx({ existing: new Set(["campaign:c1:u1"]) }),
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toBe("dedup");
  });

  it("respeita o limite de público (cap)", () => {
    const { planned } = planCampaign({
      campaign: campaign(),
      segment: segment(),
      contacts: [baseContact({ uid: "a" }), baseContact({ uid: "b" }), baseContact({ uid: "c" })],
      ctx: ctx(),
      cap: 2,
    });
    expect(planned).toHaveLength(2);
  });

  it("bloqueia por anti-spam quando o cliente já recebeu o máximo", () => {
    const { planned, skipped } = planCampaign({
      campaign: campaign(),
      segment: segment(),
      contacts: [baseContact({ uid: "u1" })],
      ctx: ctx({ recentByUser: new Map([["u1", 2]]), maxPerDay: 2 }),
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toContain("anti-spam");
  });

  it("segmento inativo não envia nada", () => {
    const { planned } = planCampaign({
      campaign: campaign(),
      segment: segment({ active: false }),
      contacts: [baseContact({ uid: "u1" })],
      ctx: ctx(),
    });
    expect(planned).toHaveLength(0);
  });

  it("canal whatsapp nunca dispara notificação in-app", () => {
    const { planned, skipped } = planCampaign({
      campaign: campaign({ channel: "whatsapp" }),
      segment: segment(),
      contacts: [baseContact({ uid: "u1" })],
      ctx: ctx(),
    });
    expect(planned).toHaveLength(0);
    expect(skipped).toHaveLength(0);
  });
});

describe("planAutomations", () => {
  it("prioridade: cliente encaixado em 2 automações recebe só a de maior prioridade", () => {
    const { planned, skipped } = planAutomations({
      automations: [
        automation("big_spender"),
        automation("birthday"),
      ],
      contacts: [baseContact({ uid: "u1", birthdayInDays: 0, totalSpent: 500 })],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].automationEvent).toBe("birthday");
    expect(skipped.some((s) => s.reason.includes("outra automação hoje"))).toBe(true);
  });

  it("boas-vindas envia UMA vez por automação (não por dia)", () => {
    const welcome = automation("welcome");
    const { planned, skipped } = planAutomations({
      automations: [welcome],
      contacts: [baseContact({ uid: "u1", createdAt: "2026-08-08T00:00:00Z" })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ sentAutoUser: new Set([`auto:${welcome.id}:u1`]) }),
      now,
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toBe("dedup (envio único)");
  });

  it("carrinho abandonado usa as sessões recentes", () => {
    const sessions: MarketingCartSession[] = [
      { userId: "u1", itemsCount: 2, subtotal: 120, updatedAt: "2026-08-08T20:00:00Z" },
      { userId: "u2", itemsCount: 3, subtotal: 90, updatedAt: "2026-08-01T00:00:00Z" },
    ];
    const { planned } = planAutomations({
      automations: [automation("abandoned_cart", { config: { cartHours: 24 } })],
      contacts: [baseContact({ uid: "u1" }), baseContact({ uid: "u2" })],
      sessions,
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].userId).toBe("u1");
  });

  it("dedup por dia: mesma automação já executada hoje não repete", () => {
    const a = automation("birthday");
    const { planned, skipped } = planAutomations({
      automations: [a],
      contacts: [baseContact({ uid: "u1", birthdayInDays: 0 })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ existing: new Set([`auto:${a.id}:u1:2026-08-09`]) }),
      now,
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toBe("dedup");
  });

  it("couponsNeeded só inclui cupom de automação que vai enviar hoje", () => {
    const birthday = automation("birthday", {
      coupon: { type: "percent", value: 10, expiresInDays: 7 },
    });
    const bigSpender = automation("big_spender", {
      coupon: { type: "percent", value: 5, expiresInDays: 7 },
    });
    const { planned, couponsNeeded } = planAutomations({
      automations: [birthday, bigSpender],
      // u1 casa no birthday, mas não no big_spender (gasto 0 < threshold).
      contacts: [baseContact({ uid: "u1", birthdayInDays: 0, totalSpent: 0 })],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0].automationEvent).toBe("birthday");
    expect(couponsNeeded.has(automationCouponCode("birthday", ctx().dayKey))).toBe(true);
    expect(couponsNeeded.has(automationCouponCode("big_spender", ctx().dayKey))).toBe(false);
    expect(couponsNeeded.size).toBe(1);
  });
});
