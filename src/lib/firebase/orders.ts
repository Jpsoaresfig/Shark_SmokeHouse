import {
  collection, getDocs, addDoc, updateDoc,
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

export async function createOrder(
  data: Omit<Order, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
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

/** Cliente confirmou que efetuou a compra combinada pelo WhatsApp. */
export async function confirmWhatsappOrder(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    awaitingConfirmation: false,
    statusHistory: arrayUnion({
      status: "received",
      timestamp: new Date().toISOString(),
      note: "Compra confirmada pelo cliente (WhatsApp)",
    }),
    updatedAt: serverTimestamp(),
  });
}

/** Marks an order's purchase points as credited so they're never awarded twice. */
export async function markOrderPointsAwarded(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    pointsAwarded: true,
    updatedAt: serverTimestamp(),
  });
}
