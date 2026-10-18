import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, addDoc, Timestamp, deleteField,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { normalizeCouponCode } from "@/lib/coupons";
import { updatePayload } from "@/lib/marketing/firestoreData";
import type { Coupon } from "@/types";

const COL = "coupons";
const REDEMPTIONS = "couponRedemptions";

/** serverTimestamp() volta como Timestamp na leitura — normaliza para ISO string
 * (o tipo Coupon declara createdAt/updatedAt como string). */
function tsToISO(v: unknown): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  return "";
}

/** Lista todos os cupons (painel admin). */
export async function getCoupons(force = false): Promise<Coupon[]> {
  return cached(COL, async () => {
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: tsToISO(data.createdAt),
          updatedAt: tsToISO(data.updatedAt),
        } as Coupon;
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

/** Busca um cupom pelo código (doc id = código). */
export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const id = normalizeCouponCode(code);
  if (!id) return null;
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    ...data,
    id: snap.id,
    createdAt: tsToISO(data.createdAt),
    updatedAt: tsToISO(data.updatedAt),
  } as Coupon;
}

/** Dados de criação/edição de cupom (sem campos derivados). */
export type CouponInput = Omit<Coupon, "id" | "code" | "createdAt" | "updatedAt">;

/** Cria um cupom. Lança se o código já existir. Doc id = código normalizado. */
export async function createCoupon(code: string, data: CouponInput): Promise<string> {
  const id = normalizeCouponCode(code);
  if (!id) throw new Error("Informe um código para o cupom.");
  const ref = doc(db, COL, id);
  if ((await getDoc(ref)).exists()) throw new Error("Já existe um cupom com esse código.");
  await setDoc(ref, {
    code: id,
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  invalidate(COL);
  return id;
}

/** Atualiza um cupom (código é imutável — é o id). Campo presente com valor
 *  `undefined` = APAGAR o campo (validade, pedido mínimo, limite por CPF ou
 *  categorias limpos no painel). Antes o undefined era ignorado e o valor antigo
 *  continuava valendo no checkout. */
export async function updateCoupon(id: string, data: Partial<CouponInput>): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...updatePayload(data as Record<string, unknown>, deleteField),
    updatedAt: serverTimestamp(),
  });
  invalidate(COL);
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate(COL);
}

/** Quantas vezes um CPF já usou um cupom (limite por CPF). A contagem roda no
 *  servidor (/api/coupons/usage): os resgates guardam CPFs de outros clientes,
 *  então a coleção não é legível pelo cliente. */
export async function countCouponUsesForCpf(couponId: string, cpf: string): Promise<number> {
  if (!cpf) return 0;
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Faça login para usar cupons.");
  const res = await fetch("/api/coupons/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ couponId, cpf }),
  });
  if (!res.ok) throw new Error("Não foi possível validar o cupom. Tente novamente.");
  const data = (await res.json()) as { count?: number };
  return typeof data.count === "number" ? data.count : 0;
}

/** Quantas vezes uma CONTA já usou um cupom — impede burlar o limite por CPF
 *  digitando outro CPF no checkout. */
export async function countCouponUsesForUser(couponId: string, userId: string): Promise<number> {
  if (!userId) return 0;
  const snap = await getDocs(
    query(collection(db, REDEMPTIONS), where("couponId", "==", couponId), where("userId", "==", userId)),
  );
  return snap.size;
}

/** Registra o uso de um cupom em um pedido (auditoria + limite por CPF). */
export async function recordCouponRedemption(data: {
  couponId: string;
  code: string;
  cpf: string;
  userId: string;
  orderId: string;
  discount: number;
}): Promise<void> {
  await addDoc(collection(db, REDEMPTIONS), { ...data, createdAt: serverTimestamp() });
}

/* Firestore rejeita undefined — remove campos undefined antes de gravar. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
