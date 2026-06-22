import {
  collection, getDocs, getDoc, addDoc, updateDoc, doc, query, orderBy,
  where, serverTimestamp, Timestamp, runTransaction, arrayUnion,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addStockMovement } from "@/lib/firebase/inventory";
import { addLoyaltyPoints, adjustLoyaltyPoints } from "@/lib/firebase/loyalty";
import { cached, invalidate } from "@/lib/firebase/cache";
import { deriveStatus, saleStatus, saleReceivedAmount, saleOutstanding, CENTS_EPSILON } from "@/lib/sales/helpers";
import { SALE_PAYMENT_STATUS_LABELS } from "@/lib/payments/labels";
import type { Sale, SalePaymentMethod, SaleChannel, SaleAuditEvent } from "@/types";

const COL = "sales";

function nowIso(): string {
  return new Date().toISOString();
}

export const SALE_PAYMENT_LABELS: Record<SalePaymentMethod, string> = {
  pix: "Pix",
  credit: "Crédito",
  debit: "Débito",
  cash: "Dinheiro",
  card: "Cartão", // legado
};
const PAYMENT_LABELS = SALE_PAYMENT_LABELS;

export const SALE_CHANNEL_LABELS: Record<SaleChannel, string> = {
  in_store: "Loja (presencial)",
  delivery: "Entrega (em casa)",
  online: "Online",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(0);
}

export async function getSales(startDate?: Date, endDate?: Date, force = false): Promise<Sale[]> {
  const key = `sales:${startDate ? startDate.toISOString().slice(0, 10) : "-"}:${endDate ? endDate.toISOString().slice(0, 10) : "-"}`;
  return cached(key, async () => {
    const constraints: QueryConstraint[] = [];
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(start)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      constraints.push(where("createdAt", "<=", Timestamp.fromDate(end)));
    }
    constraints.push(orderBy("createdAt", "desc"));
    const snap = await getDocs(query(collection(db, COL), ...constraints));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
  }, force);
}

