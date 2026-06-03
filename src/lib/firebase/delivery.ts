import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import type { DeliveryArea } from "@/types";

const COL = "deliveryAreas";

/** Tabela inicial de bairros e fretes (seed quando a coleção está vazia). */
export const DEFAULT_DELIVERY_AREAS: { name: string; fee: number; region: string }[] = [
  // João Pessoa
  { name: "Aeroclube", fee: 20, region: "João Pessoa" },
  { name: "Água Fria", fee: 10, region: "João Pessoa" },
  { name: "Altiplano Cabo Branco", fee: 15, region: "João Pessoa" },
  { name: "Alto do Céu", fee: 15, region: "João Pessoa" },
  { name: "Alto do Mateus", fee: 20, region: "João Pessoa" },
  { name: "Anatólia", fee: 10, region: "João Pessoa" },
  { name: "Bancários", fee: 10, region: "João Pessoa" },
  { name: "Barra de Gramame", fee: 20, region: "João Pessoa" },
  { name: "Bessa", fee: 20, region: "João Pessoa" },
  { name: "Brisamar", fee: 15, region: "João Pessoa" },
  { name: "Cabo Branco", fee: 15, region: "João Pessoa" },
  { name: "Castelo Branco", fee: 10, region: "João Pessoa" },
  { name: "Centro", fee: 15, region: "João Pessoa" },
  { name: "Cidade dos Colibris", fee: 10, region: "João Pessoa" },
  { name: "Costa do Sol", fee: 10, region: "João Pessoa" },
  { name: "Costa e Silva", fee: 20, region: "João Pessoa" },
  { name: "Cristo Redentor", fee: 15, region: "João Pessoa" },
  { name: "Cruz das Armas", fee: 20, region: "João Pessoa" },
  { name: "Cuiá", fee: 15, region: "João Pessoa" },
  { name: "Distrito Industrial", fee: 15, region: "João Pessoa" },
  { name: "Ernani Sátiro", fee: 20, region: "João Pessoa" },
  { name: "Ernesto Geisel", fee: 15, region: "João Pessoa" },
  { name: "Estados", fee: 15, region: "João Pessoa" },
  { name: "Expedicionários", fee: 15, region: "João Pessoa" },
  { name: "Funcionários", fee: 15, region: "João Pessoa" },
  { name: "Gramame", fee: 15, region: "João Pessoa" },
  { name: "Grotão", fee: 20, region: "João Pessoa" },
  { name: "Ilha do Bispo", fee: 20, region: "João Pessoa" },
  { name: "Indústrias", fee: 30, region: "João Pessoa" },
  { name: "Ipês", fee: 15, region: "João Pessoa" },
  { name: "Jaguaribe", fee: 15, region: "João Pessoa" },
  { name: "Jardim Cidade Universitária", fee: 10, region: "João Pessoa" },
  { name: "Jardim Oceania", fee: 20, region: "João Pessoa" },
  { name: "Jardim São Paulo", fee: 10, region: "João Pessoa" },
  { name: "Jardim Veneza", fee: 20, region: "João Pessoa" },
  { name: "João Agripino", fee: 15, region: "João Pessoa" },
  { name: "João Paulo II", fee: 15, region: "João Pessoa" },
  { name: "José Américo", fee: 10, region: "João Pessoa" },
  { name: "Manaíra", fee: 15, region: "João Pessoa" },
  { name: "Mandacaru", fee: 20, region: "João Pessoa" },
  { name: "Mangabeira", fee: 10, region: "João Pessoa" },
  { name: "Miramar", fee: 15, region: "João Pessoa" },
  { name: "Muçumagro", fee: 15, region: "João Pessoa" },
  { name: "Mumbaba", fee: 30, region: "João Pessoa" },
  { name: "Mussuré", fee: 30, region: "João Pessoa" },
  { name: "Oitizeiro", fee: 15, region: "João Pessoa" },
  { name: "Padre Zé", fee: 20, region: "João Pessoa" },
  { name: "Paratibe", fee: 15, region: "João Pessoa" },
  { name: "Pedro Gondim", fee: 15, region: "João Pessoa" },
  { name: "Penha", fee: 15, region: "João Pessoa" },
  { name: "Planalto da Boa Esperança", fee: 20, region: "João Pessoa" },
  { name: "Ponta do Seixas", fee: 15, region: "João Pessoa" },
  { name: "Portal do Sol", fee: 15, region: "João Pessoa" },
  { name: "Róger", fee: 20, region: "João Pessoa" },
  { name: "São José", fee: 15, region: "João Pessoa" },
  { name: "Tambaú", fee: 15, region: "João Pessoa" },
  { name: "Tambauzinho", fee: 15, region: "João Pessoa" },
  { name: "Tambiá", fee: 20, region: "João Pessoa" },
  { name: "Torre", fee: 15, region: "João Pessoa" },
  { name: "Treze de Maio", fee: 15, region: "João Pessoa" },
  { name: "Trincheiras", fee: 20, region: "João Pessoa" },
  { name: "Valentina Figueiredo", fee: 15, region: "João Pessoa" },
  { name: "Varadouro", fee: 20, region: "João Pessoa" },
  { name: "Varjão (Rangel)", fee: 15, region: "João Pessoa" },
  // Região Metropolitana
  { name: "Cabedelo", fee: 30, region: "Região Metropolitana" },
  { name: "Bayeux", fee: 30, region: "Região Metropolitana" },
  { name: "Santa Rita", fee: 35, region: "Região Metropolitana" },
  { name: "Conde", fee: 40, region: "Região Metropolitana" },
  { name: "Lucena", fee: 50, region: "Região Metropolitana" },
];

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
