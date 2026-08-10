import { describe, it, expect } from "vitest";
import { computeDashboard, isMarketingCoupon } from "./analytics";
import { baseContact } from "./contacts.fixture";
import type { BiRange } from "@/lib/bi/types";
import type { Coupon, CouponRedemption, Order, PaymentStatus } from "@/types";
import type { MarketingSettings } from "@/types/marketing";

function order(over: {
  id: string;
  total: number;
  createdAt: string;
  status?: Order["status"];
  paymentStatus?: PaymentStatus;
}): Order {
  return {
    customerId: "c1",
    customerName: "Cliente",
    customerPhone: "83999000000",
    items: [],
    subtotal: over.total,
    deliveryFee: 0,
    status: over.status ?? "delivered",
    payment: {
      method: "pix_manual",
      provider: "manual",
      status: over.paymentStatus ?? "paid",
      amount: over.total,
      history: [],
    },
    deliveryAddress: {
      id: "a1", label: "Casa", street: "Rua A", number: "10",
      neighborhood: "Mangabeira", city: "João Pessoa", state: "PB", zipCode: "58000000",
    },
    statusHistory: [],
    updatedAt: over.createdAt,
    id: over.id,
    total: over.total,
    createdAt: over.createdAt,
  } as unknown as Order;
}

function coupon(code: string, extra: Partial<Coupon> = {}): Coupon {
  return {
    id: code, code, type: "percent", value: 10,
    active: true, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
    ...extra,
  };
}

function redemption(c: Coupon, orderId: string): CouponRedemption {
  return {
    id: `${c.id}:${orderId}`, couponId: c.id, code: c.code,
    cpf: "000", userId: "u1", orderId, discount: 5,
    createdAt: "2026-08-05T12:00:00Z",
  };
}

function settings(): MarketingSettings {
  return {
    active: true, maxPerDay: 5, windowHours: 24, minDaysBetweenAuto: 0,
    bigSpenderThreshold: 400, maxAudiencePerCampaign: 200, updatedAt: "",
  };
}

const RANGE: BiRange = {
  start: new Date("2026-08-01T00:00:00Z"),
  end: new Date("2026-08-31T23:59:59Z"),
};

describe("computeDashboard — receita de cupons de marketing", () => {
  it("só considera pedidos entregues e pagos (mesmo critério do BI)", () => {
    const c = coupon("SHARK-MKT1", { source: "marketing" });
    const d = computeDashboard({
      contacts: [baseContact({ uid: "u1" })],
      campaigns: [],
      executions: [],
      coupons: [c],
      redemptions: [
        redemption(c, "o1"),
        redemption(c, "o2"),
        redemption(c, "o3"),
      ],
      orders: [
        order({ id: "o1", total: 100, createdAt: "2026-08-05T12:00:00Z", status: "delivered", paymentStatus: "paid" }),
        order({ id: "o2", total: 50, createdAt: "2026-08-06T12:00:00Z", status: "cancelled", paymentStatus: "cancelled" }),
        order({ id: "o3", total: 30, createdAt: "2026-08-07T12:00:00Z", status: "delivered", paymentStatus: "refunded" }),
      ],
      settings: settings(),
      range: RANGE,
    });
    expect(d.kpis.couponsUsed).toBe(3);
    expect(d.kpis.revenue).toBe(100);
  });

  it("cupom fora do módulo de marketing não gera receita", () => {
    const c = coupon("PROMO10");
    const d = computeDashboard({
      contacts: [baseContact({ uid: "u1" })],
      campaigns: [],
      executions: [],
      coupons: [c],
      redemptions: [redemption(c, "o1")],
      orders: [order({ id: "o1", total: 90, createdAt: "2026-08-05T12:00:00Z" })],
      settings: settings(),
      range: RANGE,
    });
    expect(d.kpis.revenue).toBe(0);
    expect(d.kpis.couponsUsed).toBe(0);
    expect(isMarketingCoupon(c)).toBe(false);
  });
});
