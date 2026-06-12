/**
 * Lê um arquivo enviado pelo admin (CSV **ou** Excel .xlsx/.xls) e devolve os
 * produtos já agrupados. Aceitar .xlsx evita o passo manual de "Salvar como CSV".
 */
import * as XLSX from "xlsx";
import { parseProductsCsv, parseProductsRows, type ParseResult } from "./csvImport";

/** true para .xlsx/.xls (zip "PK…" ou OLE) — qualquer coisa fora disso é CSV. */
function isExcelFile(file: File): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(file.name) ||
    file.type.includes("spreadsheetml") ||
    file.type === "application/vnd.ms-excel";
}

/** Lê uma planilha Excel para linhas de células (valores formatados, ex.: "R$ 3,50"). */
async function readExcelRows(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  // raw:false → usa o texto formatado da célula (mantém "R$ 3,50", "18%", SKUs como texto).
  return XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  }).map(row => row.map(c => (c == null ? "" : String(c).trim())));
}

/** Faz o parse do arquivo enviado, detectando CSV vs Excel automaticamente. */
export async function parseProductsFile(file: File): Promise<ParseResult> {
  if (isExcelFile(file)) {
    const rows = await readExcelRows(file);
    return parseProductsRows(rows);
  }
  return parseProductsCsv(await file.text());
}
