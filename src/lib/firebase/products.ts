import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, deleteField, setDoc, writeBatch,
  doc, serverTimestamp, query, orderBy, runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { useAuthStore } from "@/stores/authStore";
import type { Product } from "@/types";

const COL = "products";

/* ── Custos (uso interno) ──────────────────────────────────────
   `costPrice`/`taxPercent` NÃO ficam no documento do produto: `products` é
   público (a loja lê sem login), então qualquer visitante via o custo e a
   margem. Eles vivem em `productCosts/{productId}`, legível só pela equipe, e
   são mesclados no Product quando quem está logado é admin/vendedor — as
   páginas do admin continuam lendo `product.costPrice` como antes. */
const COSTS = "productCosts";
const COST_KEYS = ["costPrice", "taxPercent"] as const;
type CostFields = Pick<Product, "costPrice" | "taxPercent">;

function isStaffSession(): boolean {
  const role = useAuthStore.getState().user?.role;
  return role === "admin" || role === "seller";
}

/** Separa os campos de custo do restante dos dados do produto. */
function splitCosts<T extends Partial<Product>>(data: T): { rest: Omit<T, "costPrice" | "taxPercent">; costs: CostFields; hasCosts: boolean } {
  const { costPrice, taxPercent, ...rest } = data;
  const hasCosts = COST_KEYS.some((k) => k in data);
  return { rest, costs: { costPrice, taxPercent }, hasCosts };
}

async function getProductCosts(force = false): Promise<Map<string, CostFields>> {
  return cached(COSTS, async () => {
    const snap = await getDocs(collection(db, COSTS));
    return new Map(snap.docs.map((d) => [d.id, d.data() as CostFields]));
  }, force);
}

let costsMigrated = false;
/** Migração automática (uma vez por sessão da equipe): produtos antigos ainda
 *  com custo no documento público têm o custo copiado para `productCosts` e
 *  removido do produto. */
async function migrateLegacyCosts(products: Product[], costs: Map<string, CostFields>): Promise<void> {
  if (costsMigrated) return;
  costsMigrated = true;
  const legacy = products.filter((p) => COST_KEYS.some((k) => p[k] !== undefined));
  for (let i = 0; i < legacy.length; i += 200) {
    const batch = writeBatch(db);
    for (const p of legacy.slice(i, i + 200)) {
      const current = costs.get(p.id) ?? {};
      const merged: Record<string, unknown> = {};
      for (const k of COST_KEYS) {
        const v = current[k] ?? p[k];
        if (v !== undefined) merged[k] = v;
      }
      batch.set(doc(db, COSTS, p.id), merged, { merge: true });
      batch.update(doc(db, COL, p.id), { costPrice: deleteField(), taxPercent: deleteField() });
    }
    await batch.commit();
  }
  if (legacy.length) {
    invalidate(COL);
    invalidate(COSTS);
  }
}

/**
 * Ajusta o estoque de uma variação (delta) e recomputa o `stock` agregado do
 * produto, atomicamente (transação). Usado na baixa/estorno de pedidos online e
 * vendas do PDV quando o item é de uma variação específica.
 */
export async function adjustVariationStock(
  productId: string,
  variationId: string,
  delta: number,
): Promise<void> {
  const ref = doc(db, COL, productId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() as Product;
    const variations = (data.variations ?? []).map(v =>
      v.id === variationId ? { ...v, stock: Math.max(0, (v.stock ?? 0) + delta) } : v
    );
    const stock = variations.reduce((s, v) => s + (v.stock ?? 0), 0);
    tx.update(ref, { variations, stock, updatedAt: serverTimestamp() });
  });
  invalidate("products");
}

/** Firestore rejects undefined values — strip them before writing */
function clean<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== "")
  ) as Partial<T>;
}

export async function getProducts(force = false): Promise<Product[]> {
  const products = await cached("products", async () => {
    const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }, force);
  if (!isStaffSession()) return products;
  // Equipe: mescla os custos (coleção restrita). O custo legado ainda no
  // documento do produto vale como fallback até a migração.
  let costs: Map<string, CostFields>;
  try {
    costs = await getProductCosts(force);
  } catch (err) {
    console.error("[products] falha ao ler custos", err);
    return products;
  }
  void migrateLegacyCosts(products, costs).catch((err) =>
    console.error("[products] falha ao migrar custos", err),
  );
  return products.map((p) => {
    const c = costs.get(p.id);
    if (!c) return p;
    return {
      ...p,
      ...(c.costPrice !== undefined ? { costPrice: c.costPrice } : {}),
      ...(c.taxPercent !== undefined ? { taxPercent: c.taxPercent } : {}),
    };
  });
}

/** Grava os custos do produto na coleção restrita. Com `clearEmpty`, custo
 *  `undefined` é apagado (editor do admin limpando o campo). */
async function writeProductCosts(id: string, costs: CostFields, clearEmpty: boolean): Promise<string[]> {
  const payload: Record<string, unknown> = {};
  for (const k of COST_KEYS) {
    const v = costs[k];
    if (v !== undefined && !Number.isNaN(v)) payload[k] = v;
    else if (clearEmpty) payload[k] = deleteField();
  }
  const keys = Object.keys(payload);
  if (!keys.length) return [];
  await setDoc(doc(db, COSTS, id), payload, { merge: true });
  invalidate(COSTS);
  return keys;
}

export async function getActiveProducts(force = false): Promise<Product[]> {
  // `internal` = produto de uso interno (controle do admin): nunca vai pra loja.
  return (await getProducts(force)).filter(p => p.active === true && p.internal !== true);
}

export async function getFeaturedProducts(maxCount = 4): Promise<Product[]> {
  return (await getProducts())
    .filter(p => p.active === true && p.internal !== true && p.featured === true)
    .slice(0, maxCount);
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const { rest, costs, hasCosts } = splitCosts(data);
  const ref = await addDoc(collection(db, COL), {
    ...clean(rest),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (hasCosts) await writeProductCosts(ref.id, costs, false);
  invalidate("products");
  return ref.id;
}

/**
 * Atualiza um produto. Por padrão, campos `undefined`/"" são IGNORADOS (não
 * alteram o documento — usado na importação de planilha, onde coluna ausente
 * significa "manter"). Com `opts.clearEmpty`, as chaves presentes em `data`
 * com `undefined` são APAGADAS do documento (e "" é gravado como "") —
 * necessário no editor do admin para conseguir limpar um campo (ex.: remover `compareAtPrice`, desligar
 * `redeemDisabled`, tornar o item não resgatável removendo `loyaltyPoints`).
 */
export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id" | "createdAt">>,
  opts: { clearEmpty?: boolean } = {},
): Promise<void> {
  const { rest, costs, hasCosts } = splitCosts(data);
  const payload: Record<string, unknown> = opts.clearEmpty
    ? Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, v === undefined ? deleteField() : v]),
      )
    : clean(rest);
  if (hasCosts) {
    // Garante que o custo gravado não fique (ou volte) no documento público.
    for (const k of await writeProductCosts(id, costs, !!opts.clearEmpty)) payload[k] = deleteField();
  }
  await updateDoc(doc(db, COL, id), { ...payload, updatedAt: serverTimestamp() });
  invalidate("products");
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  await deleteDoc(doc(db, COSTS, id)).catch(() => undefined);
  invalidate("products");
  invalidate(COSTS);
}
