import { describe, it, expect } from "vitest";
import type { CartItem, Category, Order, Product, Sale, SaleItem, SalePaymentMethod, UserProfile } from "@/types";
import {
  buildLines, buildTxnRows, computeSummary, computePeriodComparison,
  productRanking, sortProductRanking, categoryRanking, salesByWeekday,
  salesByHour, salesByNeighborhood, salesBySeller, salesByPayment,
  evolution, productGrowth, BI_PAYMENT_LABELS,
} from "./aggregate";
import type { BiFilters, BiSource } from "./types";

/* ── Fábrica de dados de teste ─────────────────────────────── */

function sale(over: { id: string; items: SaleItem[]; total: number; createdAt: string; paymentMethod: SalePaymentMethod } & Partial<Sale>): Sale {
  return {
    sellerId: "s1",
    sellerName: "Vendedor 1",
    paymentStatus: "paid",
    amountReceived: over.total,
    ...over,
  } as Sale;
}

function order(over: { id: string; items: CartItem[]; total: number; subtotal: number; createdAt: string } & Partial<Order>): Order {
  return {
    customerId: "c1",
    customerName: "Cliente",
    customerPhone: "83999000000",
    deliveryFee: 0,
    status: "delivered",
    payment: { method: "pix_manual", provider: "manual", status: "paid", amount: over.total, history: [] },
    deliveryAddress: { id: "a1", label: "Casa", street: "Rua A", number: "10", neighborhood: "Mangabeira", city: "João Pessoa", state: "PB", zipCode: "58000000" },
    statusHistory: [],
    updatedAt: over.createdAt,
    ...over,
  } as Order;
}

function product(over: { id: string; name: string } & Partial<Product>): Product {
  return {
    slug: over.id,
    description: "",
    images: [],
    category: "beverages",
    price: 0,
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  } as Product;
}

const item = (productId: string, productName: string, price: number, quantity: number, opts: { costPrice?: number; category?: string; subtotal?: number } = {}): SaleItem => ({
  productId,
  productName,
  category: opts.category ?? "beverages",
  price,
  quantity,
  subtotal: opts.subtotal ?? price * quantity,
  costPrice: opts.costPrice,
});

const cartItem = (productId: string, name: string, price: number, quantity: number): CartItem => ({
  productId, name, price, image: "", quantity,
});

function source(sales: Sale[], orders: Order[], products: Product[]): BiSource {
  const categories: Category[] = [
    { id: "beverages", slug: "beverages", label: "Bebidas" },
    { id: "acc", slug: "acc", label: "Acessórios" },
  ];
  const sellers: UserProfile[] = [
    { uid: "s1", email: "s1@x.com", displayName: "Vendedor 1", role: "seller", commissionRate: 5, createdAt: "", updatedAt: "" },
    { uid: "s2", email: "s2@x.com", displayName: "Vendedor 2", role: "seller", commissionRate: 0, createdAt: "", updatedAt: "" },
  ];
  return { sales, orders, products, categories, sellers };
}

const RANGE = { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-31T23:59:59Z") };
const NO_FILTERS: BiFilters = { origin: "all" };

describe("buildTxnRows — cancelamentos e estornos", () => {
  it("exclui venda PDV cancelada e pedido cancelado", () => {
    const s = source(
      [
        sale({ id: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s2", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix", paymentStatus: "cancelled" }),
      ],
      [
        order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 2)], total: 120, subtotal: 120, createdAt: "2026-03-01T12:00:00Z" }),
        order({ id: "o2", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", status: "cancelled" }),
        order({ id: "o3", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", payment: { method: "mercadopago", provider: "mercadopago", status: "refunded", amount: 60, history: [] } }),
      ],
      [product({ id: "p1", name: "Produto A", costPrice: 30, stock: 20, minStock: 5 }), product({ id: "p2", name: "Produto B", costPrice: 40, stock: 50, minStock: 10 })],
    );
    const rows = buildTxnRows(s, RANGE, NO_FILTERS);
    expect(rows).toHaveLength(2); // s1 e o1
    expect(rows.map((r) => r.transactionId)).toEqual(["s1", "o1"]);
  });

  it("pedido com pagamento falho/cancelado não conta", () => {
    const s = source(
      [],
      [
        order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "failed", amount: 60, history: [] } }),
        order({ id: "o2", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "cancelled", amount: 60, history: [] } }),
        order({ id: "o3", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 60, history: [] } }),
      ],
      [product({ id: "p2", name: "Produto B", costPrice: 40 })],
    );
    expect(buildTxnRows(s, RANGE, NO_FILTERS)).toHaveLength(1);
  });
});

