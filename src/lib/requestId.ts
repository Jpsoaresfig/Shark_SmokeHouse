/**
 * Request ID / correlation ID — identificador rastreável de ponta a ponta
 * (ex.: `req_8f92ac71`). Usado para correlacionar erros, webhooks, crons e
 * operações de pagamento no Centro de Operações.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Gera um id curto legível: `req_<8 caracteres>`. */
export function createRequestId(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `req_${out}`;
}

/** Reaproveita um request id já presente no header (correlação) ou gera um novo. */
export function requestIdFrom(headers: Headers): string {
  const existing = headers.get("x-request-id");
  if (existing && /^req_[a-z0-9]{4,32}$/i.test(existing)) return existing;
  return createRequestId();
}
