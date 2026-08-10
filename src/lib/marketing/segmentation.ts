/**
 * Segmentação de clientes do módulo de marketing — módulo puro e testável.
 *
 * Constrói contatos enriquecidos (gasto total, nº de pedidos, pontos, nível do
 * Clube Shark, inatividade, aniversário…) e avalia as regras de um segmento
 * contra esses contatos. Não importa Firebase — quem chama injeta os dados.
 */
import { getLevel } from "@/lib/loyalty/levels";
import { POINTS_VALIDITY_DAYS } from "@/lib/loyalty/levels";
import type { LoyaltyTransaction, Order, Product, Sale, UserProfile } from "@/types";
import type {
  MarketingContact,
  MarketingSegment,
  MarketingSegmentField,
  MarketingSegmentRule,
} from "@/types/marketing";

const DAY_MS = 86400000;

/** Normaliza uma data para ISO string (aceita Timestamp do Firestore). */
export function isoOf(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  const maybe = value as { toDate?: unknown };
  if (typeof maybe.toDate === "function") {
    const iso = maybe.toDate().toISOString();
    return iso;
  }
  return String(value);
}

/** Dias completos entre duas datas ISO (>= 0). Null quando faltam dados. */
function daysBetween(isoA: string | undefined, isoB: string): number | null {
  const a = isoA ? new Date(isoA).getTime() : NaN;
  const b = new Date(isoB).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((b - a) / DAY_MS));
}

/** Dias até o próximo aniversário (0 = hoje; null = sem data de nascimento). */
export function birthdayInDays(birthDate: string | undefined, now: Date): number | null {
  if (!birthDate || birthDate.length < 10) return null;
  const month = Number(birthDate.slice(5, 7));
  const day = Number(birthDate.slice(8, 10));
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month - 1, day);
  if (next.getTime() < current.getTime()) {
    next = new Date(now.getFullYear() + 1, month - 1, day);
  }
  return Math.max(0, Math.floor((next.getTime() - current.getTime()) / DAY_MS));
}

/** Dias até o lote de pontos mais próximo de expirar (null = nenhum expirando). */
export function pointsExpiringInDays(
  transactions: LoyaltyTransaction[],
  now: Date,
): number | null {
  let nearest: number | null = null;
  for (const tx of transactions) {
    if (typeof tx.points !== "number" || tx.points <= 0) continue;
    if (tx.expired === true) continue;
    const createdAt = isoOf(tx.createdAt);
    if (!createdAt) continue;
    const expiry = new Date(createdAt).getTime() + POINTS_VALIDITY_DAYS * DAY_MS;
    if (!Number.isFinite(expiry)) continue;
    const days = Math.ceil((expiry - now.getTime()) / DAY_MS);
    if (days < 0) continue; // já vencido — o cron de manutenção trata
    if (nearest == null || days < nearest) nearest = days;
  }
  return nearest;
}

export interface ContactInput {
  users: UserProfile[];
  orders: Order[];
  sales: Sale[];
  /** Opcional — produtos para resolver categoria/nome de itens de pedidos. */
  products?: Product[];
  /** Opcional — transações de fidelidade para "pontos próximos de expirar". */
  loyaltyTransactions?: LoyaltyTransaction[];
}

/** Soma do estoque de todas as variações de um produto (fallback p/ sem grade). */
function resolveProductCategory(products: Product[], productId: string): string | undefined {
  return products.find((p) => p.id === productId)?.category;
}

/**
 * Pedido online só conta como compra quando está FINALIZADO: entregue
 * (`status === "delivered"`) E com pagamento confirmado (`paid`) — a mesma
 * regra do BI (bi/aggregate.ts). Pedidos em andamento (reservado, aguardando
 * comprovante, em rota, preparando…), cancelados ou estornados (failed/refunded)
 * nunca contam como gasto/compra do cliente.
 */
function isPaidOrder(o: Order): boolean {
  if (o.status !== "delivered") return false;
  const legacyStatus = o.paymentStatus ?? "pending";
  return (o.payment?.status ?? legacyStatus) === "paid";
}

/**
 * Monta os contatos enriquecidos a partir dos dados brutos. Ignora usuários de
 * equipe (admin/seller/motoboy). Pedidos online entram SOMENTE quando finalizados
 * (entregue + pago) e vendas PDV quando não canceladas — capturando compras que
 * de fato geraram receita. As vendas entram apenas quando vinculadas a um
 * cliente (customerId).
 */
