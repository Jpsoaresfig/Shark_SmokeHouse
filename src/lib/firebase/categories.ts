import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { slugify } from "@/lib/utils";
import type { Category } from "@/types";

const COL = "categories";

/** Categorias padrão — usadas como fallback enquanto a coleção está vazia
 *  (e como seed quando o admin abre o gerenciador pela primeira vez). */
export const DEFAULT_CATEGORIES: { slug: string; label: string }[] = [
  { slug: "cigars", label: "Charutos" },
  { slug: "hookah", label: "Narguilé" },
  { slug: "cigarettes", label: "Cigarros" },
  { slug: "accessories", label: "Acessórios" },
  { slug: "beverages", label: "Bebidas" },
  { slug: "clothing", label: "Vestuário" },
  { slug: "kits", label: "Kits" },
  { slug: "premium", label: "Premium" },
];

function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) =>
    (a.order ?? 9999) - (b.order ?? 9999) || a.label.localeCompare(b.label),
  );
}

/** Lista as categorias. Coleção vazia → devolve os padrões (somente leitura). */
export async function getCategories(force = false): Promise<Category[]> {
  return cached(COL, async () => {
    const snap = await getDocs(collection(db, COL));
    if (snap.empty) {
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: c.slug, slug: c.slug, label: c.label, order: i }));
    }
    return sortCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
  }, force);
}

/** Mapa slug → label para exibição. */
export async function getCategoryLabels(): Promise<Record<string, string>> {
  const cats = await getCategories();
  return Object.fromEntries(cats.map(c => [c.slug, c.label]));
}

/**
 * Garante que as categorias padrão existam como documentos reais (editáveis).
 * Chamado pelo gerenciador do admin: se a coleção está vazia, grava os padrões
 * e devolve a lista persistida. Requer permissão de admin/vendedor.
 */
export async function ensureCategoriesSeeded(): Promise<Category[]> {
  const snap = await getDocs(collection(db, COL));
  if (!snap.empty) {
    return sortCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
  }
  const batch = writeBatch(db);
  DEFAULT_CATEGORIES.forEach((c, i) => {
    batch.set(doc(collection(db, COL)), { slug: c.slug, label: c.label, order: i, createdAt: serverTimestamp() });
  });
  await batch.commit();
  invalidate(COL);
  return getCategories(true);
}

/** Cria uma categoria a partir do nome (gera o slug). */
export async function createCategory(label: string): Promise<string> {
  const clean = label.trim();
  const ref = await addDoc(collection(db, COL), {
    slug: slugify(clean),
    label: clean,
    order: Date.now(),
    createdAt: serverTimestamp(),
  });
  invalidate(COL);
  return ref.id;
}

export async function updateCategory(id: string, label: string): Promise<void> {
  const clean = label.trim();
  await updateDoc(doc(db, COL, id), { slug: slugify(clean), label: clean });
  invalidate(COL);
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate(COL);
}
