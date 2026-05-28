import {
  collection, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, query, orderBy, increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { StockMovement, MovementType } from "@/types";

const COL = "stockMovements";

export async function getStockMovements(): Promise<StockMovement[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
}

export async function addStockMovement(
  data: Omit<StockMovement, "id" | "createdAt">,
): Promise<void> {
  const additive: MovementType[] = ["in", "adjustment"];
  const delta = additive.includes(data.type) ? data.quantity : -data.quantity;
  await updateDoc(doc(db, "products", data.productId), {
    stock: increment(delta),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
  });
}
