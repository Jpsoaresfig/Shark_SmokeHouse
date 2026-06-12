/**
 * Lê um arquivo enviado pelo admin (CSV **ou** Excel .xlsx/.xls) e devolve os
 * produtos já agrupados. Aceitar .xlsx evita o passo manual de "Salvar como CSV".
 */
import * as XLSX from "xlsx";
import { parseProductsCsv, parseProductsRows, findHeaderRow, type ParseResult } from "./csvImport";

/** true para .xlsx/.xls (zip "PK…" ou OLE) — qualquer coisa fora disso é CSV. */
function isExcelFile(file: File): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name) ||
    file.type.includes("spreadsheetml") ||
    file.type === "application/vnd.ms-excel";
}

/** Converte uma aba do Excel em linhas de células (valores formatados, ex.: "R$ 3,50"). */
function sheetToRows(sheet: XLSX.WorkSheet): string[][] {
  // raw:false → usa o texto formatado da célula (mantém "R$ 3,50", "18%", SKUs como texto).
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }).map(row => row.map(c => (c == null ? "" : String(c).trim())));
}

/**
 * Lê a planilha Excel escolhendo a aba cujo cabeçalho é reconhecível.
 * Se nenhuma aba tiver cabeçalho válido, devolve a primeira (para a mensagem
 * de erro mostrar o que foi lido).
 */
async function readExcelRows(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  let firstRows: string[][] | undefined;
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = sheetToRows(sheet);
    if (firstRows === undefined) firstRows = rows;
    if (findHeaderRow(rows) !== -1) return rows; // aba com cabeçalho válido
  }
  return firstRows ?? [];
}

/**
 * Decodifica os bytes de um CSV respeitando o encoding.
 * Excel pt-BR no Windows salva CSV como ANSI/Windows-1252 (não UTF-8), o que
 * transforma "PREÇO"/"AÇÚCAR" em lixo se lido como UTF-8. Tentamos UTF-8 estrito
 * e, se houver byte inválido, caímos para Windows-1252.
 */
export function decodeCsv(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Faz o parse do arquivo enviado, detectando CSV vs Excel automaticamente. */
export async function parseProductsFile(file: File): Promise<ParseResult> {
  if (isExcelFile(file)) {
    const rows = await readExcelRows(file);
    return parseProductsRows(rows);
  }
  return parseProductsCsv(decodeCsv(await file.arrayBuffer()));
}
