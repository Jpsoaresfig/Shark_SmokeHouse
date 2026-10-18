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
 * Chave do registro de AUDITORIA de um envio bloqueado (anti-spam/opt-out) de
 * campanha. É diferente da chave de envio (`campaign:{id}:{uid}`) de propósito:
 * se o skip usasse a mesma chave, o doc viraria um "já enviado" permanente e o
 * cliente nunca mais receberia a campanha (nem num reprocessamento).
 */
export function campaignSkipKey(campaignId: string, userId: string, dayKey: string): string {
  return `skip:campaign:${campaignId}:${userId}:${dayKey}`;
}

/** Hash curto e determinístico (FNV-1a 32 bits) no alfabeto dos cupons. */
function shortHash(input: string, length = 5): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARS[h % CHARS.length];
    h = Math.floor(h / CHARS.length);
  }
  return out;
}

/**
 * Código de cupom DETERMINÍSTICO por automação + dia. Todos os destinatários da
 * mesma automação no mesmo dia compartilham o código (1 cupom/dia), o que evita
 * criar dezenas de cupons e mantém a idempotência: se o cron rodar de novo no
 * mesmo dia, o cupom já existe e é reaproveitado.
 *
 * A chave é o ID da automação (não só o evento): duas automações do mesmo
 * evento no mesmo dia (ex.: duas "promoção de produto" com descontos
 * diferentes) antes compartilhavam o mesmo cupom — a segunda reaproveitava o
 * cupom (e o desconto) da primeira. O evento continua no código só para leitura.
 * Tudo em maiúsculas: o checkout normaliza o código digitado para maiúsculas.
 */
export function automationCouponCode(automationId: string, event: string, dayKey: string): string {
  const tag = event.replace(/_/g, "").toUpperCase().slice(0, 8);
  const date = dayKey.replace(/-/g, "").slice(2);
  return `MKT${tag}-${shortHash(automationId)}-${date}`;
}