export async function createSale(
  data: Omit<Sale, "id" | "createdAt">,
): Promise<string> {
  // Firestore rejects `undefined` — remove campos opcionais vazios de cada item.
  const cleanItems = data.items.map(item =>
    Object.fromEntries(
      Object.entries(item).filter(([, v]) => v !== undefined && v !== ""),
    ) as typeof item,
  );

  const payload: Record<string, unknown> = {
    sellerId: data.sellerId,
    sellerName: data.sellerName,
    items: cleanItems,
    total: data.total,
    paymentMethod: data.paymentMethod,
    createdAt: serverTimestamp(),
  };
  if (data.notes !== undefined && data.notes !== "") {
    payload.notes = data.notes;
  }
  // Subtotal de produtos (sem frete/taxa) — base da comissão do vendedor.
  if (data.subtotal !== undefined) payload.subtotal = data.subtotal;
  // Canal/onde a venda foi feita (loja, entrega, online).
  if (data.channel) payload.channel = data.channel;
  // Frete e taxa de cartão — registrados separados para relatório.
  if (data.deliveryFee) payload.deliveryFee = data.deliveryFee;
  if (data.cardFee) payload.cardFee = data.cardFee;
  if (data.cardFeePercent) payload.cardFeePercent = data.cardFeePercent;
  // Parcelas só fazem sentido no crédito (2x+).
  if (data.installments && data.installments > 1) payload.installments = data.installments;
  // Cupom aplicado.
  if (data.discount) payload.discount = data.discount;
  if (data.couponCode) payload.couponCode = data.couponCode;
  // Pontos do Clube Shark creditados ao cliente vinculado.
  if (data.pointsEarned) payload.pointsEarned = data.pointsEarned;
  // Cliente vinculado (venda presencial).
  if (data.customerId) {
    payload.customerId = data.customerId;
    payload.customerName = data.customerName ?? "";
  }
  // Entrega posterior: registra o pedido como pendente de entrega.
  if (data.deliveryLater) {
    payload.deliveryLater = true;
    payload.delivered = false;
  }

  // ── Pagamento (fiado / parcial / pendente) ──────────────
  // Status efetivo: default "paid" (mantém compatibilidade com o fluxo antigo).
  const status = data.paymentStatus ?? "paid";
  // amountReceived: cuidado com `0` (falsy) — usar `??`. Default = total (quitado).
  const received = data.amountReceived ?? (status === "paid" ? data.total : 0);
  payload.paymentStatus = status;
  payload.amountReceived = received;
  // Histórico de recebimentos: a entrada inicial, se houve.
  const initialPayments = data.payments && data.payments.length
    ? data.payments
    : received > 0
      ? [{ amount: received, method: data.paymentMethod, receivedAt: nowIso(), receivedBy: data.createdBy ?? data.sellerId }]
      : [];
  if (initialPayments.length) payload.payments = initialPayments;
  // Desconto manual (≠ cupom) — registro de quem concedeu e por quê.
  if (data.manualDiscount) payload.manualDiscount = data.manualDiscount;
  if (data.dueDate) payload.dueDate = data.dueDate;
  if (data.createdBy) payload.createdBy = data.createdBy;
  // Guards de idempotência.
  payload.stockReversed = false;
  // Pontos: creditados apenas quando a venda está quitada (o chamador credita
  // de fato no fluxo "paid"; pendentes creditam ao quitar via registerSalePayment).
  payload.pointsAwarded = status === "paid" && !!data.pointsEarned;
  // Trilha de auditoria inicial.
  const audit: SaleAuditEvent[] = [
    { type: "created", at: nowIso(), by: data.createdBy ?? data.sellerId, to: status },
  ];
  if (received > 0) {
    audit.push({ type: "payment", at: nowIso(), by: data.createdBy ?? data.sellerId, amount: received });
  }
  payload.audit = audit;

  const ref = await addDoc(collection(db, COL), payload);
  // Baixa o estoque registrando uma movimentação por item (aparece no histórico
  // de estoque e alimenta o alerta de estoque mínimo).
  const saleRef = `#${ref.id.slice(-6).toUpperCase()}`;
  await Promise.all(
    data.items.map(item =>
      addStockMovement({
        productId: item.productId,
        productName: item.productName,
        type: "out",
        quantity: item.quantity,
        reason: `Venda PDV ${saleRef}`,
        userId: data.sellerId,
        ...(item.variationId
          ? { variationId: item.variationId, variationName: item.variationName }
          : {}),
      })
    )
  );
  invalidate("sales");
  invalidate("products"); // estoque baixado
  return ref.id;
}

/**
 * Registra um recebimento (parcial ou total) numa venda pendente/parcial.
 * Usa transação para serializar leituras concorrentes (dois caixas) e recalcula
 * o status a partir do total recebido. Rejeita valor que exceda o saldo.
 * Ao quitar (atingir "paid"), credita os pontos do Clube Shark uma única vez.
 */
