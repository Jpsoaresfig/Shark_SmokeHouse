import {
  collection, addDoc, updateDoc, doc, query, where, onSnapshot, writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDate } from "@/lib/utils";
import type { AppNotification, OrderStatus } from "@/types";

const COL = "notifications";

/**
 * Escuta em tempo real as notificações pessoais de um usuário. Filtra só por
 * `userId` (sem `orderBy`, dispensando índice composto) e ordena por data no
 * cliente. Retorna a função para cancelar a escuta.
 */
export function subscribeNotifications(
  userId: string,
  onChange: (items: AppNotification[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, COL), where("userId", "==", userId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as AppNotification))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      onChange(items);
    },
    (err) => onError?.(err),
  );
}

/** Cria uma notificação. Remove campos vazios (Firestore rejeita undefined). */
export async function createNotification(
  data: Omit<AppNotification, "id" | "read" | "createdAt">,
): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== ""),
  );
  await addDoc(collection(db, COL), {
    ...clean,
    read: false,
    // ISO string (não serverTimestamp) para a lista em tempo real já vir
    // ordenável no instante da criação, sem o "null" momentâneo.
    createdAt: new Date().toISOString(),
  });
}

/** Marca uma notificação como lida. */
export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { read: true });
}

/** Marca várias notificações como lidas de uma vez (lote). */
export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, COL, id), { read: true }));
  await batch.commit();
}

/** Texto da notificação para cada status de pedido. */
const ORDER_STATUS_NOTIF: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  received:         { title: "Pedido recebido",      body: "Recebemos seu pedido e já estamos cuidando dele." },
  analyzing:        { title: "Pedido em análise",    body: "Seu pedido está sendo analisado." },
  approved:         { title: "Pedido aprovado",      body: "Seu pedido foi aprovado e vai para a preparação." },
  preparing:        { title: "Pedido em preparação", body: "Estamos preparando seu pedido." },
  out_for_delivery: { title: "Saiu para entrega 🛵", body: "Seu pedido saiu para entrega e está a caminho!" },
  delivered:        { title: "Pedido entregue ✅",   body: "Seu pedido foi entregue. Bom proveito!" },
  cancelled:        { title: "Pedido cancelado",     body: "Seu pedido foi cancelado. Em caso de dúvida, fale com a gente." },
};

/**
 * Notifica o cliente sobre uma mudança de status do pedido. Falhas não devem
 * derrubar a atualização do pedido — quem chama trata o erro.
 */
export async function createOrderStatusNotification(
  userId: string,
  orderId: string,
  status: OrderStatus,
): Promise<void> {
  const meta = ORDER_STATUS_NOTIF[status];
  if (!meta) return;
  const shortId = orderId.slice(-6).toUpperCase();
  await createNotification({
    userId,
    category: "order",
    title: meta.title,
    body: `Pedido #${shortId}: ${meta.body}`,
    link: "/orders",
    orderId,
  });
}
