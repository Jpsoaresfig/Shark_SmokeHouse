import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, serverTimestamp, query, orderBy, where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { Event } from "@/types";

const COLLECTION = "events";

export async function getEvents(onlyActive = false): Promise<Event[]> {
  const q = onlyActive
    ? query(collection(db, COLLECTION), where("active", "==", true), orderBy("date", "desc"))
    : query(collection(db, COLLECTION), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Event));
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
  const ref_ = await addDoc(collection(db, COLLECTION), {
    ...data,
    imageUrl,
    createdAt: serverTimestamp(),
  });
  return { id: ref_.id, ...data, imageUrl, createdAt: new Date().toISOString() };
}

export async function updateEvent(
  id: string,
  data: Partial<Omit<Event, "id" | "createdAt">>,
  imageFile?: File
): Promise<void> {
  let update = { ...data, updatedAt: serverTimestamp() };
  if (imageFile) {
    const imageUrl = await uploadEventImage(imageFile, id);
    update = { ...update, imageUrl };
  }
  await updateDoc(doc(db, COLLECTION, id), update);
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
}

export async function toggleEventActive(id: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), { active, updatedAt: serverTimestamp() });
}

async function uploadEventImage(file: File, eventId?: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const name = eventId ?? `new_${Date.now()}`;
  const storageRef = ref(storage, `events/${name}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}
