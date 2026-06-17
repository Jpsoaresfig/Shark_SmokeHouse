import {
  collection, getDocs, addDoc, updateDoc, doc, query, orderBy,
  where, serverTimestamp, Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addStockMovement } from "@/lib/firebase/inventory";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { Sale, SalePaymentMethod, SaleChannel } from "@/types";

const COL = "sales";

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