export async function registerSalePayment(
  id: string,
  input: { amount: number; method: SalePaymentMethod; receivedBy: string; note?: string },
): Promise<void> {
  if (!(input.amount > 0)) throw new Error("Valor do recebimento deve ser maior que zero.");

  const ref = doc(db, COL, id);
  const result = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Venda não encontrada.");
    const sale = { id, ...snap.data() } as Sale;

    const status = saleStatus(sale);
    if (status === "cancelled") throw new Error("Venda cancelada não aceita recebimentos.");
    if (status === "paid") throw new Error("Venda já está quitada.");

    const current = saleReceivedAmount(sale);
    let next = current + input.amount;
    if (next > sale.total + CENTS_EPSILON) {
      throw new Error(
        `Valor excede o saldo em aberto (${(sale.total - current).toFixed(2)}).`,
      );
    }
    if (next >= sale.total - CENTS_EPSILON) next = sale.total; // fecha a conta
    const newStatus = deriveStatus(next, sale.total);

    const payment = {
      amount: input.amount,
      method: input.method,
      receivedAt: nowIso(),
      receivedBy: input.receivedBy,
      ...(input.note ? { note: input.note } : {}),
    };
    const events: SaleAuditEvent[] = [
      { type: "payment", at: nowIso(), by: input.receivedBy, amount: input.amount },
    ];
    if (newStatus !== status) {
      events.push({ type: "status_change", at: nowIso(), by: input.receivedBy, from: status, to: newStatus });
    }

    tx.update(ref, {
      amountReceived: next,
      paymentStatus: newStatus,
      payments: arrayUnion(payment),
      audit: arrayUnion(...events),
    });

    return {
      becamePaid: newStatus === "paid",
      pointsEarned: sale.pointsEarned ?? 0,
      pointsAwarded: !!sale.pointsAwarded,
      customerId: sale.customerId,
      saleRef: `#${id.slice(-6).toUpperCase()}`,
    };
  });

  invalidate("sales");

  // Crédito de pontos ao quitar — uma única vez (guard pointsAwarded).
  if (result.becamePaid && !result.pointsAwarded && result.customerId && result.pointsEarned > 0) {
    await addLoyaltyPoints(result.customerId, result.pointsEarned, `Compra ${result.saleRef}`, "earned");
    await updateDoc(ref, {
      pointsAwarded: true,
      audit: arrayUnion({ type: "payment", at: nowIso(), by: input.receivedBy, note: "Pontos creditados", amount: result.pointsEarned }),
    });
  }
}

/** Atalho: quita o saldo restante da venda de uma vez (marca como paga). */
export async function markSalePaid(
  id: string,
  receivedBy: string,
  method?: SalePaymentMethod,
): Promise<void> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) throw new Error("Venda não encontrada.");
  const sale = { id, ...snap.data() } as Sale;
  const outstanding = saleOutstanding(sale);
  if (outstanding <= 0) return;
  await registerSalePayment(id, {
    amount: outstanding,
    method: method ?? sale.paymentMethod,
    receivedBy,
    note: "Quitação total",
  });
}

/**
 * Cancela uma venda: marca como cancelada, estorna o estoque (uma única vez via
 * guard `stockReversed`) e reverte os pontos já creditados (uma única vez via
 * `pointsReversed`). Idempotente — reexecutar não duplica estorno.
 */
export async function cancelSale(id: string, reason: string, userId: string): Promise<void> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Venda não encontrada.");
  const sale = { id, ...snap.data() } as Sale;
  if (saleStatus(sale) === "cancelled" && sale.stockReversed) return; // já cancelada e estornada

  const saleRef = `#${id.slice(-6).toUpperCase()}`;

  // 1) Marca a venda como cancelada.
  if (saleStatus(sale) !== "cancelled") {
    await updateDoc(ref, {
      paymentStatus: "cancelled",
      canceledAt: nowIso(),
      canceledBy: userId,
      cancelReason: reason,
      audit: arrayUnion({
        type: "cancelled",
        at: nowIso(),
        by: userId,
        note: reason,
        from: saleStatus(sale),
        to: "cancelled",
      } satisfies SaleAuditEvent),
    });
  }

  // 2) Estorna estoque (guard anti-duplo).
  if (!sale.stockReversed) {
    await Promise.all(
      sale.items.map(item =>
        addStockMovement({
          productId: item.productId,
          productName: item.productName,
          type: "in",
          quantity: item.quantity,
          reason: `Estorno cancelamento PDV ${saleRef}`,
          userId,
          ...(item.variationId
            ? { variationId: item.variationId, variationName: item.variationName }
            : {}),
        })
      )
    );
    await updateDoc(ref, {
      stockReversed: true,
      audit: arrayUnion({ type: "stock_reversed", at: nowIso(), by: userId } satisfies SaleAuditEvent),
    });
  }

  // 3) Reverte pontos já creditados (debita mesmo que fique negativo — decisão do negócio).
  if (sale.pointsAwarded && !sale.pointsReversed && sale.customerId && (sale.pointsEarned ?? 0) > 0) {
    await adjustLoyaltyPoints(sale.customerId, -(sale.pointsEarned ?? 0), `Estorno venda ${saleRef}`, userId);
    await updateDoc(ref, {
      pointsReversed: true,
      audit: arrayUnion({ type: "points_reversed", at: nowIso(), by: userId, amount: -(sale.pointsEarned ?? 0) } satisfies SaleAuditEvent),
    });
  }

  invalidate("sales");
  invalidate("products");
}

