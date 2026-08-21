/**
 * Tipos do BI de vendas (módulo Financeiro).
 *
 * Tudo aqui é lógica PURA (sem Date/IO/randomness) para ser segura no render
 * do React Compiler e facilmente testável com Vitest.
 */
import type {
  Category, Order, Product, Sale, UserProfile,
} from "@/types";

/** Origem da venda: pedidos online (coleção `orders`) ou PDV (coleção `sales`). */
export type BiOrigin = "all" | "online" | "pdv";

/** Intervalo de datas (instantes, inclusivo). */
export interface BiRange {
  start: Date;
  end: Date;
}

/** Filtros combináveis do BI. */
export interface BiFilters {
  /** Slug da categoria (ex.: "beverages"). Ausente = todas. */
  category?: string;
  /** Marca do produto (ex.: "Zomo"). Ausente = todas. */
  brand?: string;
  /** productId exato. Ausente = todos. */
  productId?: string;
  /** sellerId exato (vendas PDV). Ausente = todos. */
  sellerId?: string;
  /** Bairro exato (pedidos online). Ausente = todos. */
  neighborhood?: string;
  /** Chave normalizada da forma de pagamento. Ausente = todas. */
  paymentMethod?: string;
  /** Todos / Online / PDV. Default "all". */
  origin: BiOrigin;
}

export const DEFAULT_BI_FILTERS: BiFilters = { origin: "all" };

/** Linha unificada de item vendido (venda PDV ou pedido online). */
export interface BiLine {
  transactionId: string;
  /** "orders" = loja online; "sales" = PDV. */
  source: "online" | "pdv";
  productId: string;
  productName: string;
  variationId?: string;
  variationName?: string;
  sku?: string;
  /** Slug da categoria (pedidos online buscam no produto atual). */
  category?: string;
  /** Marca do produto (sempre do catálogo atual — itens não congelam marca). */
  brand?: string;
  quantity: number;
  unitPrice: number;
  /** Receita atribuída ao item (subtotal do item). */
  subtotal: number;
  /** Custo unitário congelado na venda (PDV) ou custo atual do produto. */
  costUnit?: number;
  date: Date;
  sellerId?: string;
  sellerName?: string;
  /** Chave normalizada da forma de pagamento. */
  paymentMethod?: string;
  /** Bairro da entrega (pedidos online). */
  neighborhood?: string;
}

/** Linha de transação (venda/pedido inteiro) após filtros — base dos KPIs. */
export interface BiTxnRow {
  transactionId: string;
  source: "online" | "pdv";
  date: Date;
  /** Faturamento da transação (total) OU soma dos itens do filtro. */
  revenue: number;
  cost: number;
  units: number;
  sellerId?: string;
  sellerName?: string;
  paymentMethod?: string;
  neighborhood?: string;
}

/** Resumo do período (KPIs) + comparação com o período anterior equivalente. */
export interface BiSummary {
  revenue: number;
  cost: number;
  profit: number;
  /** Margem média (% sobre o faturamento). */
  margin: number;
  /** Número de transações (pedidos + vendas). */
  transactions: number;
  unitsSold: number;
  ticketAvg: number;
}

export interface BiPeriodComparison {
  current: BiSummary;
  previous: BiSummary;
  /** Variações em % (null quando o denominador é 0). */
  deltas: {
    revenue: number | null;
    profit: number | null;
    transactions: number | null;
    unitsSold: number | null;
    ticketAvg: number | null;
  };
}

/** Linha do ranking de produtos. */
export interface BiProductRow {
  productId: string;
  productName: string;
  variationName?: string;
  category?: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  /** Margem em % (0 quando revenue = 0). */
  margin: number;
  /** Estoque atual do produto (somente produtos existentes no catálogo). */
  stock: number | null;
}

export type BiRankMode =
  | "quantity_desc"
  | "quantity_asc"
  | "revenue_desc"
  | "profit_desc"
  | "margin_desc"
  | "margin_asc";

/** Linha do ranking por categoria. */
export interface BiCategoryRow {
  /** Slug da categoria. */
  category: string;
  /** Rótulo (fallback: slug). */
  label: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

/** Vendas por dia da semana (0 = domingo). */
export interface BiWeekdayRow {
  weekday: number;
  label: string;
  transactions: number;
  revenue: number;
  ticketAvg: number;
}

/** Vendas por hora do dia (0–23, fuso da loja). */
export interface BiHourRow {
  hour: number;
  transactions: number;
  revenue: number;
}

/** Vendas por bairro (pedidos online). */
export interface BiNeighborhoodRow {
  neighborhood: string;
  transactions: number;
  revenue: number;
  ticketAvg: number;
}

/** Vendas por vendedor (PDV). */
export interface BiSellerRow {
  sellerId: string;
  sellerName: string;
  transactions: number;
  revenue: number;
  ticketAvg: number;
  profit: number;
  /** Comissão acumulada (somente vendas quitadas, regra existente). */
  commission: number;
  commissionRate: number;
}

/** Vendas por forma de pagamento (PDV + online). */
export interface BiPaymentRow {
  method: string;
  /** Rótulo de exibição. */
  label: string;
  transactions: number;
  revenue: number;
  /** Participação no faturamento (%). */
  percent: number;
}

/** Ponto de série temporal (evolução). */
export interface BiEvolutionPoint {
  /** Rótulo curto (ex.: "12/03" ou "Mar/26"). */
  label: string;
  /** Rótulo longo para tooltip. */
  fullLabel: string;
  /** Sort key (timestamp do bucket). */
  sortKey: number;
  value: number;
}

export type BiEvolutionMetric = "revenue" | "profit" | "transactions" | "units";

/** Comparação de crescimento/queda de um produto. */
export interface BiProductTrend {
  productId: string;
  productName: string;
  currentQty: number;
  previousQty: number;
  /** Variação em % (null quando o período anterior não teve vendas). */
  pct: number | null;
  /** true quando o produto não existia no período anterior (novo). */
  isNew: boolean;
}

export interface BiGrowthResult {
  rising: BiProductTrend[];
  falling: BiProductTrend[];
}

/** Fonte de dados preparada (tudo que o motor do BI precisa). */
export interface BiSource {
  sales: Sale[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  sellers: UserProfile[];
}

/** Fuso horário da loja (mesma fonte da operação/cron). */
export const BI_STORE_TIMEZONE = "America/Fortaleza";

/** Constantes de análise de estoque. */
export const BI_CONSTANTS = {
  /** Janela (dias) usada para calcular a velocidade de venda. */
  VELOCITY_WINDOW_DAYS: 30,
  /** ≤ este nº de dias de estoque → reposição URGENTE. */
  URGENT_STOCK_DAYS: 5,
  /** ≤ este nº de dias de estoque → reposição recomendada. */
  RESTOCK_STOCK_DAYS: 15,
  /** ≥ este nº de dias de estoque com vendas → baixa saída. */
  HIGH_STOCK_DAYS: 90,
  /** ≥ este nº de dias sem vender → estoque parado. */
  STUCK_DAYS: 30,
} as const;
