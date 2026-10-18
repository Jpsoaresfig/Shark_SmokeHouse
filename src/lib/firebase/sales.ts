import {
  collection, getDocs, getDoc, addDoc, updateDoc, doc, query, orderBy,
  where, serverTimestamp, Timestamp, runTransaction, arrayUnion, increment,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addStockMovement } from "@/lib/firebase/inventory";
import { cached, invalidate } from "@/lib/firebase/cache";
import { deriveStatus, saleStatus, saleReceivedAmount, saleOutstanding, saleDueDate, CENTS_EPSILON } from "@/lib/sales/helpers";
import { SALE_PAYMENT_STATUS_LABELS } from "@/lib/payments/labels";
import { storeMidnight } from "@/lib/bi/periods";
import { STORE_TIMEZONE } from "@/lib/businessHours";
import type { Sale, SalePaymentMethod, SaleChannel, SaleAuditEvent, Product } from "@/types";

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

/** "YYYY-MM-DD" no fuso LOCAL — mesma base dos limites `setHours` da consulta.
 *  (`toISOString()` usa UTC: datas diferentes podiam colidir na mesma chave de
 *  cache e devolver vendas de outro período.) */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Venda gravada, mas a baixa de estoque de algum item falhou. O chamador NÃO
 *  deve tentar registrar a venda de novo (duplicaria); o estoque precisa de
 *  ajuste manual dos itens listados. */
export class SaleStockError extends Error {
  constructor(public saleId: string, public failedItems: string[]) {
    super(
      `Venda #${saleId.slice(-8).toUpperCase()} registrada, mas a baixa de estoque falhou para: ` +
      `${failedItems.join(", ")}. Ajuste o estoque manualmente.`,
    );
    this.name = "SaleStockError";
  }
}

/** Download de CSV (revoga a URL depois — revogar logo após o click pode
 *  cancelar o download em alguns navegadores). */