export function buildContacts(
  { users, orders, sales, products, loyaltyTransactions }: ContactInput,
  now: Date = new Date(),
): MarketingContact[] {
  const nowIso = now.toISOString();

  const ordersByUser = new Map<string, Order[]>();
  for (const o of orders) {
    if (!isPaidOrder(o)) continue;
    const list = ordersByUser.get(o.customerId) ?? [];
    list.push(o);
    ordersByUser.set(o.customerId, list);
  }

  const salesByUser = new Map<string, Sale[]>();
  for (const s of sales) {
    if (s.paymentStatus === "cancelled") continue;
    if (!s.customerId) continue;
    const list = salesByUser.get(s.customerId) ?? [];
    list.push(s);
    salesByUser.set(s.customerId, list);
  }

  const txByUser = new Map<string, LoyaltyTransaction[]>();
  if (loyaltyTransactions) {
    for (const tx of loyaltyTransactions) {
      const list = txByUser.get(tx.userId) ?? [];
      list.push(tx);
      txByUser.set(tx.userId, list);
    }
  }

  const contacts: MarketingContact[] = [];

  for (const u of users) {
    if (u.role && u.role !== "customer") continue;

    const userOrders = ordersByUser.get(u.uid) ?? [];
    const userSales = salesByUser.get(u.uid) ?? [];

    const orderDates = userOrders.map((o) => isoOf(o.createdAt)).filter(Boolean) as string[];
    const saleDates = userSales.map((s) => isoOf(s.createdAt)).filter(Boolean) as string[];
    const allDates = [...orderDates, ...saleDates];
    const sortedDates = [...allDates].sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );
    const firstDate = sortedDates[0];
    const latest = sortedDates[sortedDates.length - 1];

    const totalSpent =
      userOrders.reduce((sum, o) => sum + (o.total ?? 0), 0) +
      userSales.reduce((sum, s) => sum + (s.total ?? 0), 0);

    const ordersCount = userOrders.length + userSales.length;
    const lastOrderDays = latest ? daysBetween(latest, nowIso) : null;
    const createdAt = isoOf(u.createdAt);
    const daysSinceActivity =
      lastOrderDays ?? (createdAt ? daysBetween(createdAt, nowIso) : null) ?? 0;
    const birthdayMonth =
      u.birthDate && u.birthDate.length >= 7 ? Number(u.birthDate.slice(5, 7)) : null;
    const level = getLevel(u.loyaltyPoints ?? 0);

    // Último pedido/venda para valor e endereço.
    const allTx = [...userOrders, ...userSales];
    const lastTxn = latest ? allTx.find((t) => isoOf(t.createdAt) === latest) : undefined;

    const purchasedCategories = new Set<string>();
    const purchasedProducts = new Set<string>();
    for (const o of userOrders) {
      for (const it of o.items ?? []) {
        const cat = resolveProductCategory(products ?? [], it.productId);
        if (cat) purchasedCategories.add(cat);
        if (it.name) purchasedProducts.add(it.name);
      }
    }
    for (const s of userSales) {
      for (const it of s.items ?? []) {
        if (it.category) purchasedCategories.add(it.category);
        if (it.productName) purchasedProducts.add(it.productName);
      }
    }

    const city =
      (lastTxn && "deliveryAddress" in lastTxn && (lastTxn as Order).deliveryAddress?.city) ||
      u.addresses?.find((a) => a.isDefault)?.city ||
      u.addresses?.[0]?.city;
    const neighborhood =
      (lastTxn && "deliveryAddress" in lastTxn && (lastTxn as Order).deliveryAddress?.neighborhood) ||
      u.addresses?.find((a) => a.isDefault)?.neighborhood ||
      u.addresses?.[0]?.neighborhood;

    const lastOrderValue = lastTxn ? lastTxn.total ?? 0 : undefined;

    contacts.push({
      uid: u.uid,
      name: u.displayName || "Cliente",
      email: u.email ?? "",
      ...(u.phone ? { phone: u.phone } : {}),
      hasPhone: !!(u.phone && String(u.phone).trim()),
      hasCpf: !!(u.cpf && String(u.cpf).trim()),
      loyaltyPoints: u.loyaltyPoints ?? 0,
      loyaltyLevel: level.name,
      ordersCount,
      totalSpent: Math.round(totalSpent * 100) / 100,
      ticketAvg: ordersCount > 0 ? Math.round((totalSpent / ordersCount) * 100) / 100 : 0,
      ...(lastOrderValue != null ? { lastOrderValue } : {}),
      ...(latest ? { lastOrderAt: latest } : {}),
      lastOrderDays,
      ...(firstDate ? { firstOrderAt: firstDate } : {}),
      firstOrderDays: firstDate ? daysBetween(firstDate, nowIso) : null,
      daysSinceActivity,
      birthdayMonth,
      ...(u.birthDate ? { birthDate: u.birthDate } : {}),
      birthdayInDays: birthdayInDays(u.birthDate, now),
      pointsExpiringInDays: pointsExpiringInDays(txByUser.get(u.uid) ?? [], now),
      purchasedCategories: [...purchasedCategories],
      purchasedProducts: [...purchasedProducts],
      ...(city ? { city } : {}),
      ...(neighborhood ? { neighborhood } : {}),
      ...(u.referredBy ? { referredBy: u.referredBy } : {}),
      createdAt: createdAt ?? "",
    });
  }

  return contacts;
}

