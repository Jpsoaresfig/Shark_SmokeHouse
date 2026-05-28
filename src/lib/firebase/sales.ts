import {
  collection, getDocs, addDoc, query, orderBy,
  where, serverTimestamp, Timestamp, doc, updateDoc, increment,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
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
  const snap = await getDocs(query(collection(db, COL), ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sale));
}

export async function createSale(
  data: Omit<Sale, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await Promise.all(
    data.items.map(item =>
      updateDoc(doc(db, "products", item.productId), {
        stock: increment(-item.quantity),
        updatedAt: serverTimestamp(),
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
