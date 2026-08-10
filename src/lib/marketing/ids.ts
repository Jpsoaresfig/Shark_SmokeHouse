/**
 * Geração de IDs/chaves de deduplicação do módulo de marketing — módulo puro.
 * As chaves viram doc id das execuções, o que garante idempotência: reexecutar
 * o cron (ou um "Enviar agora") não duplica a mensagem do mesmo cliente.
 */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return out;
}

/** Chave de execução de campanha — envia UMA vez por campanha por cliente. */
export function campaignExecutionKey(campaignId: string, userId: string): string {
  return `campaign:${campaignId}:${userId}`;
}

/** Chave de execução de automação — envia UMA vez por dia por automação/cliente. */
export function automationExecutionKey(
  automationId: string,
  userId: string,
  dayKey: string,
): string {
  return `auto:${automationId}:${userId}:${dayKey}`;
}

/** Prefixo (sem o dia) usado para as automações de envio único (boas-vindas). */
export function automationUserKey(automationId: string, userId: string): string {
  return `auto:${automationId}:${userId}`;
}

/** Código de cupom sugerido para campanha ("SHARK-XXXXXX"). */
export function campaignCouponCode(): string {
  return `SHARK-${randomCode(6)}`;
}

/**
 * Código de cupom DETERMINÍSTICO por automação + dia. Todos os destinatários da
 * mesma automação no mesmo dia compartilham o código (1 cupom/dia), o que evita
 * criar dezenas de cupons e mantém a idempotência: se o cron rodar de novo no
 * mesmo dia, o cupom já existe e é reaproveitado.
 */
export function automationCouponCode(event: string, dayKey: string): string {
  const tag = event.replace(/_/g, "").toUpperCase().slice(0, 8);
  const date = dayKey.replace(/-/g, "").slice(2);
  return `MKT${tag}-${date}`;
}
