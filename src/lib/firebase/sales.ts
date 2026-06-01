import {
  collection, getDocs, addDoc, query, orderBy,
  where, serverTimestamp, Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addStockMovement } from "@/lib/firebase/inventory";
import type { Sale, SalePaymentMethod } from "@/types";

const COL = "sales";

const PAYMENT_LABELS: Record<SalePaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  cash: "Dinheiro",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDate(value: any): Date {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (typeof value.toDate === "function") return value.toDate();
  return new Date(0);
}

export async function getSales(startDate?: Date, endDate?: Date): Promise<Sale[]> {
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
}

export async function createSale(
  data: Omit<Sale, "id" | "createdAt">,
): Promise<string> {
  // Firestore rejects `undefined` — sanitize optional fields
  const cleanItems = data.items.map(item => {
    const { sku, ...rest } = item;
    return sku !== undefined && sku !== "" ? { ...rest, sku } : rest;
  });

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
      })
    )
  );
  return ref.id;
}

export function exportSalesCSV(sales: Sale[], filename?: string): void {
  const headers = [
    "Data", "Hora", "ID", "Vendedor",
    "Produto", "SKU", "Categoria", "Qtd",
    "Preço Unit.", "Subtotal", "Total da Venda",
    "Pagamento", "Observações",
  ];
  const rows: string[][] = [headers];

  for (const sale of sales) {
    const d = toDate(sale.createdAt);
    const dateStr = d.toLocaleDateString("pt-BR");
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    for (const item of sale.items) {
      rows.push([
        dateStr,
        timeStr,
        sale.id.slice(-8).toUpperCase(),
        sale.sellerName,
        item.productName,
        item.sku ?? "",
        item.category,
        String(item.quantity),
        item.price.toFixed(2).replace(".", ","),
        item.subtotal.toFixed(2).replace(".", ","),
        sale.total.toFixed(2).replace(".", ","),
        PAYMENT_LABELS[sale.paymentMethod],
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