describe("pedidos online — só finalizados (entregue + pago)", () => {
  const build = (): BiSource =>
    source(
      [],
      [
        // entregue + pago → conta
        order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z" }),
        // entregue mas pagamento aguardando comprovante → NÃO conta
        order({ id: "o2", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "awaiting_proof", amount: 60, history: [] } }),
        // pago mas ainda em rota → NÃO conta
        order({ id: "o3", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", status: "out_for_delivery" }),
        // pago mas em preparo → NÃO conta
        order({ id: "o4", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z", status: "preparing" }),
      ],
      [product({ id: "p2", name: "Produto B", costPrice: 40 })],
    );

  it("buildTxnRows conta apenas o entregue + pago", () => {
    const rows = buildTxnRows(build(), RANGE, NO_FILTERS);
    expect(rows.map((r) => r.transactionId)).toEqual(["o1"]);
  });

  it("buildLines também exclui pedidos não finalizados", () => {
    const lines = buildLines(build());
    expect(lines).toHaveLength(1);
    expect(lines[0].transactionId).toBe("o1");
  });

  it("resumo de faturamento ignora pedidos não finalizados", () => {
    const sum = computeSummary(build(), RANGE, NO_FILTERS);
    expect(sum.revenue).toBe(60);
    expect(sum.transactions).toBe(1);
  });
});

describe("computeSummary — faturamento, custo, lucro, margem", () => {
  it("soma PDV + online e calcula faturamento/lucro/margem/ticket", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 2)], total: 120, subtotal: 120, createdAt: "2026-03-01T12:00:00Z" })],
      [product({ id: "p1", name: "Produto A", costPrice: 30 }), product({ id: "p2", name: "Produto B", costPrice: 40 })],
    );
    const sum = computeSummary(s, RANGE, NO_FILTERS);
    expect(sum.revenue).toBe(220);
    expect(sum.cost).toBe(140);       // 60 (p1) + 80 (p2)
    expect(sum.profit).toBe(80);
    expect(sum.transactions).toBe(2);
    expect(sum.unitsSold).toBe(4);
    expect(sum.ticketAvg).toBe(110);
    expect(sum.margin).toBeCloseTo((80 / 220) * 100, 5);
  });

  it("com filtro de categoria, usa os subtotais dos itens do filtro", () => {
    const s = source(
      [sale({ id: "s1", items: [
        item("p1", "Produto A", 50, 2, { costPrice: 30, category: "beverages" }),
        item("p2", "Produto B", 20, 1, { costPrice: 5, category: "acc" }),
      ], total: 115, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [],
      [product({ id: "p1", name: "Produto A", costPrice: 30, category: "beverages" }), product({ id: "p2", name: "Produto B", costPrice: 5, category: "acc" })],
    );
    const sum = computeSummary(s, RANGE, { origin: "all", category: "beverages" });
    expect(sum.revenue).toBe(100);   // só o item beverages
    expect(sum.cost).toBe(60);
    expect(sum.transactions).toBe(1);
  });
});

describe("computePeriodComparison — comparação de períodos", () => {
  it("calcula variação % entre atual e anterior", () => {
    const s = source(
      [
        sale({ id: "s-old", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-02-10T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s-cur", items: [item("p1", "Produto A", 50, 3, { costPrice: 30 })], total: 150, createdAt: "2026-03-10T12:00:00Z", paymentMethod: "pix" }),
      ],
      [],
      [product({ id: "p1", name: "Produto A", costPrice: 30 })],
    );
    const cmp = computePeriodComparison(s, { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-31T23:59:59Z") }, NO_FILTERS);
    expect(cmp.current.revenue).toBe(150);
    expect(cmp.previous.revenue).toBe(100); // venda de fevereiro cai no período anterior equivalente
    expect(cmp.deltas.revenue).toBeCloseTo(50, 5);
  });

  it("retorna null na variação quando o anterior é zero", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-10T12:00:00Z", paymentMethod: "pix" })],
      [],
      [product({ id: "p1", name: "Produto A" })],
    );
    const cmp = computePeriodComparison(s, { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-31T23:59:59Z") }, NO_FILTERS);
    expect(cmp.previous.revenue).toBe(0);
    expect(cmp.deltas.revenue).toBeNull();
  });
});

describe("productRanking", () => {
  it("agrega por produto com faturamento/custo/lucro/margem/estoque", () => {
    const s = source(
      [sale({ id: "s1", items: [
        item("p1", "Produto A", 50, 2, { costPrice: 30 }),
        item("p1", "Produto A", 50, 1, { costPrice: 30 }),
      ], total: 150, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 2)], total: 120, subtotal: 120, createdAt: "2026-03-01T12:00:00Z" })],
      [product({ id: "p1", name: "Produto A", costPrice: 30, stock: 20 }), product({ id: "p2", name: "Produto B", costPrice: 40, stock: 50 })],
    );
    const rows = productRanking(s, RANGE, NO_FILTERS);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.productId === "p1")!;
    expect(a.quantity).toBe(3);
    expect(a.revenue).toBe(150);
    expect(a.cost).toBe(90);
    expect(a.profit).toBe(60);
    expect(a.margin).toBeCloseTo(40, 5);
    expect(a.stock).toBe(20);
  });

  it("ordena por quantidade desc por padrão e por modo", () => {
    const s = source(
      [sale({ id: "s1", items: [
        item("p1", "Produto A", 10, 5, { costPrice: 2 }),
        item("p2", "Produto B", 100, 2, { costPrice: 10 }),
        item("p3", "Produto C", 50, 3, { costPrice: 40 }),
      ], total: 0, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [],
      [product({ id: "p1", name: "Produto A", costPrice: 2 }), product({ id: "p2", name: "Produto B", costPrice: 10 }), product({ id: "p3", name: "Produto C", costPrice: 40 })],
    );
    const byQty = productRanking(s, RANGE, NO_FILTERS);
    expect(byQty.map((r) => r.productId)).toEqual(["p1", "p3", "p2"]);
    const byMargin = sortProductRanking(byQty, "margin_desc");
    // p3: 150 rev, 120 cost, margin 20%; p2: 200/20 → 90%; p1: 50/10 → 80%
    expect(byMargin.map((r) => r.productId)).toEqual(["p2", "p1", "p3"]);
    const byProfit = sortProductRanking(byQty, "profit_desc");
    // p2 profit 180, p3 30, p1 40 → ordem p2, p1, p3
    expect(byProfit.map((r) => r.productId)).toEqual(["p2", "p1", "p3"]);
  });
});

describe("categoryRanking", () => {
  it("agrega por categoria e usa o rótulo", () => {
    const s = source(
      [sale({ id: "s1", items: [
        item("p1", "Produto A", 50, 2, { costPrice: 30, category: "beverages" }),
        item("p2", "Produto B", 20, 1, { costPrice: 5, category: "acc" }),
      ], total: 0, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [],
      [product({ id: "p1", name: "Produto A", category: "beverages" }), product({ id: "p2", name: "Produto B", category: "acc" })],
    );
    const rows = categoryRanking(s, RANGE, NO_FILTERS);
    const bebidas = rows.find((r) => r.category === "beverages")!;
    expect(bebidas.label).toBe("Bebidas");
    expect(bebidas.quantity).toBe(2);
    expect(bebidas.revenue).toBe(100);
    expect(bebidas.profit).toBe(40);
  });
});

describe("dia da semana e horário", () => {
  it("agrupa por dia da semana (fuso da loja)", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-08T12:00:00Z", paymentMethod: "pix" })], // domingo
      [],
      [product({ id: "p1", name: "Produto A" })],
    );
    const rows = salesByWeekday(s, RANGE, NO_FILTERS);
    expect(rows[0].label).toBe("Domingo");
    expect(rows[0].transactions).toBe(1);
    expect(rows[0].revenue).toBe(50);
    expect(rows[0].ticketAvg).toBe(50);
  });

  it("agrupa por hora (fuso da loja)", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-08T12:00:00Z", paymentMethod: "pix" })], // 09:00 Fortaleza
      [],
      [product({ id: "p1", name: "Produto A" })],
    );
    const rows = salesByHour(s, RANGE, NO_FILTERS);
    expect(rows[9].transactions).toBe(1);
    expect(rows[9].revenue).toBe(50);
    expect(rows[8].transactions).toBe(0);
  });
});

describe("filtros combináveis", () => {
  const build = (): BiSource =>
    source(
      [
        sale({ id: "s1", sellerId: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s2", sellerId: "s2", items: [item("p2", "Produto B", 20, 1, { costPrice: 5 })], total: 20, createdAt: "2026-03-02T12:00:00Z", paymentMethod: "cash" }),
      ],
      [
        order({ id: "o1", items: [cartItem("p3", "Produto C", 30, 1)], total: 35, subtotal: 30, createdAt: "2026-03-03T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 35, history: [] } }),
      ],
      [product({ id: "p1", name: "Produto A", costPrice: 30 }), product({ id: "p2", name: "Produto B", costPrice: 5 }), product({ id: "p3", name: "Produto C", costPrice: 10 })],
    );

  it("origem PDV vs Online", () => {
    const s = build();
    expect(computeSummary(s, RANGE, { origin: "pdv" }).revenue).toBe(120);
    expect(computeSummary(s, RANGE, { origin: "online" }).revenue).toBe(35);
    expect(computeSummary(s, RANGE, { origin: "all" }).revenue).toBe(155);
  });

  it("por vendedor", () => {
    const s = build();
    expect(computeSummary(s, RANGE, { origin: "all", sellerId: "s1" }).revenue).toBe(100);
    expect(computeSummary(s, RANGE, { origin: "all", sellerId: "s2" }).revenue).toBe(20);
  });

  it("por forma de pagamento", () => {
    const s = build();
    expect(computeSummary(s, RANGE, { origin: "all", paymentMethod: "pix" }).revenue).toBe(100);
    expect(computeSummary(s, RANGE, { origin: "all", paymentMethod: "pix_manual" }).revenue).toBe(35);
  });

  it("por produto", () => {
    const s = build();
    const sum = computeSummary(s, RANGE, { origin: "all", productId: "p1" });
    expect(sum.revenue).toBe(100);
    expect(sum.transactions).toBe(1);
    expect(sum.unitsSold).toBe(2);
  });

  it("por bairro (somente pedidos online)", () => {
    const s = build();
    const rows = salesByNeighborhood(s, RANGE, NO_FILTERS);
    expect(rows).toHaveLength(1);
    expect(rows[0].neighborhood).toBe("Mangabeira");
    expect(rows[0].revenue).toBe(35);
    expect(computeSummary(s, RANGE, { origin: "all", neighborhood: "Mangabeira" }).revenue).toBe(35);
  });
});

describe("evolução", () => {
  it("agrupa por dia em período curto", () => {
    const s = source(
      [
        sale({ id: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-10T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s2", items: [item("p1", "Produto A", 50, 1, { costPrice: 30 })], total: 50, createdAt: "2026-03-11T12:00:00Z", paymentMethod: "pix" }),
      ],
      [],
      [product({ id: "p1", name: "Produto A", costPrice: 30 })],
    );
    const range = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-15T23:59:59Z") };
    const points = evolution(s, range, NO_FILTERS, "revenue");
    expect(points).toHaveLength(2);
    expect(points[0].label).toBe("10/03");
    expect(points[0].value).toBe(100);
    expect(points[1].value).toBe(50);
    const units = evolution(s, range, NO_FILTERS, "units");
    expect(units[0].value).toBe(2);
    const count = evolution(s, range, NO_FILTERS, "transactions");
    expect(count[0].value).toBe(1);
  });

  it("agrupa por mês em período longo", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 2)], total: 100, createdAt: "2026-03-10T12:00:00Z", paymentMethod: "pix" })],
      [],
      [product({ id: "p1", name: "Produto A" })],
    );
    const range = { start: new Date("2026-01-01T00:00:00Z"), end: new Date("2026-12-31T23:59:59Z") };
    const points = evolution(s, range, NO_FILTERS, "revenue");
    expect(points).toHaveLength(1);
    expect(points[0].label).toBe("Mar/26");
    expect(points[0].value).toBe(100);
  });
});

describe("produtos em alta e em queda", () => {
  const current = { start: new Date("2026-03-01T00:00:00Z"), end: new Date("2026-03-31T23:59:59Z") };
  const make = (sales: Sale[]): BiSource =>
    source(sales, [], [product({ id: "p1", name: "Produto A" }), product({ id: "p2", name: "Produto B" }), product({ id: "p3", name: "Produto C" }), product({ id: "p4", name: "Produto D" })]);

  it("identifica crescimento, queda e novos", () => {
    const s = make([
      // p1: subiu (2 → 5)
      sale({ id: "a1", items: [item("p1", "Produto A", 10, 2)], total: 20, createdAt: "2026-02-05T12:00:00Z", paymentMethod: "pix" }),
      sale({ id: "a2", items: [item("p1", "Produto A", 10, 5)], total: 50, createdAt: "2026-03-05T12:00:00Z", paymentMethod: "pix" }),
      // p2: caiu (4 → 1)
      sale({ id: "b1", items: [item("p2", "Produto B", 10, 4)], total: 40, createdAt: "2026-02-05T12:00:00Z", paymentMethod: "pix" }),
      sale({ id: "b2", items: [item("p2", "Produto B", 10, 1)], total: 10, createdAt: "2026-03-05T12:00:00Z", paymentMethod: "pix" }),
      // p3: novo no período atual
      sale({ id: "c1", items: [item("p3", "Produto C", 10, 3)], total: 30, createdAt: "2026-03-05T12:00:00Z", paymentMethod: "pix" }),
      // p4: zerou no período atual (caiu)
      sale({ id: "d1", items: [item("p4", "Produto D", 10, 4)], total: 40, createdAt: "2026-02-05T12:00:00Z", paymentMethod: "pix" }),
    ]);
    const { rising, falling } = productGrowth(s, current, NO_FILTERS);
    const r1 = rising.find((r) => r.productId === "p1")!;
    expect(r1.pct).toBeCloseTo(150, 5);
    const r3 = rising.find((r) => r.productId === "p3")!;
    expect(r3.isNew).toBe(true);
    expect(r3.pct).toBeNull();
    expect(rising.map((r) => r.productId)).toEqual(["p3", "p1"]);
    const f2 = falling.find((r) => r.productId === "p2")!;
    expect(f2.pct).toBeCloseTo(-75, 5);
    const f4 = falling.find((r) => r.productId === "p4")!;
    expect(f4.pct).toBeCloseTo(-100, 5);
    expect(falling.map((r) => r.productId)).toEqual(["p4", "p2"]);
  });
});

describe("vendedores e formas de pagamento", () => {
  it("salesBySeller soma vendas, lucro e comissão (só quitadas)", () => {
    const s = source(
      [
        sale({ id: "s1", sellerId: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s2", sellerId: "s1", items: [item("p1", "Produto A", 50, 1, { costPrice: 30 })], total: 50, createdAt: "2026-03-02T12:00:00Z", paymentMethod: "pix", paymentStatus: "pending", amountReceived: 0 }),
      ],
      [],
      [product({ id: "p1", name: "Produto A", costPrice: 30 })],
    );
    const rows = salesBySeller(s, RANGE, NO_FILTERS);
    expect(rows).toHaveLength(1);
    expect(rows[0].revenue).toBe(150);
    expect(rows[0].profit).toBe(60);
    // comissão só da quitada (5% de 100 = 5)
    expect(rows[0].commission).toBeCloseTo(5, 5);
  });

  it("salesByPayment agrega e calcula percentual", () => {
    const s = source(
      [
        sale({ id: "s1", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" }),
        sale({ id: "s2", items: [item("p1", "Produto A", 50, 1)], total: 50, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "cash" }),
      ],
      [order({ id: "o1", items: [cartItem("p1", "Produto A", 50, 1)], total: 55, subtotal: 50, createdAt: "2026-03-01T12:00:00Z", payment: { method: "pix_manual", provider: "manual", status: "paid", amount: 55, history: [] } })],
      [product({ id: "p1", name: "Produto A" })],
    );
    const rows = salesByPayment(s, RANGE, NO_FILTERS);
    const pix = rows.find((r) => r.method === "pix")!;
    const cash = rows.find((r) => r.method === "cash")!;
    const mp = rows.find((r) => r.method === "pix_manual")!;
    expect(BI_PAYMENT_LABELS[pix.method]).toBe("PIX");
    expect(BI_PAYMENT_LABELS[mp.method]).toBe("PIX (comprovante)");
    expect(pix.revenue).toBe(50);
    expect(cash.revenue).toBe(50);
    expect(mp.revenue).toBe(55);
    expect(pix.percent + cash.percent + mp.percent).toBeCloseTo(100, 5);
  });
});

describe("buildLines e filterLines", () => {
  it("monta linhas unificadas com custo congelado e categoria", () => {
    const s = source(
      [sale({ id: "s1", items: [item("p1", "Produto A", 50, 2, { costPrice: 30 })], total: 100, createdAt: "2026-03-01T12:00:00Z", paymentMethod: "pix" })],
      [order({ id: "o1", items: [cartItem("p2", "Produto B", 60, 1)], total: 60, subtotal: 60, createdAt: "2026-03-01T12:00:00Z" })],
      [product({ id: "p1", name: "Produto A", costPrice: 30, category: "beverages" }), product({ id: "p2", name: "Produto B", costPrice: 40, category: "acc" })],
    );
    const lines = buildLines(s);
    expect(lines).toHaveLength(2);
    const p1 = lines.find((l) => l.productId === "p1")!;
    expect(p1.costUnit).toBe(30);
    expect(p1.source).toBe("pdv");
    const p2 = lines.find((l) => l.productId === "p2")!;
    expect(p2.costUnit).toBe(40);
    expect(p2.source).toBe("online");
    expect(p2.category).toBe("acc");
  });
});
