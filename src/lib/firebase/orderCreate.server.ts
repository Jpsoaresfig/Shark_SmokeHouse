import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkOrderPricing, type PricingProduct } from "@/lib/payments/pricing";
import { installmentFeePercent, DEFAULT_INSTALLMENT_FEES } from "@/lib/payments/installments";
import { manualGateway } from "@/lib/payments/manual";
import { mercadopagoGateway } from "@/lib/payments/mercadopago";
import { DEFAULT_DELIVERY_AREAS } from "@/lib/firebase/delivery.defaults";
import { normalizeCouponCode } from "@/lib/coupons";
import { findStockShortages, describeShortages } from "@/lib/stock";
import type { Address, CartItem, Coupon, InstallmentFee, PaymentMethod, Product } from "@/types";

/**
 * Criação de pedido NO SERVIDOR (Admin SDK).
 *
 * Antes o pedido era gravado pelo navegador, então preço dos itens, frete, taxa
 * de cartão, desconto e total eram dados do cliente — só o PIX do Mercado Pago
 * era conferido antes de cobrar; nos métodos manuais (PIX manual, maquininha,
 * na entrega, WhatsApp) a equipe via e cobrava o total que o cliente escreveu.
 * Aqui, antes de gravar:
 *   1. o uid vem do token (nunca do corpo);
 *   2. preços, frete, taxa de cartão, cupom e total são recalculados a partir
 *      do catálogo/configurações (`checkOrderPricing`) — divergência = recusa;
 *   3. o pagamento é montado pelo servidor (status inicial nunca "pago");
 *   4. estoque, pedido e uso do cupom são gravados numa ÚNICA transação.
 */

/** Métodos aceitos no checkout (legados e "loyalty" não são criados por aqui). */
const CHECKOUT_METHODS: PaymentMethod[] = [
  "pix_manual", "on_delivery", "credit", "debit", "whatsapp", "mercadopago",
];

export class OrderCreateError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "stock" | "pricing",
    readonly problems: string[] = [],
  ) {
    super(message);
    this.name = "OrderCreateError";
  }
}

/** Corpo aceito pela rota (o restante do pedido é derivado no servidor). */
export interface OrderCreateInput {
  customerName?: unknown;
  customerPhone?: unknown;
  items?: unknown;
  subtotal?: unknown;
  deliveryFee?: unknown;
  cardFee?: unknown;
  discount?: unknown;
  total?: unknown;
  reserved?: unknown;
  paymentMethod?: unknown;
  installments?: unknown;
  deliveryAddress?: unknown;
  notes?: unknown;
  pointsEarned?: unknown;
  couponCode?: unknown;
  couponCpf?: unknown;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function sanitizeItems(raw: unknown): CartItem[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 100) {
    throw new OrderCreateError("Carrinho inválido.", "invalid");
  }
  return raw.map((r) => {
    const it = (r ?? {}) as Record<string, unknown>;
    const productId = str(it.productId, 128);
    const quantity = Number(it.quantity);
    if (!productId || productId.includes("/") || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new OrderCreateError("Item do carrinho inválido.", "invalid");
    }
    const mult = Number(it.pointsMultiplier);
    const pts = Number(it.pointsEarned);
    return stripUndefined({
      productId,
      name: str(it.name, 200),
      price: num(it.price),
      image: str(it.image, 1000),
      quantity,
      color: str(it.color, 120) || undefined,
      variationId: str(it.variationId, 128) || undefined,
      variationSku: str(it.variationSku, 128) || undefined,
      notes: str(it.notes, 500) || undefined,
      pointsEarned: Number.isFinite(pts) && pts >= 0 ? pts : undefined,
      pointsMultiplier: mult === 2 ? 2 : undefined,
    }) as CartItem;
  });
}

