import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * SOMENTE SERVIDOR — validação da assinatura `x-signature` dos webhooks do
 * Mercado Pago (https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).
 *
 * Header: `x-signature: ts=<ts>,v1=<hmac-sha256 hex>`
 * Manifesto assinado: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * (partes ausentes são omitidas; `data.id` alfanumérico vai em minúsculas).
 * Chave: "assinatura secreta" do painel do MP (Suas integrações → Webhooks).
 */

export interface MercadoPagoSignatureInput {
  xSignature: string | null;
  xRequestId: string | null;
  /** `data.id` da querystring da notificação. */
  dataId: string | null;
  secret: string;
}

/** Extrai `ts` e `v1` do header `x-signature`. */
export function parseSignatureHeader(header: string | null): { ts?: string; v1?: string } {
  const out: { ts?: string; v1?: string } = {};
  for (const part of (header ?? "").split(",")) {
    const [k, ...rest] = part.split("=");
    const key = k?.trim();
    const value = rest.join("=").trim();
    if (key === "ts") out.ts = value;
    else if (key === "v1") out.v1 = value;
  }
  return out;
}

/** Monta o manifesto no formato exigido pelo MP. */
export function buildSignatureManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let manifest = "";
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

/** True quando a assinatura confere com a chave secreta. */
export function verifyMercadoPagoSignature(input: MercadoPagoSignatureInput): boolean {
  const { ts, v1 } = parseSignatureHeader(input.xSignature);
  if (!ts || !v1 || !input.secret) return false;
  const expected = createHmac("sha256", input.secret)
    .update(buildSignatureManifest(input.dataId, input.xRequestId, ts))
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