/** Valor atual de um campo do contato (para a regra). */
export function valueOf(
  contact: MarketingContact,
  field: MarketingSegmentField,
): string | number | boolean | null {
  switch (field) {
    case "totalSpent":
      return contact.totalSpent;
    case "ordersCount":
      return contact.ordersCount;
    case "ticketAvg":
      return contact.ticketAvg;
    case "lastOrderDays":
      return contact.lastOrderDays;
    case "firstOrderDays":
      return contact.firstOrderDays;
    case "lastOrderValue":
      return contact.lastOrderValue ?? 0;
    case "birthdayInDays":
      return contact.birthdayInDays;
    case "pointsExpiringInDays":
      return contact.pointsExpiringInDays;
    case "loyaltyPoints":
      return contact.loyaltyPoints;
    case "loyaltyLevel":
      return contact.loyaltyLevel;
    case "city":
      return contact.city ?? "";
    case "neighborhood":
      return contact.neighborhood ?? "";
    case "purchasedCategory":
      return contact.purchasedCategories.join(",");
    case "purchasedProduct":
      return contact.purchasedProducts.join(",");
    case "birthdayMonth":
      return contact.birthdayMonth;
    case "hasPhone":
      return contact.hasPhone;
    case "hasCpf":
      return contact.hasCpf;
  }
}

/** Avalia UMA regra contra um contato. Comparações de número usam >, >=, … */
export function evaluateRule(
  contact: MarketingContact,
  rule: MarketingSegmentRule,
): boolean {
  const actual = valueOf(contact, rule.field);
  const expected = rule.value;

  switch (rule.op) {
    case "eq": {
      // Campos de lista (categorias/produtos) usam "contém".
      if (rule.field === "purchasedCategory" || rule.field === "purchasedProduct") {
        if (typeof expected !== "string" || !expected.trim()) return false;
        return String(actual).split(",").some((item) =>
          item.trim().toLowerCase() === expected.trim().toLowerCase(),
        );
      }
      return actual === expected;
    }
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
  }
}

/** O contato pertence ao segmento? (all = todos; manual = lista de uids;
 *  rules = todas as regras combinadas com AND; sem regras = todos do segmento).
 *  Segurança: o preset "carrinho_abandonado" sem regras nunca casa ninguém por
 *  contato — o público dele vem das sessões de carrinho (avaliadas à parte). */
export function segmentMatches(contact: MarketingContact, segment: MarketingSegment): boolean {
  if (!segment.active) return false;
  if (segment.preset === "carrinho_abandonado" && segment.rules.length === 0) return false;
  if (segment.kind === "all") return true;
  if (segment.kind === "manual") return segment.userIds.includes(contact.uid);
  if (segment.rules.length === 0) return true;
  return segment.rules.every((rule) => evaluateRule(contact, rule));
}

/** Resolve o público de um segmento sobre a lista de contatos. */
export function resolveAudience(
  segment: MarketingSegment,
  contacts: MarketingContact[],
): MarketingContact[] {
  return contacts.filter((c) => segmentMatches(c, segment));
}
