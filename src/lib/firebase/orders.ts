import {
  collection, getDocs, getDoc, addDoc, updateDoc, onSnapshot, runTransaction,
  doc, serverTimestamp, query, orderBy, where, arrayUnion, increment, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toDate } from "@/lib/utils";
import { cached, invalidate } from "@/lib/firebase/cache";
import { adjustVariationStock } from "@/lib/firebase/products";
import type { CartItem, Order, OrderStatus, PaymentEvent, PaymentStatus } from "@/types";

const COL = "orders";

/**
 * Baixa (`out`) ou estorna (`in`) o estoque dos itens de um pedido, atualizando
 * `products.stock` diretamente. Isso roda no contexto do cliente (checkout), por
 * isso NÃO grava em `stockMovements` (coleção restrita a admin/seller nas regras).
 * As regras do Firestore permitem ao cliente alterar apenas `stock`/`updatedAt`
 * do produto — exatamente o que fazemos aqui. A baixa reflete na quantidade real
 * e dispara o alerta de estoque mínimo.
 */
async function applyOrderStock(
  order: { id: string; items: CartItem[] },
  type: "out" | "in",
): Promise<void> {
  const sign = type === "out" ? -1 : 1;
  await Promise.all(
    order.items.map((item) =>
      item.variationId
        ? adjustVariationStock(item.productId, item.variationId, sign * item.quantity)
        : updateDoc(doc(db, "products", item.productId), {
            stock: increment(sign * item.quantity),
            updatedAt: serverTimestamp(),
          }),
    ),
  );
  invalidate("products"); // o estoque mudou
}

/* Firestore rejeita qualquer valor `undefined`, inclusive aninhado em objetos
   ou arrays (ex: deliveryAddress.complement, notes, item.notes). Remove esses
   campos recursivamente antes de gravar. */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function getOrders(limitCount?: number, force = false): Promise<Order[]> {
  return cached(`orders:list:${limitCount ?? "all"}`, async () => {
    const q = limitCount
      ? query(collection(db, COL), orderBy("createdAt", "desc"), limit(limitCount))
      : query(collection(db, COL), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
  }, force);
}

/**
 * Escuta os pedidos em tempo real (`onSnapshot`). Sempre que algo muda no
 * Firestore, `onChange` recebe a lista completa atualizada e a lista de pedidos
 * que acabaram de ser criados (`added`) — útil para alertar "pedido novo".
 * Na primeira leitura `added` vem vazio (todos os pedidos já existiam) e
 * ignoramos escritas locais pendentes (`hasPendingWrites`), que não são
 * pedidos novos vindos do servidor. Retorna a função para cancelar a escuta.
 */
export function subscribeOrders(
  limitCount: number,
  onChange: (orders: Order[], added: Order[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, COL), orderBy("createdAt", "desc"), limit(limitCount));
  let first = true;
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      const added = first
        ? []
        : snap.docChanges()
            .filter(c => c.type === "added" && !c.doc.metadata.hasPendingWrites)
            .map(c => ({ id: c.doc.id, ...c.doc.data() } as Order));
      first = false;
      onChange(orders, added);
    },
    (err) => onError?.(err),
  );
}

export async function getOrdersByCustomer(customerId: string, force = false): Promise<Order[]> {
  // Filtra apenas por customerId (sem orderBy) para dispensar o índice composto;
  // a lista de um cliente é pequena, então ordenamos por data no cliente.
  return cached(`orders:customer:${customerId}`, async () => {
    const snap = await getDocs(
      query(collection(db, COL), where("customerId", "==", customerId))
    );
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Order))
      .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
  }, force);
}

/**
 * Escuta em tempo real os pedidos de um cliente (`onSnapshot`). Igual a
 * getOrdersByCustomer, filtra só por `customerId` (sem `orderBy`, dispensando o
 * índice composto) e ordena por data no cliente. Usado pelo indicador de
 * "pedido em andamento" no header, que atualiza sozinho a cada mudança de status.
 * Retorna a função para cancelar a escuta.
 */
export function subscribeOrdersByCustomer(
  customerId: string,
  onChange: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, COL), where("customerId", "==", customerId));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      onChange(orders);
    },
    (err) => onError?.(err),
  );
}

/**
 * Escuta em tempo real os pedidos atribuídos a um motoboy. Filtra só por
 * `motoboyId` (sem `orderBy`, dispensando índice composto) e ordena por data
 * no cliente. Usado pelo painel /motoboy.
 */
export function subscribeOrdersByMotoboy(
  motoboyId: string,
  onChange: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, COL), where("motoboyId", "==", motoboyId));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      onChange(orders);
    },
    (err) => onError?.(err),
  );
}

/** Atribui (ou remove, com null) o motoboy responsável pela entrega do pedido. */
export async function assignOrderMotoboy(
  id: string,
  motoboy: { uid: string; name: string } | null,
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    motoboyId: motoboy?.uid ?? null,
    motoboyName: motoboy?.name ?? null,
    updatedAt: serverTimestamp(),
  });
  invalidate("orders");
}

