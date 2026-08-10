/**
 * Auxiliares de WhatsApp do módulo de marketing — módulo puro.
 * Converte o telefone do cliente para o formato wa.me (55 + dígitos) e monta
 * o link de conversa com a mensagem já renderizada. Não envia por API: o fluxo
 * abre o WhatsApp no aparelho do admin (envio manual, claramente identificado).
 */

/** Só os dígitos do telefone, com o código do Brasil (55). */
export function digitsOfPhone(phone: string | undefined | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
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
