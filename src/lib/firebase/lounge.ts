import {
  collection, getDocs, updateDoc, deleteDoc, deleteField,
  doc, serverTimestamp, query, orderBy, where, runTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { slotId, validateBooking } from "@/lib/booking";
import type { LoungeBooking, BookingStatus } from "@/types";

const COL = "lounge_bookings";
const SLOTS = "lounge_slots";

/** Erro lançado quando o horário escolhido já está reservado. */
export const SLOT_TAKEN = "SLOT_TAKEN";

/** Fetch all bookings ordered by reservation date (newest first by createdAt) */
export async function getLoungeBookings(): Promise<LoungeBooking[]> {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoungeBooking));
}

/**
 * Horários já reservados (pending/approved) de uma data. Lê a coleção pública
 * `lounge_slots` (só data/horário, sem PII), então pode ser chamada pelo
 * formulário público para desabilitar os horários ocupados.
 */
export async function getTakenSlots(date: string): Promise<string[]> {
  const snap = await getDocs(query(collection(db, SLOTS), where("date", "==", date)));
  return snap.docs.map((d) => d.data().time as string);
}

/**
 * Public create — used by the booking form (no auth required by rules).
 * Bloqueia data passada e conflito de horário: a reserva e a trava do slot são
 * gravadas numa transação atômica; se o slot já existir, lança `SLOT_TAKEN`.
 */
export async function createLoungeBooking(
  data: Omit<LoungeBooking, "id" | "status" | "createdAt">,
  opts: { status?: BookingStatus } = {},
): Promise<string> {
  const invalid = validateBooking(data);
  if (invalid) throw new Error(invalid);

  // Firestore rejeita `undefined` — remove campos opcionais vazios (ex.: email,
  // notes) antes de gravar, senão a reserva falha quando não são preenchidos.
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== "")
  );

  const slotRef = doc(db, SLOTS, slotId(data.date, data.time));
  const bookingRef = doc(collection(db, COL));

  // As regras exigem status "pending" na criação; a reserva sempre nasce pending.
  await runTransaction(db, async (tx) => {
    const slot = await tx.get(slotRef);
    if (slot.exists()) throw new Error(SLOT_TAKEN);
    tx.set(slotRef, { date: data.date, time: data.time, createdAt: serverTimestamp() });
    tx.set(bookingRef, { ...clean, status: "pending" as BookingStatus, createdAt: serverTimestamp() });
  });

  // Admin pode já criar a reserva confirmada — atualiza logo após (update é admin-only).
  if (opts.status && opts.status !== "pending") {
    await updateDoc(bookingRef, { status: opts.status, updatedAt: serverTimestamp() });
  }

  return bookingRef.id;
}

/**
 * Admin-only: edita os dados de uma reserva. Quando a data/horário muda, reclama
 * o novo slot atomicamente (lança `SLOT_TAKEN` se ocupado) e libera o antigo.
 * Campos opcionais vazios (email, notes, guestCount) são removidos do documento.
 */
export async function updateLoungeBooking(
  id: string,
  data: Omit<LoungeBooking, "id" | "status" | "createdAt">,
  opts: { oldDate: string; oldTime: string; status?: BookingStatus },
): Promise<void> {
  const invalid = validateBooking(data);
  if (invalid) throw new Error(invalid);

  const ref = doc(db, COL, id);
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    whatsapp: data.whatsapp.trim(),
    date: data.date,
    time: data.time,
    email: data.email?.trim() ? data.email.trim() : deleteField(),
    notes: data.notes?.trim() ? data.notes.trim() : deleteField(),
    guestCount: data.guestCount != null ? data.guestCount : deleteField(),
    updatedAt: serverTimestamp(),
  };

  // Reservas canceladas não ocupam slot, então não há trava a mover.
  const slotChanged =
    opts.status !== "cancelled" && (data.date !== opts.oldDate || data.time !== opts.oldTime);
  if (slotChanged) {
    const newSlotRef = doc(db, SLOTS, slotId(data.date, data.time));
    await runTransaction(db, async (tx) => {
      const slot = await tx.get(newSlotRef);
      if (slot.exists()) throw new Error(SLOT_TAKEN);
      tx.set(newSlotRef, { date: data.date, time: data.time, createdAt: serverTimestamp() });
      tx.update(ref, payload);
    });
    await releaseSlot(opts.oldDate, opts.oldTime);
  } else {
    await updateDoc(ref, payload);
  }
}

/** Remove a trava do slot, liberando o horário para novas reservas. */
async function releaseSlot(date: string, time: string): Promise<void> {
  await deleteDoc(doc(db, SLOTS, slotId(date, time)));
}

/**
 * Admin-only: update booking status. Ao cancelar, libera o slot; ao reativar
 * (de "cancelled" para pending/approved), reclama o slot atomicamente e lança
 * `SLOT_TAKEN` se outra reserva já tiver ocupado o horário.
 */
export async function updateLoungeBookingStatus(
  id: string,
  status: BookingStatus,
  opts: { date?: string; time?: string; reactivate?: boolean } = {}
): Promise<void> {
  const ref = doc(db, COL, id);

  if (opts.reactivate && opts.date && opts.time) {
    const slotRef = doc(db, SLOTS, slotId(opts.date, opts.time));
    await runTransaction(db, async (tx) => {
      const slot = await tx.get(slotRef);
      if (slot.exists()) throw new Error(SLOT_TAKEN);
      tx.set(slotRef, { date: opts.date, time: opts.time, createdAt: serverTimestamp() });
      tx.update(ref, { status, updatedAt: serverTimestamp() });
    });
    return;
  }

  await updateDoc(ref, { status, updatedAt: serverTimestamp() });
  if (status === "cancelled" && opts.date && opts.time) {
    await releaseSlot(opts.date, opts.time);
  }
}

/** Admin-only: hard delete a booking and free its slot. */
export async function deleteLoungeBooking(
  id: string,
  opts: { date?: string; time?: string } = {}
): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  if (opts.date && opts.time) await releaseSlot(opts.date, opts.time);
}
