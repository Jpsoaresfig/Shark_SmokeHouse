/**
 * Utilitários puros para preparar dados de escrita no Firestore (módulo de
 * marketing). Sem dependência de Firebase — testável.
 */

/**
 * Remove campos `undefined` (recursivo em objetos/arrays simples) antes de
 * gravar. O Admin SDK (src/lib/firebase/admin.ts) não usa
 * `ignoreUndefinedProperties` e REJEITA a escrita inteira se algum campo for
 * undefined — antes um `link`/`couponCode` ausente derrubava o cron no meio.
 * Sentinelas (FieldValue), Timestamps e Dates não são objetos simples e passam
 * intactos.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((v) => v !== undefined).map((v) => stripUndefinedDeep(v)) as T;
  }
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Monta o payload de um `updateDoc` em que campo `undefined` significa
 * "APAGAR o campo". O Firestore do cliente usa `ignoreUndefinedProperties`, então
 * um `undefined` simplesmente era ignorado e o valor antigo ficava (o admin não
 * conseguia limpar validade, pedido mínimo, link, cupom…). Recebe a sentinela de
 * remoção por parâmetro (`deleteField()`) para continuar puro/testável.
 * Só o 1º nível vira remoção; mapas aninhados são gravados inteiros.
 */
export function updatePayload<S>(
  data: Record<string, unknown>,
  deleteSentinel: () => S,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = v === undefined ? deleteSentinel() : stripUndefinedDeep(v);
  }
  return out;
}
