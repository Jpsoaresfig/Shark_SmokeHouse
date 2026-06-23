import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { Announcement } from "@/types";

const COL = "announcements";
const CACHE_KEY = "announcements:active";

/** Avisos ativos, mais recentes primeiro (filtro `active` no cliente p/ dispensar índice). */
export async function getActiveAnnouncements(force = false): Promise<Announcement[]> {
  return cached(CACHE_KEY, async () => {
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Announcement))
      .filter((a) => a.active)
      // createdAt é ISO string → ordenação lexical = cronológica.
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, force);
}

/** Admin: lista todos os avisos (ativos e inativos), mais recentes primeiro. */
export async function getAllAnnouncements(): Promise<Announcement[]> {
  const snap = await getDocs(query(collection(db, COL), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
}

export async function createAnnouncement(
  data: Omit<Announcement, "id" | "createdAt">,
): Promise<string> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== ""),
  );
  const ref = await addDoc(collection(db, COL), {
    ...clean,
    active: data.active,
    createdAt: new Date().toISOString(),
  });
  invalidate(CACHE_KEY);
  return ref.id;
}

export async function updateAnnouncement(
  id: string,
  data: Partial<Pick<Announcement, "title" | "body" | "link" | "active">>,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (data.title !== undefined) clean.title = data.title;
  if (data.body !== undefined) clean.body = data.body;
  if (data.link !== undefined) clean.link = data.link;
  if (data.active !== undefined) clean.active = data.active;
  await updateDoc(doc(db, COL, id), clean);
  invalidate(CACHE_KEY);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate(CACHE_KEY);
}
