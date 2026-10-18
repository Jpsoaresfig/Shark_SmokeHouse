import {
  collection, getDocs, updateDoc, onSnapshot, runTransaction,
  doc, serverTimestamp, query, orderBy, where, arrayUnion, limit,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toDate } from "@/lib/utils";
import { cached, invalidate } from "@/lib/firebase/cache";
import { createOrderStatusNotification } from "@/lib/firebase/notifications";
import type { Address, CartItem, Order, OrderStatus, PaymentEvent, PaymentMethod, PaymentStatus } from "@/types";

const COL = "orders";

/** Estoque insuficiente na hora de fechar o pedido (mensagem pronta para o cliente). */
export class StockShortageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockShortageError";
  }
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
 * Escuta em tempo real um pedido individual. Usado na tela de rastreamento.
 * Retorna a função para cancelar a escuta. O Firestore garante a permissão de
 * leitura apenas ao dono do pedido (regra `orders`), então a tela só recebe
 * dados a que o cliente realmente tem acesso.
 */
export function subscribeOrder(
  id: string,
  onChange: (order: Order | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, COL, id),
    (snap) => onChange(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null),
    (err) => onError?.(err),
  );
}

/**
 * Reporta a localização GPS do entregador para um pedido em rota. Guarda o
 * último ponto em `order.motoboyLocation` (lat/lng + quando foi capturado) e
 * atualiza `updatedAt` para a linha do tempo/UI reagirem. O cliente só exibe o
 * mapa quando esse campo existe e está fresco — nunca há localização simulada.
 */
export async function updateOrderMotoboyLocation(
  id: string,
  location: { lat: number; lng: number },
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    motoboyLocation: {
      lat: location.lat,
      lng: location.lng,
      updatedAt: new Date().toISOString(),
    },
    updatedAt: serverTimestamp(),
  });
  invalidate("orders");
}

/**
 * Preenche o telefone de contato do entregador no pedido (uma vez). Permite ao
 * cliente chamar o motoboy no WhatsApp durante a entrega. Ausente em pedidos
 * antigos e em entregas sem compartilhamento de rota.
 */
export async function setOrderMotoboyPhone(id: string, phone: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    motoboyPhone: phone,
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
  // Só pedidos de ENTREGA entram no pool (retirada na loja não tem motoboy) —
  // as regras exigem esse filtro para não expor dados de clientes à toa.
  const q = query(
    collection(db, COL),
    where("motoboyId", "==", null),
    where("deliveryAddress.id", "!=", "pickup"),
  );
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

/** Dados do checkout enviados ao servidor (o resto do pedido é derivado lá). */
export interface CheckoutOrderInput {
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  cardFee: number;
  discount?: number;
  total: number;
  /** Pedido feito fora do horário — entra na fila "reserved". */
  reserved: boolean;
  paymentMethod: PaymentMethod;
  installments?: number;
  deliveryAddress: Address;
  notes?: string;
  pointsEarned?: number;
  couponCode?: string;
  couponCpf?: string;
}

/** Pedido recusado pelo servidor (valores divergentes/dados inválidos) — a
 *  mensagem já vem pronta para o cliente. */
export class OrderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderRejectedError";
  }
}

/**
 * Cria o pedido NO SERVIDOR (/api/orders/create): preços, frete, taxa de cartão,
 * cupom e total são conferidos lá contra o catálogo, e estoque + pedido + uso do
 * cupom são gravados numa única transação. O cliente não grava mais o pedido
 * direto no Firestore (os valores eram adulteráveis pelo navegador).
 */
export async function createOrder(data: CheckoutOrderInput): Promise<string> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new OrderRejectedError("Faça login para finalizar o pedido.");
  const res = await fetch("/api/orders/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(stripUndefined(data)),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string; code?: string };
  if (!res.ok || !body.id) {
    const msg = body.error || "Erro ao finalizar pedido. Tente novamente.";
    if (body.code === "stock") throw new StockShortageError(msg);
    if (res.status >= 400 && res.status < 500) throw new OrderRejectedError(msg);
    throw new Error(msg);
  }
  invalidate("orders");
  invalidate("products"); // o estoque mudou
  return body.id;
}

