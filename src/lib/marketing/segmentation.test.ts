import { describe, it, expect } from "vitest";
import { buildContacts, evaluateRule, segmentMatches, resolveAudience } from "./segmentation";
import { baseContact } from "./contacts.fixture";
import type { MarketingSegment, MarketingSegmentRule } from "@/types/marketing";
import type { Order, UserProfile } from "@/types";

function segment(overrides: Partial<MarketingSegment> = {}): MarketingSegment {
  return {
    id: "seg-1",
    name: "Teste",
    kind: "rules",
    rules: [],
    userIds: [],
    active: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function user(uid: string): UserProfile {
  return {
    uid,
    email: `${uid}@teste.com`,
    displayName: `Cliente ${uid}`,
    role: "customer",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function order(uid: string, overrides: Partial<Order> = {}): Order {
  return {
    id: `o-${uid}`,
    customerId: uid,
    customerName: `Cliente ${uid}`,
    customerPhone: "83999999999",
    items: [],
    subtotal: 100,
    deliveryFee: 0,
    total: 100,
    status: "delivered",
    payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 100, history: [] },
    deliveryAddress: {
      id: "a1", label: "Casa", street: "Rua A", number: "10",
      neighborhood: "Centro", city: "João Pessoa", state: "PB", zipCode: "58000000",
    },
    statusHistory: [],
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-08-09T12:00:00.000Z");

describe("evaluateRule — comparações", () => {
  it("gt em número", () => {
    const rule: MarketingSegmentRule = { field: "totalSpent", op: "gt", value: 100 };
    expect(evaluateRule(baseContact({ totalSpent: 150 }), rule)).toBe(true);
    expect(evaluateRule(baseContact({ totalSpent: 100 }), rule)).toBe(false);
  });
  it("eq em string (nível)", () => {
    const rule: MarketingSegmentRule = { field: "loyaltyLevel", op: "eq", value: "Megalodon" };
    expect(evaluateRule(baseContact({ loyaltyLevel: "Megalodon" }), rule)).toBe(true);
    expect(evaluateRule(baseContact({ loyaltyLevel: "Baby Shark" }), rule)).toBe(false);
  });
  it("eq em categoria comprada usa 'contém'", () => {
    const rule: MarketingSegmentRule = { field: "purchasedCategory", op: "eq", value: "Charutos" };
    expect(evaluateRule(baseContact({ purchasedCategories: ["Narguile", "Charutos"] }), rule)).toBe(true);
    expect(evaluateRule(baseContact({ purchasedCategories: ["Narguile"] }), rule)).toBe(false);
  });
  it("gte em dias desde a última compra (null nunca casa)", () => {
    const rule: MarketingSegmentRule = { field: "lastOrderDays", op: "gte", value: 30 };
    expect(evaluateRule(baseContact({ lastOrderDays: 31 }), rule)).toBe(true);
    expect(evaluateRule(baseContact({ lastOrderDays: null }), rule)).toBe(false);
  });
});

describe("segmentMatches / resolveAudience", () => {
  it("kind=all inclui todos os ativos", () => {
    const s = segment({ kind: "all" });
    expect(resolveAudience(s, [baseContact({ uid: "a" }), baseContact({ uid: "b" })]).map((c) => c.uid)).toEqual(["a", "b"]);
  });
  it("kind=manual só a lista de uids", () => {
    const s = segment({ kind: "manual", userIds: ["a"] });
    expect(resolveAudience(s, [baseContact({ uid: "a" }), baseContact({ uid: "b" })])).toHaveLength(1);
  });
  it("kind=rules combina com AND", () => {
    const s = segment({
      rules: [
        { field: "totalSpent", op: "gte", value: 300 },
        { field: "loyaltyLevel", op: "eq", value: "Hunter Shark" },
      ],
    });
    expect(resolveAudience(s, [
      baseContact({ uid: "ok", totalSpent: 500, loyaltyLevel: "Hunter Shark" }),
      baseContact({ uid: "pouco", totalSpent: 50, loyaltyLevel: "Hunter Shark" }),
      baseContact({ uid: "nivel", totalSpent: 500, loyaltyLevel: "Baby Shark" }),
    ]).map((c) => c.uid)).toEqual(["ok"]);
  });
  it("segmento inativo não casa ninguém", () => {
    const s = segment({ kind: "all", active: false });
    expect(resolveAudience(s, [baseContact()])).toHaveLength(0);
  });
  it("preset carrinho_abandonado sem regras nunca casa por contato", () => {
    const s = segment({ preset: "carrinho_abandonado", kind: "rules", rules: [] });
    expect(segmentMatches(baseContact(), s)).toBe(false);
  });
});

describe("buildContacts — pedido só conta como compra se entregue e pago", () => {
  it("ignora em andamento, cancelados, pagamentos falhos e estornados", () => {
    const orders: Order[] = [
      order("u1", { id: "paid", total: 100 }),
      order("u1", { id: "reserved", status: "reserved", total: 50 }),
      order("u1", { id: "failed", total: 40, payment: { method: "pix_manual", provider: "manual", status: "failed", amount: 40, history: [] } }),
      order("u1", { id: "refunded", total: 60, payment: { method: "pix_manual", provider: "manual", status: "refunded", amount: 60, history: [] } }),
      order("u1", { id: "cancelled", status: "cancelled", total: 20 }),
    ];
    const contacts = buildContacts({ users: [user("u1")], orders, sales: [] }, NOW);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].ordersCount).toBe(1);
    expect(contacts[0].totalSpent).toBe(100);
    expect(contacts[0].lastOrderAt).toBe("2026-07-01T12:00:00.000Z");
  });

  it("pedido legado (sem payment) usa paymentStatus como fonte de pagamento", () => {
    const legacy = (id: string, paymentStatus: Order["paymentStatus"]): Order => ({
      ...order("u1", { id, paymentStatus }),
      payment: undefined as unknown as Order["payment"],
    });
    const orders: Order[] = [
      legacy("legacy-paid", "paid"),
      legacy("legacy-pending", "pending"),
    ];
    const contacts = buildContacts({ users: [user("u1")], orders, sales: [] }, NOW);
    expect(contacts[0].ordersCount).toBe(1);
    expect(contacts[0].totalSpent).toBe(100);
  });
});
