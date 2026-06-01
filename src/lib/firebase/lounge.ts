import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { LoungeBooking, BookingStatus } from "@/types";

const COL = "lounge_bookings";

/** Fetch all bookings ordered by reservation date (newest first by createdAt) */
export async function getLoungeBookings(): Promise<LoungeBooking[]> {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoungeBooking));
}

/** Public create — used by the booking form (no auth required by rules) */
export async function createLoungeBooking(
  data: Omit<LoungeBooking, "id" | "status" | "createdAt">
): Promise<string> {
  // Firestore rejeita `undefined` — remove campos opcionais vazios (ex.: email,
  // notes) antes de gravar, senão a reserva falha quando não são preenchidos.
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== "")
  );
  const ref = await addDoc(collection(db, COL), {
    ...clean,
    status: "pending" as BookingStatus,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Admin-only: update booking status */
export async function updateLoungeBookingStatus(
  id: string,
  status: BookingStatus
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status,
    updatedAt: serverTimestamp(),
  });
}

/** Admin-only: hard delete a booking */
export async function deleteLoungeBooking(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
