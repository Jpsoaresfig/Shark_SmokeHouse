import {
  collection, getDocs, addDoc, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDate } from "@/lib/utils";
import type { Review } from "@/types";

const COL = "reviews";

/** Cria uma avaliação de pedido (cliente). */
export async function createReview(
  data: Omit<Review, "id" | "createdAt">,
): Promise<string> {
  const payload: Record<string, unknown> = {
    orderId: data.orderId,
    customerId: data.customerId,
    customerName: data.customerName,
    rating: data.rating,
    createdAt: serverTimestamp(),
  };
  if (data.comment && data.comment.trim() !== "") {
    payload.comment = data.comment.trim();
  }
  const ref = await addDoc(collection(db, COL), payload);
  return ref.id;
}

/** Avaliações do próprio cliente (ordenadas por data no cliente — sem índice composto). */
export async function getReviewsByCustomer(customerId: string): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, COL), where("customerId", "==", customerId))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Review))
    .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
}

/** Todas as avaliações (admin). */
export async function getReviews(): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, COL), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review));
}