function downloadCsvBlob(csv: string, filename: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function getSales(startDate?: Date, endDate?: Date, force = false): Promise<Sale[]> {
  const key = `sales:${startDate ? localDayKey(startDate) : "-"}:${endDate ? localDayKey(endDate) : "-"}`;
  return cached(key, async () => {
    const constraints: QueryConstraint[] = [];
    // O dia do calendário escolhido (y-m-d da data recebida) é interpretado no
    // fuso da LOJA — aparelho em outro fuso não desloca o filtro do histórico.
    if (startDate) {
      const start = storeMidnight(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate());
      constraints.push(where("createdAt", ">=", Timestamp.fromDate(start)));
    }
    if (endDate) {
      const end = new Date(storeMidnight(endDate.getFullYear(), endDate.getMonth() + 1, endDate.getDate() + 1).getTime() - 1);
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
  // Pontos: a venda SEMPRE nasce com `pointsAwarded: false`. Quem marca `true` é
  // `awardSalePoints`, na mesma transação que credita o saldo — antes o flag era
  // gravado aqui antes do crédito e, se o crédito falhasse, a venda ficava
  // "creditada" sem os pontos (e o cancelamento debitava pontos nunca dados).
  payload.pointsAwarded = false;
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
  // allSettled: a venda já existe — uma falha de estoque não pode virar "erro ao
  // registrar venda" (o operador registraria de novo e duplicaria a venda).
  const results = await Promise.allSettled(
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
  const failed = data.items.filter((_, i) => results[i].status === "rejected");
  if (failed.length) {
    console.error("[createSale] baixa de estoque falhou", results.filter(r => r.status === "rejected"));
    throw new SaleStockError(
      ref.id,
      failed.map(it => (it.variationName ? `${it.productName} - ${it.variationName}` : it.productName)),
    );
  }
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
): Promise<SalePaymentResult> {
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

  // Crédito de pontos ao quitar — uma única vez (guard transacional em
  // awardSalePoints). O recebimento JÁ foi gravado: uma falha no crédito não
  // pode virar "erro ao registrar recebimento" (o operador registraria de novo).
  if (result.becamePaid && !result.pointsAwarded && result.customerId && result.pointsEarned > 0) {
    try {
      const points = await awardSalePoints(id, input.receivedBy);
      return { pointsCredited: points };
    } catch (err) {
      console.error("[registerSalePayment] falha ao creditar pontos", err);
      return {
        pointsCredited: 0,
        pointsError: err instanceof Error ? err.message : "Falha ao creditar os pontos.",
      };
    }
  }
  return { pointsCredited: 0 };
}

/** Resultado de um recebimento: o pagamento foi gravado; `pointsError` indica
 *  que o crédito de pontos (pós-commit) falhou e precisa de ajuste manual. */
export interface SalePaymentResult {
  pointsCredited: number;
  pointsError?: string;
}

/** Papéis que pontuam no PDV. As regras do Firestore só permitem ao vendedor
 *  creditar contas "customer" — motoboy/equipe vinculados à venda não pontuam. */
export function canEarnSalePoints(role: string | undefined | null): boolean {
  return (role ?? "customer") === "customer";
}

/**
 * Credita os pontos do Clube Shark de uma venda QUITADA ao cliente vinculado,
 * uma única vez. Transação: relê a venda, só credita se `pointsAwarded` ainda
 * for falso e marca o flag no MESMO commit do saldo + lançamento no ledger —
 * nunca fica "creditado" sem crédito, nem credita duas vezes.
 * Retorna os pontos creditados (0 = nada a creditar).
 */
export async function awardSalePoints(id: string, by: string): Promise<number> {
  const ref = doc(db, COL, id);
  const points = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return 0;
    const sale = { id, ...snap.data() } as Sale;
    const earned = sale.pointsEarned ?? 0;
    if (sale.pointsAwarded || saleStatus(sale) !== "paid" || !sale.customerId || !(earned > 0)) return 0;

    const userRef = doc(db, "users", sale.customerId);
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists() || !canEarnSalePoints(userSnap.data().role)) return 0;

    tx.update(userRef, { loyaltyPoints: increment(earned), updatedAt: serverTimestamp() });
    tx.set(doc(collection(db, "loyaltyTransactions")), {
      userId: sale.customerId,
      type: "earned",
      points: earned,
      reason: `Venda PDV #${id.slice(-6).toUpperCase()}`,
      createdAt: serverTimestamp(),
    });
    tx.update(ref, {
      pointsAwarded: true,
      audit: arrayUnion({ type: "payment", at: nowIso(), by, note: "Pontos creditados", amount: earned } satisfies SaleAuditEvent),
    });
    return earned;
  });
  invalidate("sales");
  invalidate("users");
  return points;
}

/** Atalho: quita o saldo restante da venda de uma vez (marca como paga). */
export async function markSalePaid(
  id: string,
  receivedBy: string,
  method?: SalePaymentMethod,
): Promise<SalePaymentResult> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) throw new Error("Venda não encontrada.");
  const sale = { id, ...snap.data() } as Sale;
  const outstanding = saleOutstanding(sale);
  if (outstanding <= 0) return { pointsCredited: 0 };
  return registerSalePayment(id, {
    amount: outstanding,
    method: method ?? sale.paymentMethod,
    receivedBy,
    note: "Quitação total",
  });
}

/**
 * Cancela uma venda: marca como cancelada, estorna o estoque e reverte os
 * pontos JÁ creditados — tudo numa ÚNICA transação. O guard (`stockReversed`/
 * `pointsReversed`) é lido e gravado no mesmo commit do estorno, então dois
 * cancelamentos simultâneos (duas abas, clique duplo) não devolvem o estoque
 * duas vezes: o segundo relê a venda já estornada e não faz nada.
 *
 * Produto (ou variação) excluído depois da venda é ignorado no estorno e fica
 * registrado na auditoria. Pontos só são debitados se `pointsAwarded` for true
 * (crédito efetivamente feito). Idempotente.
 */
