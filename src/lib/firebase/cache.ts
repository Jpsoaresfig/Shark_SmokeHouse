/**
 * Cache em memória (por aba) para leituras do Firestore, para navegar pelo admin
 * sem refazer a mesma busca a cada visita. TTL curto + invalidação nas escritas
 * garantem que nunca se mostre dado velho após criar/editar.
 */
const store = new Map<string, { data: unknown; ts: number }>();
/** Buscas em andamento — chamadas simultâneas da mesma chave compartilham a leitura. */
const inflight = new Map<string, Promise<unknown>>();
/** Incrementado a cada `invalidate`: uma busca iniciada antes de uma escrita
 *  não grava no cache o resultado (possivelmente anterior à escrita). */
let generation = 0;
const TTL = 45_000; // 45s

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  force = false,
): Promise<T> {
  // No servidor o módulo é compartilhado entre requisições/usuários: sem cache.
  if (typeof window === "undefined") return fetcher();
  const hit = store.get(key);
  if (!force && hit && Date.now() - hit.ts < TTL) {
    return hit.data as T;
  }
  const pending = inflight.get(key);
  if (!force && pending) return pending as Promise<T>;

  const gen = generation;
  const p = fetcher().then(
    (data) => {
      if (gen === generation) store.set(key, { data, ts: Date.now() });
      return data;
    },
  ).finally(() => {
    if (inflight.get(key) === p) inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** Remove do cache todas as chaves que começam com `prefix` (ex.: "events"). */
export function invalidate(prefix: string): void {
  generation++;
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
  for (const k of [...inflight.keys()]) {
    if (k.startsWith(prefix)) inflight.delete(k);
  }
}
