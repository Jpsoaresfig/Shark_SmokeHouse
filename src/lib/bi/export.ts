/**
 * Exportação CSV do BI. `toCsv` é pura (testável); `downloadCsv` dispara o
 * download no navegador (client-only).
 */
import { filterLines, buildLines, BI_PAYMENT_LABELS } from "./aggregate";
import { storeParts } from "./periods";
import type { BiStockRow } from "./insights";
import type { BiCategoryRow, BiFilters, BiNeighborhoodRow, BiProductRow, BiSellerRow, BiSource } from "./types";
import type { BiRange } from "./types";

/** Serializa linhas em CSV (separador `;`, células entre aspas, BOM p/ Excel). */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
}

/** Dispara o download de um CSV no navegador. */
export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const money = (n: number) => n.toFixed(2).replace(".", ",");
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

/** CSV do ranking de produtos. */
export function productRankingCsv(rows: BiProductRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Posição", "Produto", "Categoria", "Unidades vendidas", "Faturamento", "Custo", "Lucro", "Margem", "Estoque atual"],
  ];
  rows.forEach((r, i) => {
    out.push([
      i + 1, r.productName, r.category ?? "",
      r.quantity, money(r.revenue), money(r.cost), money(r.profit), pct(r.margin),
      r.stock == null ? "" : String(r.stock),
    ]);
  });
  return out;
}

/** CSV da análise de estoque. */
export function stockCsv(rows: BiStockRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Produto", "Estoque atual", "Vendas 30 dias", "Vendas no período", "Média/dia", "Dias de estoque", "Estoque mínimo", "Última venda", "Dias sem venda", "Status", "Justificativa"],
  ];
  for (const r of rows) {
    out.push([
      r.productName,
      r.stock,
      r.salesWindow,
      r.salesPeriod,
      money(r.dailyAverage),
      r.stockDays == null ? "Dados insuficientes" : money(r.stockDays),
      r.minStock,
      r.lastSaleAt ? r.lastSaleAt.toLocaleDateString("pt-BR") : "—",
      r.daysWithoutSale == null ? "—" : String(r.daysWithoutSale),
      r.status,
      r.reason,
    ]);
  }
  return out;
}

/** CSV do ranking por categoria. */
export function categoryRankingCsv(rows: BiCategoryRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Categoria", "Qtd vendida", "Faturamento", "Custo", "Lucro", "Margem"],
  ];
  for (const r of rows) {
    out.push([r.label, r.quantity, money(r.revenue), money(r.cost), money(r.profit), pct(r.margin)]);
  }
  return out;
}

/** CSV das recomendações de compra. */
export function recommendationsCsv(rows: BiStockRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Status", "Produto", "Estoque atual", "Estoque mínimo", "Vendas 30 dias", "Média/dia", "Dias de estoque", "Por quê"],
  ];
  for (const r of rows) {
    out.push([
      r.status,
      r.productName,
      r.stock,
      r.minStock,
      r.salesWindow,
      money(r.dailyAverage),
      r.stockDays == null ? "—" : money(r.stockDays),
      r.reason,
    ]);
  }
  return out;
}

/** CSV dos vendedores. */
export function sellersCsv(rows: BiSellerRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Vendedor", "Vendas", "Faturamento", "Ticket médio", "Lucro", "Comissão", "Taxa de comissão"],
  ];
  for (const r of rows) {
    out.push([r.sellerName, r.transactions, money(r.revenue), money(r.ticketAvg), money(r.profit), money(r.commission), `${r.commissionRate.toFixed(1).replace(".", ",")}%`]);
  }
  return out;
}

/** CSV dos bairros. */
export function neighborhoodsCsv(rows: BiNeighborhoodRow[]): (string | number)[][] {
  const out: (string | number)[][] = [
    ["Bairro", "Pedidos", "Faturamento", "Ticket médio"],
  ];
  for (const r of rows) {
    out.push([r.neighborhood, r.transactions, money(r.revenue), money(r.ticketAvg)]);
  }
  return out;
}

/** CSV das vendas detalhadas (linhas de item) no período + filtros. */
export function salesDetailCsv(source: BiSource, range: BiRange, filters: BiFilters): (string | number)[][] {
  const lines = filterLines(buildLines(source), range, filters);
  const out: (string | number)[][] = [
    ["Data", "Hora", "Origem", "ID", "Produto", "Variação", "SKU", "Categoria", "Qtd", "Preço unit.", "Faturamento", "Custo", "Lucro", "Vendedor", "Pagamento", "Bairro"],
  ];
  for (const l of lines) {
    const p = storeParts(l.date);
    const cost = (l.costUnit ?? 0) * l.quantity;
    out.push([
      p.iso,
      `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
      l.source === "online" ? "Online" : "PDV",
      l.transactionId.slice(-8).toUpperCase(),
      l.productName,
      l.variationName ?? "",
      l.sku ?? "",
      l.category ?? "",
      l.quantity,
      money(l.unitPrice),
      money(l.subtotal),
      money(cost),
      money(l.subtotal - cost),
      l.sellerName ?? "",
      BI_PAYMENT_LABELS[l.paymentMethod ?? "pending"] ?? l.paymentMethod ?? "",
      l.neighborhood ?? "",
    ]);
  }
  return out;
}