export async function cancelSale(id: string, reason: string, userId: string): Promise<void> {
  const ref = doc(db, COL, id);
  const saleRef = `#${id.slice(-6).toUpperCase()}`;

  await runTransaction(db, async (tx) => {
    // ── Leituras (todas antes das escritas, exigência da transação) ──
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Venda não encontrada.");
    const sale = { id, ...snap.data() } as Sale;
    const prevStatus = saleStatus(sale);
    const wasCancelled = prevStatus === "cancelled";
    const reverseStock = !sale.stockReversed;
    const reversePoints = !!sale.pointsAwarded && !sale.pointsReversed
      && !!sale.customerId && (sale.pointsEarned ?? 0) > 0;
    if (wasCancelled && !reverseStock && !reversePoints) return; // já cancelada e estornada

    const productIds = reverseStock ? [...new Set(sale.items.map(i => i.productId))] : [];
    const productSnaps = await Promise.all(productIds.map(pid => tx.get(doc(db, "products", pid))));
    const userRef = reversePoints ? doc(db, "users", sale.customerId!) : null;
    const userSnap = userRef ? await tx.get(userRef) : null;

    const at = nowIso();
    const events: SaleAuditEvent[] = [];
    const update: Record<string, unknown> = {};

    // 1) Marca a venda como cancelada.
    if (!wasCancelled) {
      Object.assign(update, {
        paymentStatus: "cancelled",
        canceledAt: at,
        canceledBy: userId,
        cancelReason: reason,
      });
      events.push({ type: "cancelled", at, by: userId, note: reason, from: prevStatus, to: "cancelled" });
    }

    // 2) Estorna o estoque (soma exata do que a venda baixou).
    if (reverseStock) {
      const skipped: string[] = [];
      const label = (i: Sale["items"][number]) => (i.variationName ? `${i.productName} - ${i.variationName}` : i.productName);
      productSnaps.forEach((pSnap, idx) => {
        const mine = sale.items.filter(i => i.productId === productIds[idx]);
        if (!pSnap.exists()) { skipped.push(...mine.map(label)); return; } // produto excluído
        const product = pSnap.data() as Product;
        let variations = product.variations;
        let stock = Number(product.stock) || 0;
        const applied: Sale["items"] = [];
        const byVariation = mine.filter(i => i.variationId);
        const knownVar = byVariation.filter(i => variations?.some(v => v.id === i.variationId));
        skipped.push(...byVariation.filter(i => !knownVar.includes(i)).map(label)); // variação excluída
        if (knownVar.length && variations?.length) {
          variations = variations.map(v => {
            const qty = knownVar.filter(i => i.variationId === v.id).reduce((n, i) => n + i.quantity, 0);
            return qty ? { ...v, stock: (v.stock ?? 0) + qty } : v;
          });
          // Com grade, o estoque do produto é a soma das variações.
          stock = variations.reduce((n, v) => n + (v.stock ?? 0), 0);
          applied.push(...knownVar);
        }
        const plain = mine.filter(i => !i.variationId);
        const plainQty = plain.reduce((n, i) => n + i.quantity, 0);
        if (plainQty) { stock += plainQty; applied.push(...plain); }
        if (!applied.length) return;
        tx.update(pSnap.ref, {
          stock,
          ...(knownVar.length ? { variations } : {}),
          updatedAt: serverTimestamp(),
        });
        for (const item of applied) {
          tx.set(doc(collection(db, "stockMovements")), {
            productId: item.productId,
            productName: item.productName,
            type: "in",
            quantity: item.quantity,
            reason: `Estorno cancelamento PDV ${saleRef}`,
            userId,
            ...(item.variationId ? { variationId: item.variationId, variationName: item.variationName } : {}),
            createdAt: serverTimestamp(),
          });
        }
      });
      update.stockReversed = true;
      events.push({
        type: "stock_reversed", at, by: userId,
        ...(skipped.length ? { note: `Sem estorno (produto/variação excluído): ${skipped.join(", ")}` } : {}),
      });
    }

    // 3) Reverte os pontos efetivamente creditados (debita mesmo que fique
    //    negativo — decisão do negócio). Sem `pointsAwarded`, nada a debitar.
    if (reversePoints) {
      const pts = sale.pointsEarned ?? 0;
      const userExists = !!userSnap?.exists();
      if (userRef && userExists) {
        tx.update(userRef, { loyaltyPoints: increment(-pts), updatedAt: serverTimestamp() });
        tx.set(doc(collection(db, "loyaltyTransactions")), {
          userId: sale.customerId,
          type: "adjustment",
          points: -pts,
          reason: `Estorno venda ${saleRef}`,
          by: userId,
          createdAt: serverTimestamp(),
        });
      }
      update.pointsReversed = true;
      events.push({
        type: "points_reversed", at, by: userId, amount: -pts,
        ...(userExists ? {} : { note: "Cliente não encontrado — sem débito" }),
      });
    }

    if (events.length) update.audit = arrayUnion(...events);
    tx.update(ref, update);
  });

  invalidate("sales");
  invalidate("products");
  invalidate("users");
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
    const dateStr = d.toLocaleDateString("pt-BR", { timeZone: STORE_TIMEZONE });
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: STORE_TIMEZONE });
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
    const dueStr = saleDueDate(sale)?.toLocaleDateString("pt-BR") ?? "";
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
        item.category ?? "",
        String(item.quantity),
        money(item.price),
        money(item.subtotal ?? item.price * item.quantity),
        money(productsSubtotal),
        sale.couponCode ?? "",
        money(sale.discount ?? 0),
        money(sale.deliveryFee ?? 0),
        money(sale.cardFee ?? 0),
        installmentsStr,
        money(sale.total),
        PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod ?? "",
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
    .map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  downloadCsvBlob(csv, filename ?? `vendas_${localDayKey(new Date())}.csv`);
}

