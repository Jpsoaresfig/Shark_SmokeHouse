import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { Product } from "@/types";

const COL = "products";

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
