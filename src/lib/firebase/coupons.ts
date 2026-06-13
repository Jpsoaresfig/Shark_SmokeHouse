import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { cached, invalidate } from "@/lib/firebase/cache";
import { normalizeCouponCode } from "@/lib/coupons";
import type { Coupon } from "@/types";

const COL = "coupons";
const REDEMPTIONS = "couponRedemptions";

/** Lista todos os cupons (painel admin). */
export async function getCoupons(force = false): Promise<Coupon[]> {
  return cached(COL, async () => {
    const snap = await getDocs(collection(db, COL));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Coupon))
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }, force);
}

/** Busca um cupom pelo código (doc id = código). */
export async function getCouponByCode(code: string): Promise<Coupon | null> {
  const id = normalizeCouponCode(code);
  if (!id) return null;
  const snap = await getDoc(doc(db, COL, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Coupon) : null;
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

/** Atualiza um cupom (código é imutável — é o id). */
export async function updateCoupon(id: string, data: Partial<CouponInput>): Promise<void> {
  await updateDoc(doc(db, COL, id), { ...stripUndefined(data), updatedAt: serverTimestamp() });
  invalidate(COL);
}

export async function deleteCoupon(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
  invalidate(COL);
}

/** Quantas vezes um CPF já usou um cupom (limite por CPF). */
export async function countCouponUsesForCpf(couponId: string, cpf: string): Promise<number> {
  if (!cpf) return 0;
  const snap = await getDocs(
    query(collection(db, REDEMPTIONS), where("couponId", "==", couponId), where("cpf", "==", cpf)),
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
