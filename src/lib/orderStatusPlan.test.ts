import { describe, it, expect } from "vitest";
import {
  assertCanSetStatus,
  isUnpaidOnlinePayment,
  motoboyCanSetStatus,
  parseBusinessHours,
  planStatusChange,
  StatusChangeError,
  type StatusPlanOrder,
} from "@/lib/orderStatusPlan";

const base = (over: Partial<StatusPlanOrder> = {}): StatusPlanOrder => ({
  status: "received",
  stockApplied: true,
  ...over,
});

describe("planStatusChange", () => {
  it("cancelar com estoque baixado estorna e libera o cupom", () => {
    expect(planStatusChange(base(), "cancelled")).toEqual({
      stockMove: "in", clearAwaiting: false, releaseCoupon: true, refundPoints: 0,
    });
  });

  it("cancelar de novo um cancelado não repete efeitos", () => {
    const plan = planStatusChange(base({ status: "cancelled", stockApplied: false }), "cancelled");
    expect(plan).toEqual({ stockMove: null, clearAwaiting: false, releaseCoupon: false, refundPoints: 0 });
  });

  it("reabrir um cancelado baixa o estoque de novo", () => {
    const plan = planStatusChange(base({ status: "cancelled", stockApplied: false }), "received");
    expect(plan.stockMove).toBe("out");
    expect(plan.releaseCoupon).toBe(false);
  });

  it("avanço normal não mexe no estoque", () => {
    expect(planStatusChange(base(), "preparing").stockMove).toBeNull();
  });

  it("WhatsApp não confirmado levado adiante pela equipe baixa estoque e sai de 'aguardando'", () => {
    const order = base({ stockApplied: false, awaitingConfirmation: true });
    expect(planStatusChange(order, "preparing")).toMatchObject({ stockMove: "out", clearAwaiting: true });
    expect(planStatusChange(order, "delivered")).toMatchObject({ stockMove: "out", clearAwaiting: true });
    // Continuar em "recebido" ainda não conta como venda.
    expect(planStatusChange(order, "received")).toMatchObject({ stockMove: null, clearAwaiting: false });
  });

  it("WhatsApp não confirmado cancelado não estorna (nada foi baixado)", () => {
    const order = base({ stockApplied: false, awaitingConfirmation: true });
    expect(planStatusChange(order, "cancelled")).toMatchObject({ stockMove: null, releaseCoupon: true });
  });

  it("cancelar resgate estorna o estoque e devolve os pontos uma vez", () => {
    const order = base({ isRedemption: true, pointsRedeemed: 300 });
    expect(planStatusChange(order, "cancelled")).toMatchObject({ stockMove: "in", refundPoints: 300 });
    expect(planStatusChange({ ...order, pointsRefunded: true }, "cancelled").refundPoints).toBe(0);
  });

  it("resgate legado (stockApplied false) não baixa estoque ao avançar", () => {
    const order = base({ isRedemption: true, stockApplied: false });
    expect(planStatusChange(order, "delivered").stockMove).toBeNull();
  });

  it("não reabre resgate cujos pontos já voltaram", () => {
    const order = base({ status: "cancelled", isRedemption: true, pointsRefunded: true, stockApplied: false });
    expect(() => planStatusChange(order, "received")).toThrow(StatusChangeError);
  });
});

describe("permissões do motoboy", () => {
  const mine = (over: Partial<StatusPlanOrder> = {}) => base({ motoboyId: "m1", status: "preparing", ...over });

  it("só sai para entrega a partir de 'preparing'", () => {
    expect(motoboyCanSetStatus(mine(), "m1", "out_for_delivery")).toBe(true);
    expect(motoboyCanSetStatus(mine({ status: "received" }), "m1", "out_for_delivery")).toBe(false);
    expect(motoboyCanSetStatus(mine(), "outro", "out_for_delivery")).toBe(false);
  });

  it("bloqueia WhatsApp não confirmado e Mercado Pago sem pagamento", () => {
    expect(motoboyCanSetStatus(mine({ awaitingConfirmation: true }), "m1", "out_for_delivery")).toBe(false);
    const mp = mine({ payment: { method: "mercadopago", status: "pending" } });
    expect(isUnpaidOnlinePayment(mp)).toBe(true);
    expect(motoboyCanSetStatus(mp, "m1", "out_for_delivery")).toBe(false);
    expect(motoboyCanSetStatus(mine({ payment: { method: "mercadopago", status: "paid" } }), "m1", "out_for_delivery")).toBe(true);
  });

  it("entrega só depois de sair para entrega; não cancela", () => {
    expect(motoboyCanSetStatus(mine({ status: "out_for_delivery" }), "m1", "delivered")).toBe(true);
    expect(motoboyCanSetStatus(mine(), "m1", "delivered")).toBe(false);
    expect(motoboyCanSetStatus(mine(), "m1", "cancelled")).toBe(false);
  });

  it("admin/vendedor podem tudo; cliente nada", () => {
    expect(() => assertCanSetStatus("admin", "a", base(), "cancelled")).not.toThrow();
    expect(() => assertCanSetStatus("seller", "s", base(), "delivered")).not.toThrow();
    expect(() => assertCanSetStatus("customer", "c", base(), "cancelled")).toThrow(StatusChangeError);
  });
});

describe("parseBusinessHours", () => {
  it("descarta horários malformados e limita a 7 dias", () => {
    const parsed = parseBusinessHours({
      enabled: true,
      days: [{ open: "10:00", close: "22:00" }, { open: "x", close: "22:00" }, null, null, null, null, null, null],
    });
    expect(parsed?.enabled).toBe(true);
    expect(parsed?.days).toHaveLength(7);
    expect(parsed?.days[0]).toEqual({ open: "10:00", close: "22:00" });
    expect(parsed?.days[1]).toBeNull();
  });

  it("sem configuração = undefined (loja aberta)", () => {
    expect(parseBusinessHours(undefined)).toBeUndefined();
  });
});