function sanitizeAddress(raw: unknown): Address {
  const a = (raw ?? {}) as Record<string, unknown>;
  if (a.id === "pickup") {
    return {
      id: "pickup", label: "Retirada na loja",
      street: "", number: "", neighborhood: "", city: "", state: "", zipCode: "",
    };
  }
  const addr = stripUndefined({
    id: str(a.id, 64) || `addr_${Date.now()}`,
    label: str(a.label, 60) || "Entrega",
    street: str(a.street, 200),
    number: str(a.number, 20),
    complement: str(a.complement, 120) || undefined,
    neighborhood: str(a.neighborhood, 120),
    city: str(a.city, 120),
    state: str(a.state, 40),
    zipCode: str(a.zipCode, 12),
  }) as Address;
  if (!addr.street || !addr.number || !addr.neighborhood || !addr.city) {
    throw new OrderCreateError("Endereço de entrega incompleto.", "invalid");
  }
  return addr;
}

/** Aplica a baixa de estoque nos dados do produto (mesma regra do client: com
 *  grade, o estoque do produto é a soma das variações). */
function stockUpdateFor(product: Product, items: CartItem[]) {
  const mine = items.filter((i) => i.productId === product.id);
  let variations = product.variations;
  let stock = Number(product.stock) || 0;
  const byVariation = mine.filter((i) => i.variationId);
  const plain = mine.filter((i) => !i.variationId);
  if (byVariation.length && variations?.length) {
    variations = variations.map((v) => {
      const qty = byVariation.filter((i) => i.variationId === v.id).reduce((s, i) => s + i.quantity, 0);
      return qty ? { ...v, stock: Math.max(0, (v.stock ?? 0) - qty) } : v;
    });
    stock = variations.reduce((s, v) => s + (v.stock ?? 0), 0);
  }
  const plainQty = plain.reduce((s, i) => s + i.quantity, 0);
  if (plainQty) stock = Math.max(0, stock - plainQty);
  return { stock, ...(variations && byVariation.length ? { variations } : {}) };
}

