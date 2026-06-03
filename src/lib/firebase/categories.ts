import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { slugify } from "@/lib/utils";
import type { Category } from "@/types";

const COL = "categories";

/** Documento marcador (não é uma categoria) que indica que as categorias já foram
 *  gerenciadas pelo admin. Enquanto ele existir, uma coleção SEM categorias é
 *  tratada como intencional — os padrões NUNCA são ressuscitados. Vive na própria
 *  coleção `categories` (mesma permissão admin/vendedor) e é filtrado das leituras. */
const META_ID = "_meta";

/** Cria/garante o marcador de inicialização. Idempotente. */
async function markInitialized(): Promise<void> {
  await setDoc(doc(db, COL, META_ID), { _meta: true, createdAt: serverTimestamp() }, { merge: true });
}

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

/**
 * Lista as categorias. O marcador `_meta` é sempre filtrado.
 * - Há categorias reais → devolve-as.
 * - Sem categorias reais, mas JÁ inicializado (existe `_meta`) → devolve [] (o
 *   admin esvaziou de propósito; não ressuscita os padrões).
 * - Sem categorias reais e NUNCA inicializado (loja nova) → devolve os padrões
 *   como fallback de leitura (sem persistir).
 */
export async function getCategories(force = false): Promise<Category[]> {
  return cached(COL, async () => {
    const snap = await getDocs(collection(db, COL));
    const docs = snap.docs.filter(d => d.id !== META_ID);
    if (docs.length === 0) {
      const initialized = snap.docs.some(d => d.id === META_ID);
      if (initialized) return [];
      return DEFAULT_CATEGORIES.map((c, i) => ({ id: c.slug, slug: c.slug, label: c.label, order: i }));
    }
    return sortCategories(docs.map(d => ({ id: d.id, ...d.data() } as Category)));
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
  const docs = snap.docs.filter(d => d.id !== META_ID);
  const initialized = snap.docs.some(d => d.id === META_ID);

  if (docs.length > 0) {
    // Coleção já populada — garante o marcador para coleções antigas (criadas antes
    // desta correção), para que, ao esvaziar depois, os padrões não voltem.
    if (!initialized) { await markInitialized(); invalidate(COL); }
    return sortCategories(docs.map(d => ({ id: d.id, ...d.data() } as Category)));
  }

  // Sem categorias reais, mas já inicializado → o admin esvaziou de propósito.
  // Não ressuscita os padrões.
  if (initialized) return [];

  // Loja nova (primeira vez): semeia os padrões e cria o marcador na mesma operação.
  const batch = writeBatch(db);
  DEFAULT_CATEGORIES.forEach((c, i) => {
    batch.set(doc(collection(db, COL)), { slug: c.slug, label: c.label, order: i, createdAt: serverTimestamp() });
  });
  batch.set(doc(db, COL, META_ID), { _meta: true, createdAt: serverTimestamp() });
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
  // Marca como inicializado: a partir de agora, esvaziar a lista NÃO ressuscita os padrões.
  await markInitialized();
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
