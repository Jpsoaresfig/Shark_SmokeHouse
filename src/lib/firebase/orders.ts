import {
  collection, getDocs, addDoc, updateDoc,
  doc, serverTimestamp, query, orderBy, where, arrayUnion, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, OrderStatus, PaymentEvent, PaymentStatus } from "@/types";

const COL = "orders";

/* Firestore rejeita qualquer valor `undefined`, inclusive aninhado em objetos
   ou arrays (ex: deliveryAddress.complement, notes, item.notes). Remove esses
   campos recursivamente antes de gravar. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

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
    ...stripUndefined(data),
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

/**
 * Atualiza o status financeiro (baixa manual do admin ou, no futuro, webhook do
 * Asaas). Grava em `payment.status`, acrescenta um evento no `payment.history` e,
 * quando `paid`, registra `paidAt`/`confirmedBy`. Espelha o campo legado
 * `paymentStatus` para compatibilidade.
 */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  opts: { note?: string; by?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const event: PaymentEvent = {
    status,
    timestamp: now,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.by ? { by: opts.by } : {}),
  };
  await updateDoc(doc(db, COL, id), {
    "payment.status": status,
    "payment.history": arrayUnion(event),
    ...(status === "paid"
      ? { "payment.paidAt": now, ...(opts.by ? { "payment.confirmedBy": opts.by } : {}) }
      : {}),
    paymentStatus: status, // espelho legado
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
    "payment.history": arrayUnion({
      status: "in_negotiation",
      timestamp: new Date().toISOString(),
      note: "Compra confirmada pelo cliente (WhatsApp)",
    } satisfies PaymentEvent),
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
