import {
  collection, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, query, orderBy, increment, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { invalidate } from "@/lib/firebase/cache";
import { adjustVariationStock } from "@/lib/firebase/products";
import type { StockMovement, MovementType } from "@/types";

const COL = "stockMovements";

export async function getStockMovements(limitCount = 100): Promise<StockMovement[]> {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc"), limit(limitCount))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
}

export async function addStockMovement(
  data: Omit<StockMovement, "id" | "createdAt">,
): Promise<void> {
  const additive: MovementType[] = ["in", "adjustment"];
  const delta = additive.includes(data.type) ? data.quantity : -data.quantity;
  // Variação específica → baixa no estoque da variação (e recomputa o agregado);
  // senão, ajusta o estoque simples do produto.
  if (data.variationId) {
    await adjustVariationStock(data.productId, data.variationId, delta);
  } else {
    await updateDoc(doc(db, "products", data.productId), {
      stock: increment(delta),
      updatedAt: serverTimestamp(),
    });
  }
  await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
  invalidate("products"); // o estoque do produto mudou
}