export async function createOrderAdmin(
  uid: string,
  input: OrderCreateInput,
): Promise<{ id: string; total: number }> {
  const db = getAdminDb();

  const method = str(input.paymentMethod, 32) as PaymentMethod;
  if (!CHECKOUT_METHODS.includes(method)) {
    throw new OrderCreateError("Forma de pagamento inválida.", "invalid");
  }
  const items = sanitizeItems(input.items);
  const deliveryAddress = sanitizeAddress(input.deliveryAddress);
  const customerPhone = str(input.customerPhone, 30);
  const phoneDigits = customerPhone.replace(/\D/g, "");
  if (phoneDigits.length < 10 || phoneDigits.length > 13) {
    throw new OrderCreateError("Informe um WhatsApp válido com DDD.", "invalid");
  }
  const installments = method === "credit"
    ? Math.min(24, Math.max(1, Math.floor(Number(input.installments) || 1)))
    : undefined;
  const couponCode = normalizeCouponCode(str(input.couponCode, 64));
  const couponCpf = str(input.couponCpf, 20).replace(/\D/g, "");
  const discountIn = num(input.discount ?? 0);

  /* ── Fontes oficiais: catálogo, bairros, configurações, cupom ── */
  const ids = [...new Set(items.map((i) => i.productId))];
  const productRefs = ids.map((id) => db.collection("products").doc(id));
  const [productSnaps, areasSnap, settingsSnap, userSnap] = await Promise.all([
    db.getAll(...productRefs),
    db.collection("deliveryAreas").get(),
    db.collection("settings").doc("site").get(),
    db.collection("users").doc(uid).get(),
  ]);

  const products = new Map<string, PricingProduct>();
  for (const snap of productSnaps) {
    if (!snap.exists) continue;
    const d = snap.data() ?? {};
    if (d.active === false) continue; // produto desativado não pode ser comprado
    products.set(snap.id, {
      id: snap.id,
      price: Number(d.price),
      category: String(d.category ?? ""),
      variations: Array.isArray(d.variations) ? d.variations : undefined,
    });
  }
  const deliveryAreas = areasSnap.empty
    ? DEFAULT_DELIVERY_AREAS.map((a) => ({ ...a, active: true }))
    : areasSnap.docs.map((d) => {
        const a = d.data();
        return { name: String(a.name ?? ""), fee: Number(a.fee) || 0, active: a.active as boolean | undefined };
      });
  const settings = settingsSnap.data() ?? {};
  const cart = settings.cart as { freeShippingEnabled?: boolean; freeShippingThreshold?: number } | undefined;
  const pay = (settings.payment ?? {}) as {
    pixKey?: string; pixName?: string;
    creditFeePercent?: number; debitFeePercent?: number;
    creditInstallmentFees?: InstallmentFee[];
  };
  // Mesmos defaults de lib/firebase/settings (DEFAULT_SETTINGS).
  const freeShipping = {
    enabled: cart?.freeShippingEnabled ?? true,
    threshold: Number(cart?.freeShippingThreshold ?? 150) || 0,
  };
  const cardFeePercent =
    method === "credit"
      ? ((installments ?? 1) > 1
          ? installmentFeePercent(pay.creditInstallmentFees ?? DEFAULT_INSTALLMENT_FEES, installments ?? 1)
          : Number(pay.creditFeePercent ?? 0) || 0)
      : method === "debit" ? Number(pay.debitFeePercent ?? 0) || 0
      : 0;

  let coupon: Coupon | null = null;
  let priorCouponUses = 0;
  if (couponCode && discountIn > 0) {
    const cSnap = await db.collection("coupons").doc(couponCode).get();
    if (cSnap.exists) coupon = { ...(cSnap.data() as Coupon), id: cSnap.id };
    if (coupon && coupon.usageLimitPerCpf != null) {
      const [byCpf, byUser] = await Promise.all([
        couponCpf
          ? db.collection("couponRedemptions").where("couponId", "==", coupon.id).where("cpf", "==", couponCpf).count().get()
          : Promise.resolve(null),
        db.collection("couponRedemptions").where("couponId", "==", coupon.id).where("userId", "==", uid).count().get(),
      ]);
      priorCouponUses = Math.max(byCpf?.data().count ?? 0, byUser.data().count);
    }
  }

  const order = {
    items,
    subtotal: num(input.subtotal),
    deliveryFee: num(input.deliveryFee ?? 0),
    cardFee: num(input.cardFee ?? 0),
    discount: discountIn > 0 ? discountIn : undefined,
    total: num(input.total),
    deliveryAddress,
  };
  const pricing = checkOrderPricing(order, {
    products,
    deliveryAreas,
    freeShipping,
    coupon,
    priorCouponUses,
    couponCpf,
    cardFeePercent,
  });
  if (!pricing.ok) {
    throw new OrderCreateError(
      "Os valores do pedido mudaram (preço, frete ou cupom). Atualize a página, confira o total e tente novamente.",
      "pricing",
      pricing.problems,
    );
  }

  /* ── Pagamento e metadados montados pelo servidor ── */
  const total = pricing.expectedTotal;
  const gateway = method === "mercadopago" ? mercadopagoGateway : manualGateway;
  const payment = gateway.createPayment({
    method,
    amount: total,
    pixKey: pay.pixKey,
    pixName: pay.pixName,
    ...(installments ? { installments } : {}),
  });
  const reserved = input.reserved === true;
  const status = reserved ? "reserved" : "received";
  const awaitingConfirmation = method === "whatsapp";
  const applyStock = !awaitingConfirmation;
  const profile = userSnap.data() ?? {};
  const customerName =
    str(input.customerName, 120) || String(profile.displayName ?? "").slice(0, 120) || "Cliente";
  const pointsEarned = Math.max(0, Math.floor(Number(input.pointsEarned) || 0));

  const orderRef = db.collection("orders").doc();
  const data = stripUndefined({
    customerId: uid,
    customerName,
    customerPhone,
    items,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    cardFee: order.cardFee,
    discount: order.discount,
    total,
    status,
    payment,
    paymentMethod: method,          // espelho legado
    paymentStatus: payment.status,  // espelho legado
    deliveryAddress,
    notes: str(input.notes, 1000) || undefined,
    statusHistory: [{
      status,
      timestamp: new Date().toISOString(),
      note: reserved ? "Pedido reservado fora do horário — aguardando a loja abrir" : "",
    }],
    pointsEarned,
    ...(awaitingConfirmation ? { awaitingConfirmation: true } : {}),
    // Nasce sem motoboy para aparecer no pool de entregas disponíveis (a query
    // por igualdade do pool exige o null explícito).
    motoboyId: null,
    motoboyName: null,
    stockApplied: applyStock,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  /* ── Estoque + pedido + uso do cupom: tudo ou nada ── */
  await db.runTransaction(async (tx) => {
    if (applyStock) {
      const snaps = await tx.getAll(...productRefs);
      const fresh = snaps
        .filter((s) => s.exists)
        .map((s) => ({ id: s.id, ...(s.data() as Omit<Product, "id">) }) as Product);
      const shortages = findStockShortages(items, fresh);
      if (shortages.length) {
        throw new OrderCreateError(
          `Estoque insuficiente — ${describeShortages(shortages)}. Ajuste o carrinho para continuar.`,
          "stock",
        );
      }
      for (const product of fresh) {
        tx.update(productRefs.find((r) => r.id === product.id) as DocumentReference, {
          ...stockUpdateFor(product, items),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    tx.create(orderRef, data);
    if (coupon && order.discount) {
      tx.create(db.collection("couponRedemptions").doc(), {
        couponId: coupon.id,
        code: coupon.code ?? coupon.id,
        cpf: couponCpf,
        userId: uid,
        orderId: orderRef.id,
        discount: order.discount,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { id: orderRef.id, total };
}

/**
 * Cliente confirma que concluiu a compra combinada pelo WhatsApp: tira o pedido
 * de "aguardando confirmação" e baixa o estoque — tudo numa transação no
 * servidor (a flag `stockApplied` impede baixar duas vezes num duplo clique).
 * Só o dono do pedido pode confirmar.
 */
export async function confirmWhatsappOrderAdmin(uid: string, orderId: string): Promise<void> {
  const db = getAdminDb();
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.data() as
      | { customerId?: string; status?: string; stockApplied?: boolean; isRedemption?: boolean; items?: CartItem[] }
      | undefined;
    if (!current || current.customerId !== uid) {
      throw new OrderCreateError("Pedido não encontrado.", "invalid");
    }
    if (current.status === "cancelled") return;
    const needsStock = !current.stockApplied && !current.isRedemption;
    const items = (current.items ?? []).filter((i) => i.productId && Number(i.quantity) > 0);
    const productRefs = needsStock
      ? [...new Set(items.map((i) => i.productId))].map((id) => db.collection("products").doc(id))
      : [];
    // Todas as leituras antes das escritas (exigência das transações).
    const snaps = productRefs.length ? await tx.getAll(...productRefs) : [];
    const now = new Date().toISOString();
    tx.update(ref, {
      awaitingConfirmation: false,
      statusHistory: FieldValue.arrayUnion({
        status: "received",
        timestamp: now,
        note: "Compra confirmada pelo cliente (WhatsApp)",
      }),
      "payment.history": FieldValue.arrayUnion({
        status: "in_negotiation",
        timestamp: now,
        note: "Compra confirmada pelo cliente (WhatsApp)",
      }),
      ...(needsStock ? { stockApplied: true } : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
    for (const s of snaps) {
      if (!s.exists) continue;
      const product = { id: s.id, ...(s.data() as Omit<Product, "id">) } as Product;
      tx.update(s.ref, { ...stockUpdateFor(product, items), updatedAt: FieldValue.serverTimestamp() });
    }
  });
}
