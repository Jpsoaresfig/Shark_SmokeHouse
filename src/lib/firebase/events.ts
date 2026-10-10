import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, deleteField, serverTimestamp, query, orderBy,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { Event } from "@/types";

const COLLECTION = "events";

export async function getEvents(onlyActive = false, force = false): Promise<Event[]> {
  // Single orderBy avoids needing a composite index in Firestore.
  // Events is a small collection, so filtering "active" in-memory is fine.
  const all = await cached("events", async () => {
    const snap = await getDocs(
      query(collection(db, COLLECTION), orderBy("date", "desc"))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
  }, force);
  return onlyActive ? all.filter((e) => e.active) : all;
}

export async function getEvent(id: string): Promise<Event | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Event;
}

export async function createEvent(
  data: Omit<Event, "id" | "createdAt">,
  imageFile?: File
): Promise<Event> {
  let imageUrl = data.imageUrl;
  if (imageFile) {
    imageUrl = await uploadEventImage(imageFile);
  }
  // Firestore rejeita `undefined` (ex.: endDate vazio em evento de um dia só).
  const clean = Object.fromEntries(
    Object.entries({ ...data, imageUrl: imageUrl ?? "" }).filter(([, v]) => v !== undefined),
  );
  const ref_ = await addDoc(collection(db, COLLECTION), {
    ...clean,
    createdAt: serverTimestamp(),
  });
  invalidate("events");
  return { id: ref_.id, ...data, imageUrl, createdAt: new Date().toISOString() };
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<Event, "id" | "createdAt">>,
  imageFile?: File
): Promise<void> {
  // Remove `undefined` (Firestore rejeita) — exceto `endDate`, cuja ausência
  // explícita significa "encerramento removido" e apaga o campo do documento.
  const clean: Record<string, unknown> = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  if ("endDate" in data && !data.endDate) clean.endDate = deleteField();
  let update: Record<string, unknown> = { ...clean, updatedAt: serverTimestamp() };
  if (imageFile) {
    const imageUrl = await uploadEventImage(imageFile, id);
    update = { ...update, imageUrl };
  }
  await updateDoc(doc(db, COLLECTION, id), update);
  invalidate("events");
}

export async function deleteEvent(id: string, imageUrl?: string): Promise<void> {
  if (imageUrl?.includes("firebasestorage")) {
    try {
      await deleteObject(ref(storage, imageUrl));
    } catch {
      // ignore if already deleted
    }
  }
  await deleteDoc(doc(db, COLLECTION, id));
  invalidate("events");
}

export async function toggleEventActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { active, updatedAt: serverTimestamp() });
  invalidate("events");
}

async function uploadEventImage(file: File, eventId?: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const name = eventId ?? `new_${Date.now()}`;
  const storageRef = ref(storage, `events/${name}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
