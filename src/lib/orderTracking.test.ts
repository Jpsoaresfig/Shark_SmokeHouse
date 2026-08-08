import { describe, it, expect } from "vitest";
import {
  findStatusEvent,
  getTrackingSteps,
  getTrackingStatusMeta,
  getCancelReason,
  isCourierLocationFresh,
} from "@/lib/orderTracking";
import type { Order, OrderStatus } from "@/types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "abc123",
    customerId: "cust-1",
    customerName: "João",
    customerPhone: "83999999999",
    items: [{ productId: "p1", name: "Smash Burger", price: 30, image: "", quantity: 2 }],
    subtotal: 60,
    deliveryFee: 5,
    cardFee: 0,
    total: 65,
    status: "received",
    payment: {
      method: "on_delivery",
      provider: "manual",
      status: "pending",
      amount: 65,
      history: [],
    },
    paymentMethod: "on_delivery",
    paymentStatus: "pending",
    deliveryAddress: {
      id: "addr-1",
      label: "Casa",
      street: "Rua A",
      number: "10",
      neighborhood: "Centro",
      city: "São Paulo",
      state: "SP",
      zipCode: "00000-000",
    },
    createdAt: "2026-08-08T10:00:00.000Z",
    updatedAt: "2026-08-08T10:00:00.000Z",
    statusHistory: [],
    ...overrides,
  };
}

function withHistory(order: Order, events: { status: OrderStatus; timestamp: string; note?: string }[]): Order {
  return { ...order, statusHistory: events };
}

describe("getTrackingSteps", () => {
  it("pedido recebido (na entrega): só 'recebido' concluída, sem etapa de pagamento", () => {
    const steps = getTrackingSteps(makeOrder({ status: "received" }));
    const keys = steps.map((s) => s.key);
    // pagamento na entrega não tem etapa de confirmação online
    expect(keys).toEqual(["received", "preparing", "out_for_delivery", "delivered"]);
    expect(steps.filter((s) => s.done)).toHaveLength(1);
    expect(steps.find((s) => s.current)?.key).toBe("preparing");
  });

  it("pedido recebido (PIX): primeira etapa concluída, pagamento é a etapa atual", () => {
    const steps = getTrackingSteps(
      makeOrder({ status: "received", payment: { method: "pix_manual", provider: "manual", status: "pending", amount: 65, history: [] } }),
    );
    expect(steps.map((s) => s.key)).toEqual([
      "received",
      "payment_confirmed",
      "preparing",
      "out_for_delivery",
      "delivered",
    ]);
    expect(steps.filter((s) => s.done)).toHaveLength(1);
    expect(steps.find((s) => s.current)?.key).toBe("payment_confirmed");
  });

  it("pagamento confirmado por PIX avança a etapa de pagamento", () => {
    const order = makeOrder({
      status: "received",
      payment: {
        method: "pix_manual",
        provider: "manual",
        status: "paid",
        amount: 65,
        paidAt: "2026-08-08T10:05:00.000Z",
        history: [{ status: "paid", timestamp: "2026-08-08T10:05:00.000Z" }],
      },
    });
    const steps = getTrackingSteps(order);
    expect(steps.find((s) => s.key === "payment_confirmed")).toMatchObject({
      done: true,
      completedAt: "2026-08-08T10:05:00.000Z",
    });
    expect(steps.find((s) => s.current)?.key).toBe("preparing");
  });

  it("preparando (na entrega): recebido + preparação concluídas", () => {
    const order = makeOrder({ status: "preparing" });
    const steps = getTrackingSteps(order);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual([
      "received",
      "preparing",
    ]);
    expect(steps.find((s) => s.current)?.key).toBe("out_for_delivery");
  });

  it("preparando (PIX pago): recebido + pagamento + preparação concluídas", () => {
    const order = makeOrder({
      status: "preparing",
      payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 65, history: [] },
    });
    const steps = getTrackingSteps(order);
    expect(steps.filter((s) => s.done).map((s) => s.key)).toEqual([
      "received",
      "payment_confirmed",
      "preparing",
    ]);
    expect(steps.find((s) => s.current)?.key).toBe("out_for_delivery");
  });

  it("em rota: saiu para entrega é a etapa atual", () => {
    const order = makeOrder({ status: "out_for_delivery" });
    const steps = getTrackingSteps(order);
    expect(steps.find((s) => s.key === "out_for_delivery")?.done).toBe(true);
    expect(steps.find((s) => s.current)?.key).toBe("delivered");
  });

  it("entregue: todas concluídas e a entrega é a etapa de destaque", () => {
    const order = makeOrder({ status: "delivered" });
    const steps = getTrackingSteps(order);
    expect(steps.every((s) => s.done)).toBe(true);
    expect(steps.find((s) => s.current)?.key).toBe("delivered");
  });

  it("reserved: nada concluído, 'recebido' é a etapa atual", () => {
    const steps = getTrackingSteps(makeOrder({ status: "reserved" }));
    expect(steps.every((s) => s.done)).toBe(false);
    expect(steps.find((s) => s.current)?.key).toBe("received");
  });

  it("cancelled: timeline neutra, sem etapa atual", () => {
    const steps = getTrackingSteps(makeOrder({ status: "cancelled" }));
    expect(steps.some((s) => s.current)).toBe(false);
  });

  it("prepara timestamps a partir do statusHistory (não do status atual)", () => {
    const order = withHistory(
      makeOrder({ status: "preparing" }),
      [
        { status: "received", timestamp: "2026-08-08T10:00:00.000Z" },
        { status: "approved", timestamp: "2026-08-08T10:02:00.000Z" },
        { status: "preparing", timestamp: "2026-08-08T10:03:00.000Z" },
      ],
    );
    const steps = getTrackingSteps(order);
    expect(steps.find((s) => s.key === "preparing")?.completedAt).toBe("2026-08-08T10:03:00.000Z");
  });

  it("usa a data de criação como fallback do 'recebido' sem histórico", () => {
    const steps = getTrackingSteps(makeOrder({ status: "received" }));
    expect(steps.find((s) => s.key === "received")?.completedAt).toBe("2026-08-08T10:00:00.000Z");
  });
});

