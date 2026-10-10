/**
 * Auxiliares de WhatsApp do módulo de marketing — módulo puro.
 * Converte o telefone do cliente para o formato wa.me (55 + dígitos) e monta
 * o link de conversa com a mensagem já renderizada. Não envia por API: o fluxo
 * abre o WhatsApp no aparelho do admin (envio manual, claramente identificado).
 */

/**
 * Só os dígitos do telefone, com o código do Brasil (55). Aceita "+55 …",
 * "(83) 9…" e o zero de discagem ("083 9…"); devolve ""
 * quando o número não forma um telefone BR válido (DDD + 8/9 dígitos) — antes
 * qualquer lixo virava "55<lixo>" e gerava um link wa.me quebrado.
 */
export function digitsOfPhone(phone: string | undefined | null): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  // Já com DDI: 55 + DDD (2) + 8/9 dígitos.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  // Zero de discagem nacional ("083 9…").
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return "";
}

/** Telefone BR válido (DDD + 8/9 dígitos, com ou sem +55)? */
export function isValidBrPhone(phone: string | undefined | null): boolean {
  return digitsOfPhone(phone) !== "";
}

/** Link wa.me com a mensagem pré-preenchida. */
export function waLink(phone: string | undefined | null, message: string): string {
  const digits = digitsOfPhone(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Telefone para exibição amigável (83 99902-0606). */
export function prettyPhone(phone: string | undefined | null): string {
  if (!phone) return "";
  const digits = digitsOfPhone(phone).replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return String(phone ?? "");
}