/**
 * Contas a Receber: vendas pendentes ou parcialmente pagas. Vendas legadas não
 * têm `paymentStatus`, então não entram nesta query (corretamente — são quitadas).
 * Ordena no cliente por vencimento (fallback: data da venda) para evitar índice composto.
 */
export async function getReceivables(force = false): Promise<Sale[]> {
  return cached("sales:receivables", async () => {
    const snap = await getDocs(
      query(collection(db, COL), where("paymentStatus", "in", ["pending", "partial"])),
    );
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
    return list.sort((a, b) => {
      const ka = a.dueDate ?? toDate(a.createdAt).toISOString();
      const kb = b.dueDate ?? toDate(b.createdAt).toISOString();
      return ka.localeCompare(kb);
    });
  }, force);
}

/** Marca uma venda com entrega posterior como entregue. */
export async function markSaleDelivered(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    delivered: true,
    deliveredAt: new Date().toISOString(),
  });
  invalidate("sales");
}

export function exportSalesCSV(sales: Sale[], filename?: string): void {
  const headers = [
    "Data", "Hora", "ID", "Vendedor", "Cliente", "Canal",
    "Produto", "Variação", "SKU", "Categoria", "Qtd",
    "Preço Unit.", "Subtotal Item",
    "Subtotal Produtos", "Cupom", "Desconto", "Frete", "Taxa Cartão", "Parcelas", "Total da Venda",
    "Pagamento", "Entrega", "Observações",
    "Status Pagamento", "Recebido", "A Receber", "Desconto Manual", "Vencimento",
  ];
  const rows: string[][] = [headers];
  const money = (n: number) => n.toFixed(2).replace(".", ",");

  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    const dateStr = d.toLocaleDateString("pt-BR");
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const deliveryStr = sale.deliveryLater
      ? (sale.delivered ? "Entregue" : "Entrega pendente")
      : "Retirada na hora";
    const channelStr = sale.channel ? SALE_CHANNEL_LABELS[sale.channel] : "Loja (presencial)";
    // Subtotal de produtos: campo novo; nas vendas antigas o total já era só produtos.
    const productsSubtotal = sale.subtotal ?? sale.total;
    const installmentsStr = (sale.installments ?? 1) > 1 ? `${sale.installments}x` : "À vista";
    // Pagamento (status/recebido/a receber) — colunas novas no fim do CSV.
    const statusStr = SALE_PAYMENT_STATUS_LABELS[saleStatus(sale)] ?? "Pago";
    const receivedStr = money(saleReceivedAmount(sale));
    const outstandingStr = money(saleOutstanding(sale));
    const manualDiscStr = money(sale.manualDiscount?.amount ?? 0);
    const dueStr = sale.dueDate ? toDate(sale.dueDate).toLocaleDateString("pt-BR") : "";
    for (const item of sale.items) {
      rows.push([
        dateStr,
        timeStr,
        sale.id.slice(-8).toUpperCase(),
        sale.sellerName,
        sale.customerName ?? "",
        channelStr,
        item.productName,
        item.variationName ?? "",
        item.sku ?? "",
        item.category,
        String(item.quantity),
        money(item.price),
        money(item.subtotal),
        money(productsSubtotal),
        sale.couponCode ?? "",
        money(sale.discount ?? 0),
        money(sale.deliveryFee ?? 0),
        money(sale.cardFee ?? 0),
        installmentsStr,
        money(sale.total),
        PAYMENT_LABELS[sale.paymentMethod],
        deliveryStr,
        sale.notes ?? "",
        statusStr,
        receivedStr,
        outstandingStr,
        manualDiscStr,
        dueStr,
      ]);
    }
  }

  const csv = rows
    .map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `vendas_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
