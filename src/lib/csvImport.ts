/**
 * Importação de produtos por planilha CSV (exportada do Excel/Google Sheets).
 *
 * Colunas reconhecidas (a ordem não importa; acentos e maiúsculas são ignorados):
 *   ESTOQUE · SKU · CATEGORIA · MARCA · DESCRIÇÃO DO PRODUTO · COR/AROMA/SABOR ·
 *   TAMANHO/QUANTIDADE · CUSTO UNIDADE (R$) · IMPOSTO (%) ·
 *   PREÇO PIX/DINHEIRO (R$) · PONTOS GANHOS · PONTOS RESGATE
 *
 * Linhas com a mesma DESCRIÇÃO + MARCA + TAMANHO e COR/AROMA/SABOR diferentes
 * viram VARIAÇÕES de um único produto (cada uma com seu SKU e estoque).
 */
import type { ProductVariation } from "@/types";

/* ── Parser CSV ──────────────────────────────────────────── */

/** Detecta o separador (Excel pt-BR exporta com ";"). */
function detectDelimiter(headerLine: string): string {
  const counts: [string, number][] = [";", ",", "\t"].map(d => [
    d,
    headerLine.split(d).length - 1,
  ]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ";";
}

/** Divide uma linha CSV respeitando aspas ("a;b";c → [a;b, c]). */
function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // aspas escapadas
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      out.push(cur); cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** Lê o texto CSV inteiro em linhas de células (ignora linhas vazias). */
export function parseCsv(text: string): string[][] {
  // remove BOM e normaliza quebras de linha
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = clean.split("\n").filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delim = detectDelimiter(lines[0]);
  return lines.map(l => splitCsvLine(l, delim));
}

/* ── Mapeamento de colunas ───────────────────────────────── */

/** Remove acentos, espaços extras e pontuação para casar cabeçalhos. */
function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type ColumnKey =
  | "stock" | "sku" | "category" | "brand" | "name" | "variation"
  | "size" | "cost" | "tax" | "price" | "pointsEarned" | "pointsRedeem";

/** Palavras-chave por coluna — basta o cabeçalho conter uma delas. */
const COLUMN_MATCHERS: [ColumnKey, RegExp][] = [
  ["pointsEarned", /PONTOS? GANHOS?/],
  ["pointsRedeem", /PONTOS? RESGATE/],
  ["variation",    /COR|AROMA|SABOR/],
  ["size",         /TAMANHO|QUANTIDADE POR|QTD EMBALAGEM/],
  ["cost",         /CUSTO/],
  ["tax",          /IMPOSTO/],
  ["price",        /PRECO|VALOR VENDA/],
  ["name",         /DESCRICAO|PRODUTO|NOME/],
  ["category",     /CATEGORIA/],
  ["brand",        /MARCA/],
  ["stock",        /ESTOQUE/],
  ["sku",          /SKU|CODIGO|COD BARRAS/],
];

/** Mapeia índice de coluna → campo. Retorna null se faltar o essencial. */
export function mapHeaders(headerCells: string[]): Partial<Record<ColumnKey, number>> {
  const map: Partial<Record<ColumnKey, number>> = {};
  headerCells.forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const [key, re] of COLUMN_MATCHERS) {
      if (map[key] === undefined && re.test(h)) {
        map[key] = idx;
        return;
      }
    }
  });
  return map;
}

/* ── Números pt-BR ───────────────────────────────────────── */

/** "R$ 1.234,56" → 1234.56 · "12,5" → 12.5 · "12.5" → 12.5 · "" → undefined */
export function parseBrNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  let s = raw.replace(/R\$|%/gi, "").trim();
  if (!s) return undefined;
  const hasComma = s.includes(",");
  if (hasComma) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/* ── Agrupamento em produtos ─────────────────────────────── */

export interface ParsedProduct {
  name: string;
  category: string;      // rótulo cru da planilha (ex.: "Essências")
  brand?: string;
  size?: string;
  price: number;
  costPrice?: number;
  taxPercent?: number;
  pointsEarned?: number;
  loyaltyPoints?: number;
  sku?: string;          // SKU do produto simples (sem variações)
  stock: number;         // total (soma das variações, quando houver)
  variations: ProductVariation[];
}

export interface ParseResult {
  products: ParsedProduct[];
  /** Avisos não-fatais (linha ignorada, número inválido…). */
  warnings: string[];
  /** Erro fatal (sem cabeçalho reconhecível). */
  error?: string;
}

export function parseProductsCsv(text: string): ParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { products: [], warnings: [], error: "Planilha vazia ou sem linhas de produto." };
  }

  const headers = mapHeaders(rows[0]);
  if (headers.name === undefined || headers.price === undefined) {
    return {
      products: [],
      warnings: [],
      error: "Cabeçalho não reconhecido — a planilha precisa ter pelo menos as colunas DESCRIÇÃO DO PRODUTO e PREÇO PIX/DINHEIRO (R$).",
    };
  }

  const warnings: string[] = [];
  const cell = (row: string[], key: ColumnKey) =>
    headers[key] !== undefined ? (row[headers[key]!] ?? "").trim() : "";

  /** Agrupa por nome+marca+tamanho — linhas iguais com cor/aroma/sabor
   *  diferentes viram variações do mesmo produto. */
  const groups = new Map<string, ParsedProduct>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = cell(row, "name");
    if (!name) {
      warnings.push(`Linha ${i + 1}: sem descrição do produto — ignorada.`);
      continue;
    }
    const price = parseBrNumber(cell(row, "price"));
    if (price === undefined || price <= 0) {
      warnings.push(`Linha ${i + 1} (${name}): preço inválido — ignorada.`);
      continue;
    }

    const brand = cell(row, "brand") || undefined;
    const size = cell(row, "size") || undefined;
    const variationName = cell(row, "variation");
    const sku = cell(row, "sku") || undefined;
    const stock = Math.max(0, Math.round(parseBrNumber(cell(row, "stock")) ?? 0));

    const key = [name, brand ?? "", size ?? ""].join("§").toLowerCase();
    let p = groups.get(key);
    if (!p) {
      p = {
        name,
        category: cell(row, "category"),
        brand,
        size,
        price,
        costPrice: parseBrNumber(cell(row, "cost")),
        taxPercent: parseBrNumber(cell(row, "tax")),
        pointsEarned: parseBrNumber(cell(row, "pointsEarned")),
        loyaltyPoints: parseBrNumber(cell(row, "pointsRedeem")),
        sku: undefined,
        stock: 0,
        variations: [],
      };
      groups.set(key, p);
    }

    if (variationName) {
      if (p.variations.some(v => v.name.toLowerCase() === variationName.toLowerCase())) {
        warnings.push(`Linha ${i + 1} (${name}): variação "${variationName}" repetida — ignorada.`);
        continue;
      }
      p.variations.push({
        id: `var_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        name: variationName,
        sku: sku ?? "",
        stock,
      });
      p.stock += stock;
    } else if (p.variations.length === 0 && p.stock === 0 && !p.sku) {
      // produto simples (primeira linha do grupo sem variação)
      p.sku = sku;
      p.stock = stock;
    } else {
      warnings.push(`Linha ${i + 1} (${name}): linha duplicada sem COR/AROMA/SABOR — ignorada.`);
    }
  }

  return { products: Array.from(groups.values()), warnings };
}