describe("getTrackingStatusMeta", () => {
  it("cancelado", () => {
    const meta = getTrackingStatusMeta(makeOrder({ status: "cancelled" }));
    expect(meta.title).toBe("Pedido cancelado");
    expect(meta.tone).toBe("destructive");
  });

  it("recebido com pagamento pendente → recebido", () => {
    const meta = getTrackingStatusMeta(makeOrder({ status: "received" }));
    expect(meta.title).toBe("Pedido recebido");
  });

  it("recebido com pagamento pago → pagamento confirmado", () => {
    const meta = getTrackingStatusMeta(
      makeOrder({
        status: "received",
        payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 65, history: [] },
      }),
    );
    expect(meta.title).toBe("Pagamento confirmado");
  });

  it("preparando → preparando seu pedido", () => {
    expect(getTrackingStatusMeta(makeOrder({ status: "preparing" })).title).toBe("Preparando seu pedido");
  });

  it("em rota → saiu para entrega", () => {
    expect(getTrackingStatusMeta(makeOrder({ status: "out_for_delivery" })).title).toBe(
      "Seu pedido saiu para entrega",
    );
  });

  it("entregue → entregue", () => {
    expect(getTrackingStatusMeta(makeOrder({ status: "delivered" })).title).toBe("Pedido entregue");
  });
});

describe("getCancelReason", () => {
  it("retorna a nota do evento de cancelamento", () => {
    const order = withHistory(
      makeOrder({ status: "cancelled" }),
      [{ status: "cancelled", timestamp: "2026-08-08T10:10:00.000Z", note: "Item fora do cardápio" }],
    );
    expect(getCancelReason(order)).toBe("Item fora do cardápio");
  });

  it("undefined quando não há histórico", () => {
    expect(getCancelReason(makeOrder({ status: "cancelled" }))).toBeUndefined();
  });
});

describe("findStatusEvent", () => {
  it("pega o evento mais recente do status", () => {
    const order = withHistory(
      makeOrder({ status: "preparing" }),
      [
        { status: "approved", timestamp: "2026-08-08T10:01:00.000Z" },
        { status: "preparing", timestamp: "2026-08-08T10:02:00.000Z" },
        { status: "preparing", timestamp: "2026-08-08T10:03:00.000Z" },
      ],
    );
    expect(findStatusEvent(order, "preparing")?.timestamp).toBe("2026-08-08T10:03:00.000Z");
  });
});

describe("isCourierLocationFresh", () => {
  const now = new Date("2026-08-08T12:00:00.000Z");

  it("fresca dentro de 5 minutos", () => {
    expect(isCourierLocationFresh({ updatedAt: "2026-08-08T11:57:00.000Z" }, now)).toBe(true);
  });

  it("velha após 5 minutos", () => {
    expect(isCourierLocationFresh({ updatedAt: "2026-08-08T11:54:59.000Z" }, now)).toBe(false);
  });

  it("ausente → falsa", () => {
    expect(isCourierLocationFresh(undefined, now)).toBe(false);
  });
});