/** Chama uma rota de pedidos do servidor com o ID token do usuário logado. */
async function postOrderApi<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Faça login para continuar.");
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || fallbackError);
  return data;
}

/**
 * Muda o status do pedido (equipe: admin, vendedor, motoboy). Roda no servidor
 * (/api/orders/status): status, estoque (flag `stockApplied`), cupom liberado e
 * pontos de resgate devolvidos no cancelamento vão numa única transação — antes
 * eram escritas separadas no navegador, e parte delas as regras não permitiam.
 * `by` é mantido na assinatura por compatibilidade: o servidor grava o uid do token.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  note?: string,
  _by?: string,
): Promise<void> {
  void _by;
  const { customerId } = await postOrderApi<{ customerId?: string | null }>(
    "/api/orders/status",
    { orderId: id, status, ...(note ? { note } : {}) },
    "Não foi possível atualizar o pedido.",
  );
  invalidate("orders");
  invalidate("products"); // o estoque pode ter mudado

  // Notifica o cliente sobre a mudança de status (centro de notificações).
  // Falha aqui não pode derrubar a atualização do pedido.
  if (customerId) {
    try {
      await createOrderStatusNotification(customerId, id, status);
    } catch (e) {
      console.error("[notif] order status", e);
    }
  }
}

/**
 * Dispara (sem bloquear) a liberação da fila de pedidos reservados no servidor.
 * Chamado quando a equipe abre o painel — o cron da Vercel roda só 1x por dia.
 * O servidor limita a 1 execução a cada 5 min; falhas são ignoradas.
 */
export async function triggerReservedQueue(): Promise<void> {
  try {
    await postOrderApi("/api/orders/process-queue", {}, "Falha ao processar a fila.");
    invalidate("orders");
  } catch (err) {
    console.warn("[orders-queue] disparo oportunista falhou", err);
  }
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

  // Baixa manual confirmada → libera a bonificação de indicação no servidor (a
  // 1ª compra paga do indicado credita +50 ao indicador — Task 3.2). O crédito é
  // server-side (rota confiável); aqui só disparamos. Não bloqueia a baixa se
  // falhar — a rota é idempotente e o webhook do MP cobre o fluxo automático.
  if (status === "paid") {
    try {
      await fetch("/api/referrals/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      });
    } catch (err) {
      console.error("Falha ao qualificar indicação após baixa manual:", err);
    }
  }

  invalidate("orders");
}

/** Cliente confirmou que efetuou a compra combinada pelo WhatsApp. Roda no
 *  servidor (/api/orders/confirm-whatsapp), que baixa o estoque na mesma
 *  transação — clientes não gravam mais em `products`. */
export async function confirmWhatsappOrder(id: string): Promise<void> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Faça login para confirmar o pedido.");
  const res = await fetch("/api/orders/confirm-whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId: id }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Não foi possível confirmar o pedido.");
  }
  invalidate("orders");
  invalidate("products");
}

/** Cliente respondeu que NÃO concluiu a compra combinada pelo WhatsApp. Roda no
 *  servidor (/api/orders/decline-whatsapp): cancela o pedido (mesmo reservado),
 *  libera o cupom e estorna o estoque numa transação. */
export async function declineWhatsappOrder(id: string): Promise<void> {
  await postOrderApi("/api/orders/decline-whatsapp", { orderId: id }, "Não foi possível registrar sua resposta.");
  invalidate("orders");
  invalidate("products");
}

/** Marks an order's purchase points as credited so they're never awarded twice. */
export async function markOrderPointsAwarded(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    pointsAwarded: true,
    updatedAt: serverTimestamp(),
  });
  invalidate("orders");
}
