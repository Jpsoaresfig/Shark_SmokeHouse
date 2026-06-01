/**
 * Cache em memória (por aba) para leituras do Firestore, para navegar pelo admin
 * sem refazer a mesma busca a cada visita. TTL curto + invalidação nas escritas
 * garantem que nunca se mostre dado velho após criar/editar.
 */
const store = new Map<string, { data: unknown; ts: number }>();
const TTL = 45_000; // 45s

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  force = false,
): Promise<T> {
  const hit = store.get(key);
  if (!force && hit && Date.now() - hit.ts < TTL) {
    return hit.data as T;
  }
  const data = await fetcher();
  store.set(key, { data, ts: Date.now() });
  return data;
}

/** Remove do cache todas as chaves que começam com `prefix` (ex.: "events"). */
export function invalidate(prefix: string): void {
  for (const k of [...store.keys()]) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