/** Linha do ranking de produtos (mais/menos vendidos). */
export interface ProductSalesRow {
  productName: string;
  variationName?: string;
  sku?: string;
  category?: string;
  quantity: number;
  revenue: number;
}

/**
 * Agrega o ranking de produtos vendidos a partir das vendas. Exclui vendas
 * canceladas. Agrupado por produto + variação. Ordenado por quantidade desc
 * (mais vendidos no topo, menos vendidos no fim).
 */
export function aggregateProductSales(sales: Sale[]): ProductSalesRow[] {
  const map = new Map<string, ProductSalesRow>();
  for (const sale of sales) {
    if (saleStatus(sale) === "cancelled") continue;
    for (const item of sale.items) {
      const key = `${item.productId}:${item.variationId ?? ""}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.subtotal ?? item.price * item.quantity;
      } else {
        map.set(key, {
          productName: item.productName,
          ...(item.variationName ? { variationName: item.variationName } : {}),
          ...(item.sku ? { sku: item.sku } : {}),
          ...(item.category ? { category: item.category } : {}),
          quantity: item.quantity,
          revenue: item.subtotal ?? item.price * item.quantity,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) =>
    b.quantity - a.quantity || b.revenue - a.revenue,
  );
}

/** Exporta o ranking de produtos (mais/menos vendidos) em CSV. */
export function exportProductSalesCSV(
  rows: ProductSalesRow[],
  filename?: string,
): void {
  const headers = [
    "Posição", "Produto", "Variação", "SKU", "Categoria",
    "Qtd Vendida", "Receita Total",
  ];
  const csvRows: string[][] = [headers];
  const money = (n: number) => n.toFixed(2).replace(".", ",");
  rows.forEach((row, i) => {
    csvRows.push([
      String(i + 1),
      row.productName,
      row.variationName ?? "",
      row.sku ?? "",
      row.category ?? "",
      String(row.quantity),
      money(row.revenue),
    ]);
  });

  const csv = csvRows
    .map(r => r.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  downloadCsvBlob(csv, filename ?? `produtos_mais_vendidos_${localDayKey(new Date())}.csv`);
}
