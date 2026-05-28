import {
  collection, getDocs, updateDoc,
  doc, serverTimestamp, query, orderBy, arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, OrderStatus } from "@/types";

const COL = "orders";

export async function getOrders(): Promise<Order[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status,
    statusHistory: arrayUnion({
      status,
      timestamp: new Date().toISOString(),
      note: note ?? "",
    }),
    updatedAt: serverTimestamp(),
  });
}
