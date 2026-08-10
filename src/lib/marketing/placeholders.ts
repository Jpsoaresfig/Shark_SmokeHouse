/**
 * Placeholders das mensagens de marketing — módulo puro.
 *
 * Tokens suportados (pt-BR): {{nome}}, {{cupom}}, {{valor}}, {{link}},
 * {{dias_sem_comprar}}, {{produto}}, {{pontos}}, {{data_aniversario}}.
 * A renderização nunca lança erro e deixa o token vazio quando o valor não
 * está disponível.
 */
import type { MarketingContact } from "@/types/marketing";

export const STORE_NAME = "Shark SmokeHouse";

export interface MessageVars {
  nome?: string;
  cupom?: string;
  valor?: string;
  link?: string;
  dias_sem_comprar?: string;
  produto?: string;
  pontos?: string;
  data_aniversario?: string;
}

/** Lista de placeholders documentados (para o seletor do editor). */
export const PLACEHOLDER_HELP: { token: string; description: string }[] = [
  { token: "{{nome}}", description: "Nome completo do cliente" },
  { token: "{{cupom}}", description: "Código do cupom vinculado" },
  { token: "{{valor}}", description: "Valor do cupom (ex.: 10% ou R$ 10,00)" },
  { token: "{{link}}", description: "Link da campanha/automação" },
  { token: "{{dias_sem_comprar}}", description: "Dias sem comprar (recuperação)" },
  { token: "{{produto}}", description: "Produto em destaque da promoção" },
  { token: "{{pontos}}", description: "Saldo de pontos do cliente" },
  { token: "{{data_aniversario}}", description: "Data do aniversário (dd/mm)" },
];

function fmtCouponValue(type?: string, value?: number): string {
  if (type === "percent" && typeof value === "number") return `${value}%`;
  if (type === "fixed" && typeof value === "number") return `R$ ${value.toFixed(2).replace(".", ",")}`;
  return value != null ? String(value) : "";
}

/** Monta as variáveis de uma mensagem a partir do contato + extras. */
export function buildMessageVars(
  contact: Pick<MarketingContact, "name" | "loyaltyPoints" | "birthDate">,
  extra: {
    coupon?: string;
    couponValue?: number;
    couponType?: string;
    link?: string;
    product?: string;
    diasSemComprar?: number;
  } = {},
): MessageVars {
  const vars: MessageVars = {
    nome: contact.name?.trim() || "cliente",
    pontos: contact.loyaltyPoints != null ? String(contact.loyaltyPoints) : "",
  };
  if (extra.coupon) vars.cupom = extra.coupon;
  if (extra.couponValue != null) vars.valor = fmtCouponValue(extra.couponType, extra.couponValue);
  if (extra.link) vars.link = extra.link;
  if (extra.product) vars.produto = extra.product;
  if (extra.diasSemComprar != null) vars.dias_sem_comprar = String(extra.diasSemComprar);
  if (contact.birthDate && contact.birthDate.length >= 10) {
    vars.data_aniversario = `${contact.birthDate.slice(8, 10)}/${contact.birthDate.slice(5, 7)}`;
  }
  return vars;
}

/** Substitui os placeholders {{chave}} por seus valores (chave case-insensitive). */
export function renderMessage(message: string | undefined, vars: MessageVars): string {
  return (message ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (match, key) => {
    const value = vars[String(key).toLowerCase() as keyof MessageVars];
    return value == null ? "" : String(value);
  });
}

/** Lista os tokens usados em uma mensagem (ordem de aparição, sem duplicatas). */
export function extractPlaceholders(message: string | undefined): string[] {
  const out = new Set<string>();
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message ?? ""))) out.add(m[1].toLowerCase());
  return [...out];
}
