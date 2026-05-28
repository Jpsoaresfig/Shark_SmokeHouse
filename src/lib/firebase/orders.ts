import {
  collection, getDocs, updateDoc,
  doc, serverTimestamp, query, orderBy, where, arrayUnion, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, OrderStatus } from "@/types";

const COL = "orders";

export async function getOrders(limitCount?: number): Promise<Order[]> {
  const q = limitCount
    ? query(collection(db, COL), orderBy("createdAt", "desc"), limit(limitCount))
    : query(collection(db, COL), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
}

export async function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  const snap = await getDocs(
    query(
      collection(db, COL),
      where("customerId", "==", customerId),
      orderBy("createdAt", "desc")
    )
  );
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