/**
 * Pool de entregas disponíveis: pedidos sem motoboy atribuído (`motoboyId == null`).
 * Os pedidos novos nascem com `motoboyId: null` (ver createOrder), então a query
 * por igualdade casa com as regras do Firestore (que liberam a leitura do pool
 * para motoboys). Filtros adicionais (status ativo, não-retirada) ficam na tela.
 * Retorna a função para cancelar a escuta.
 */
export function subscribeAvailableDeliveries(
  onChange: (orders: Order[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(collection(db, COL), where("motoboyId", "==", null));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Order))
        .sort((a, b) => toDate(b.createdAt).getTime() - toDate(a.createdAt).getTime());
      onChange(orders);
    },
    (err) => onError?.(err),
  );
}

/**
 * Um motoboy "pega" uma entrega disponível, atribuindo-a a si mesmo. Usa uma
 * transação para evitar corrida: se outro entregador pegou primeiro, lança erro.
 */
export async function claimOrderDelivery(
  id: string,
  motoboy: { uid: string; name: string },
): Promise<void> {
  const ref = doc(db, COL, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Pedido não encontrado.");
    const current = (snap.data() as Order).motoboyId;
    if (current && current !== motoboy.uid) {
      throw new Error("Esta entrega já foi aceita por outro entregador.");
    }
    tx.update(ref, {
      motoboyId: motoboy.uid,
      motoboyName: motoboy.name,
      updatedAt: serverTimestamp(),
    });
  });
  invalidate("orders");
}

export async function createOrder(
  data: Omit<Order, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  // Baixa o estoque já na compra, exceto quando o pedido WhatsApp ainda aguarda
  // a confirmação do cliente (baixa em confirmWhatsappOrder) ou quando é um
  // resgate de pontos (o redeemReward já baixou o estoque do produto/recompensa).
  const applyStock = !data.awaitingConfirmation && !data.isRedemption;
  const ref = await addDoc(collection(db, COL), {
    // Nasce sem motoboy para aparecer no pool de entregas disponíveis; um valor
    // explícito (null) é necessário para a query por igualdade do pool casar.
    motoboyId: null,
    motoboyName: null,
    ...stripUndefined(data),
    stockApplied: applyStock,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (applyStock) {
    await applyOrderStock({ id: ref.id, items: data.items }, "out");
  }
  invalidate("orders");
  return ref.id;
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
): Promise<void> {
  const ref = doc(db, COL, id);
  await updateDoc(ref, {
    status,
    statusHistory: arrayUnion({
      status,
      timestamp: new Date().toISOString(),
      note: note ?? "",
    }),
    updatedAt: serverTimestamp(),
  });

  // Ao cancelar, estorna o estoque se ele já havia sido baixado por este pedido.
  if (status === "cancelled") {
    const snap = await getDoc(ref);
    const order = snap.data() as Order | undefined;
    if (order?.stockApplied) {
      await applyOrderStock({ id, items: order.items }, "in");
      await updateDoc(ref, { stockApplied: false, updatedAt: serverTimestamp() });
    }
  }
  invalidate("orders");
}

/**
 * Atualiza o status financeiro (baixa manual do admin ou webhook do
 * Mercado Pago). Grava em `payment.status`, acrescenta um evento no `payment.history` e,
 * quando `paid`, registra `paidAt`/`confirmedBy`. Espelha o campo legado
 * `paymentStatus` para compatibilidade.
 */
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  opts: { note?: string; by?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  const event: PaymentEvent = {
    status,
    timestamp: now,
    ...(opts.note ? { note: opts.note } : {}),
    ...(opts.by ? { by: opts.by } : {}),
  };
  await updateDoc(doc(db, COL, id), {
    "payment.status": status,
    "payment.history": arrayUnion(event),
    ...(status === "paid"
      ? { "payment.paidAt": now, ...(opts.by ? { "payment.confirmedBy": opts.by } : {}) }
      : {}),
    paymentStatus: status, // espelho legado
    updatedAt: serverTimestamp(),
  });
  invalidate("orders");
}

/** Cliente confirmou que efetuou a compra combinada pelo WhatsApp. */
export async function confirmWhatsappOrder(id: string): Promise<void> {
  const ref = doc(db, COL, id);
  const snap = await getDoc(ref);
  const order = snap.data() as Order | undefined;

  await updateDoc(ref, {
    awaitingConfirmation: false,
    statusHistory: arrayUnion({
      status: "received",
      timestamp: new Date().toISOString(),
      note: "Compra confirmada pelo cliente (WhatsApp)",
    }),
    "payment.history": arrayUnion({
      status: "in_negotiation",
      timestamp: new Date().toISOString(),
      note: "Compra confirmada pelo cliente (WhatsApp)",
    } satisfies PaymentEvent),
    updatedAt: serverTimestamp(),
  });

  // Agora que a compra foi confirmada, baixa o estoque (se ainda não baixou).
  if (order && !order.stockApplied) {
    await applyOrderStock({ id, items: order.items }, "out");
    await updateDoc(ref, { stockApplied: true, updatedAt: serverTimestamp() });
  }
  invalidate("orders");
}

/** Marks an order's purchase points as credited so they're never awarded twice. */
export async function markOrderPointsAwarded(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    pointsAwarded: true,
    updatedAt: serverTimestamp(),
  });
  invalidate("orders");
}
