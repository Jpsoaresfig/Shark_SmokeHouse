import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy, runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { Product } from "@/types";

const COL = "products";

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
  return cached("products", async () => {
    const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  }, force);
}

export async function getActiveProducts(force = false): Promise<Product[]> {
  return (await getProducts(force)).filter(p => p.active === true);
}

export async function getFeaturedProducts(maxCount = 4): Promise<Product[]> {
  return (await getProducts())
    .filter(p => p.active === true && p.featured === true)
    .slice(0, maxCount);
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...clean(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate("products");
  return ref.id;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...clean(data), updatedAt: serverTimestamp() });
  invalidate("products");
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate("products");
}
