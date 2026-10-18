import { describe, it, expect } from "vitest";
import { planCampaign, planAutomations, resolvePromoProductName, type PlannerContext } from "./planner";
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

  it("limite de público é aplicado DEPOIS dos filtros (opt-out/dedup)", () => {
    const { planned } = planCampaign({
      campaign: campaign(),
      segment: segment(),
      contacts: [
        baseContact({ uid: "a", marketingOptOut: true }),
        baseContact({ uid: "b" }),
        baseContact({ uid: "c" }),
        baseContact({ uid: "d" }),
      ],
      ctx: ctx({ existing: new Set(["campaign:c1:b"]) }),
      cap: 2,
    });
    expect(planned.map((p) => p.userId)).toEqual(["c", "d"]);
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

  it("carrinho abandonado: parado há >= N horas e dentro da folga", () => {
    const sessions: MarketingCartSession[] = [
      // 30h parado (N=24) → entra
      { userId: "u1", itemsCount: 2, subtotal: 120, updatedAt: "2026-08-08T06:00:00Z" },
      // 8 dias → fora da folga
      { userId: "u2", itemsCount: 3, subtotal: 90, updatedAt: "2026-08-01T00:00:00Z" },
      // 2h → ainda não abandonado
      { userId: "u3", itemsCount: 1, subtotal: 50, updatedAt: "2026-08-09T10:00:00Z" },
    ];
    const { planned } = planAutomations({
      automations: [automation("abandoned_cart", { config: { cartHours: 24 } })],
      contacts: [baseContact({ uid: "u1" }), baseContact({ uid: "u2" }), baseContact({ uid: "u3" })],
      sessions,
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned.map((p) => p.userId)).toEqual(["u1"]);
  });

  it("carrinho abandonado com N<24 pega carrinho da noite anterior (cron diário)", () => {
    // Cron às 16:00Z; carrinho largado às 23:00Z do dia anterior; N = 2h.
    const sessions: MarketingCartSession[] = [
      { userId: "u1", itemsCount: 2, subtotal: 120, updatedAt: "2026-08-08T23:00:00Z" },
    ];
    const { planned } = planAutomations({
      automations: [automation("abandoned_cart", { config: { cartHours: 2 } })],
      contacts: [baseContact({ uid: "u1" })],
      sessions,
      settings: settings(),
      ctx: ctx(),
      now: new Date("2026-08-09T16:00:00Z"),
    });
    expect(planned).toHaveLength(1);
  });

  it("carrinho abandonado não repete o lembrete do mesmo carrinho", () => {
    const a = automation("abandoned_cart", { config: { cartHours: 2 } });
    const cartAt = new Date("2026-08-08T23:00:00Z").getTime();
    const { planned, skipped } = planAutomations({
      automations: [a],
      contacts: [baseContact({ uid: "u1" })],
      sessions: [{ userId: "u1", itemsCount: 2, subtotal: 120, updatedAt: "2026-08-08T23:00:00Z" }],
      settings: settings(),
      ctx: ctx({ lastSentByAutoUser: new Map([[`auto:${a.id}:u1`, cartAt + 3 * 3600_000]]) }),
      now: new Date("2026-08-09T16:00:00Z"),
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toContain("ciclo");
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
    expect(couponsNeeded.has(automationCouponCode(birthday.id, "birthday", ctx().dayKey))).toBe(true);
    expect(couponsNeeded.has(automationCouponCode(bigSpender.id, "big_spender", ctx().dayKey))).toBe(false);
    expect(couponsNeeded.size).toBe(1);
  });
});

describe("LGPD / correções do planner", () => {
  it("opt-out nunca recebe campanha", () => {
    const { planned, skipped } = planCampaign({
      campaign: campaign(),
      segment: segment(),
      contacts: [baseContact({ uid: "u1", marketingOptOut: true }), baseContact({ uid: "u2" })],
      ctx: ctx(),
    });
    expect(planned.map((p) => p.userId)).toEqual(["u2"]);
    expect(skipped[0]).toEqual({ userId: "u1", reason: "opt-out (LGPD)" });
  });

  it("opt-out nunca recebe automação", () => {
    const { planned } = planAutomations({
      automations: [automation("big_spender")],
      contacts: [baseContact({ uid: "u1", totalSpent: 9999, marketingOptOut: true })],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned).toHaveLength(0);
  });

  it("aniversário não repete nos dias seguintes da janela", () => {
    const a = automation("birthday", { config: { birthdayDaysBefore: 3 } });
    const yesterday = now.getTime() - 86400000;
    const { planned, skipped } = planAutomations({
      automations: [a],
      contacts: [baseContact({ uid: "u1", birthdayInDays: 2 })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ lastSentByAutoUser: new Map([[`auto:${a.id}:u1`, yesterday]]) }),
      now,
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toContain("aniversário");
  });

  it("{{produto}} usa o nome do produto, não o id", () => {
    const a = automation("promo_product", {
      message: "Oferta de {{produto}}",
      config: { productId: "p1", promoAudience: "never_bought" },
    });
    const { planned } = planAutomations({
      automations: [a],
      contacts: [baseContact({ uid: "u1", ordersCount: 0 })],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
      products: [{ id: "p1", name: "Essência Zomo" }],
    });
    expect(planned[0].message).toBe("Oferta de Essência Zomo");
  });

  it("{{produto}} resolve o NOME gravado pelo painel e filtra quem comprou", () => {
    const a = automation("promo_product", {
      message: "Oferta de {{produto}}",
      config: { productId: "essência zomo", promoAudience: "previous_buyers" },
    });
    const { planned } = planAutomations({
      automations: [a],
      contacts: [
        baseContact({ uid: "u1", ordersCount: 2, purchasedProducts: ["Essência Zomo"] }),
        baseContact({ uid: "u2", ordersCount: 2, purchasedProducts: ["Carvão"] }),
      ],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
      products: [{ id: "p1", name: "Essência Zomo" }],
    });
    expect(planned.map((p) => p.userId)).toEqual(["u1"]);
    expect(planned[0].message).toBe("Oferta de Essência Zomo");
  });

  it("resolvePromoProductName: id, nome e id desconhecido", () => {
    const products = [{ id: "p1", name: "Essência Zomo" }];
    expect(resolvePromoProductName("p1", products)).toBe("Essência Zomo");
    expect(resolvePromoProductName("ESSÊNCIA ZOMO", products)).toBe("Essência Zomo");
    expect(resolvePromoProductName("Narguile X", products)).toBe("Narguile X");
    expect(resolvePromoProductName("aB3xY9aB3xY9aB3xY9aB", products)).toBeUndefined();
  });

  it("big_spender não reenvia a cada intervalo (carência de 180 dias)", () => {
    const a = automation("big_spender");
    const tenDaysAgo = now.getTime() - 10 * 86400000;
    const { planned, skipped } = planAutomations({
      automations: [a],
      contacts: [baseContact({ uid: "u1", totalSpent: 900 })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ lastSentByAutoUser: new Map([[`auto:${a.id}:u1`, tenDaysAgo]]) }),
      now,
    });
    expect(planned).toHaveLength(0);
    expect(skipped[0].reason).toContain("180d");
  });

  it("inactive_60: 1 envio por período sem compra; nova compra libera de novo", () => {
    const a = automation("inactive_60");
    const sentAt = now.getTime() - 20 * 86400000;
    const base = { uid: "u1", daysSinceActivity: 90 };
    const blocked = planAutomations({
      automations: [a],
      contacts: [baseContact({ ...base, lastOrderAt: "2026-05-10T00:00:00Z" })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ lastSentByAutoUser: new Map([[`auto:${a.id}:u1`, sentAt]]) }),
      now,
    });
    expect(blocked.planned).toHaveLength(0);

    // Comprou depois do último envio (e ficou inativo de novo) → novo ciclo.
    const again = planAutomations({
      automations: [a],
      contacts: [baseContact({ ...base, lastOrderAt: new Date(sentAt + 86400000).toISOString() })],
      sessions: [],
      settings: settings(),
      ctx: ctx({ lastSentByAutoUser: new Map([[`auto:${a.id}:u1`, sentAt]]) }),
      now,
    });
    expect(again.planned).toHaveLength(1);
  });

  it("limite por automação é aplicado depois dos filtros", () => {
    const { planned } = planAutomations({
      automations: [automation("big_spender")],
      contacts: [
        baseContact({ uid: "a", totalSpent: 900, marketingOptOut: true }),
        baseContact({ uid: "b", totalSpent: 900 }),
      ],
      sessions: [],
      settings: settings({ maxAudiencePerCampaign: 1 }),
      ctx: ctx(),
      now,
    });
    expect(planned.map((p) => p.userId)).toEqual(["b"]);
  });

  it("pontos expirando ignora quem está com saldo zero", () => {
    const { planned } = planAutomations({
      automations: [automation("points_expiring")],
      contacts: [baseContact({ uid: "u1", loyaltyPoints: 0, pointsExpiringInDays: 2 })],
      sessions: [],
      settings: settings(),
      ctx: ctx(),
      now,
    });
    expect(planned).toHaveLength(0);
  });
});
