import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { DeliveryArea } from "@/types";

const COL = "deliveryAreas";

/* Tabela inicial (seed) — em arquivo sem Firebase para o servidor também usar. */
export { DEFAULT_DELIVERY_AREAS } from "./delivery.defaults";
import { DEFAULT_DELIVERY_AREAS } from "./delivery.defaults";

/** Normaliza um nome de bairro para comparação (sem acento, minúsculo, trim). */
export function normalizeArea(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .trim();
}

function sortAreas(list: DeliveryArea[]): DeliveryArea[] {
  return [...list].sort((a, b) =>
    (a.region ?? "").localeCompare(b.region ?? "") || a.name.localeCompare(b.name),
  );
}

/** Lista as áreas de entrega. Coleção vazia → devolve a tabela padrão (só leitura). */
export async function getDeliveryAreas(force = false): Promise<DeliveryArea[]> {
  return cached(COL, async () => {
    const snap = await getDocs(collection(db, COL));
    if (snap.empty) {
      return DEFAULT_DELIVERY_AREAS.map((a, i) => ({
        id: `seed-${i}`, name: a.name, fee: a.fee, region: a.region, active: true,
      }));
    }
    return sortAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryArea)));
  }, force);
}

/**
 * Garante que a tabela padrão exista como documentos reais (editáveis).
 * Chamado pela tela do admin: se a coleção está vazia, grava a tabela padrão.
 */
export async function ensureDeliveryAreasSeeded(): Promise<DeliveryArea[]> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) {
    return sortAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryArea)));
  }
  // Firestore aceita no máximo 500 escritas por batch — a lista tem ~70.
  const batch = writeBatch(db);
  DEFAULT_DELIVERY_AREAS.forEach((a) => {
    batch.set(doc(collection(db, COL)), {
      name: a.name, fee: a.fee, region: a.region, active: true, createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
  invalidate(COL);
  return getDeliveryAreas(true);
}

export async function createDeliveryArea(name: string, fee: number, region?: string): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    name: name.trim(),
    fee: Number(fee) || 0,
    ...(region ? { region } : {}),
    active: true,
    createdAt: serverTimestamp(),
  });
  invalidate(COL);
  return ref.id;
}

export async function updateDeliveryArea(
  id: string,
  data: Partial<Pick<DeliveryArea, "name" | "fee" | "region" | "active">>,
): Promise<void> {
  const clean: Record<string, unknown> = {};
  if (data.name !== undefined) clean.name = data.name.trim();
  if (data.fee !== undefined) clean.fee = Number(data.fee) || 0;
  if (data.region !== undefined) clean.region = data.region;
  if (data.active !== undefined) clean.active = data.active;
  await updateDoc(doc(db, COL, id), clean);
  invalidate(COL);
}

export async function deleteDeliveryArea(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate(COL);
}
