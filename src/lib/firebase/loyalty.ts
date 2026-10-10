import {
  doc, getDoc, setDoc, updateDoc, getDocs, collection,
  query, where, orderBy, serverTimestamp, increment, runTransaction, writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { invalidate } from "@/lib/firebase/cache";
import { computeOrderPointsForItems, eligibleOrderPointItems } from "@/lib/loyalty/levels";
import type { LoyaltyTransaction, LoyaltyReward, Order } from "@/types";

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SHARK-${suffix}`;
}

/** Normaliza um código de convite digitado/colado (link ou código puro). */
export function normalizeReferralCode(raw: string): string {
  const trimmed = raw.trim();
  // Aceita colar o link inteiro (…/register?ref=SHARK-XXXX) ou só o código.
  const fromUrl = trimmed.match(/[?&]ref=([^&\s]+)/i);
  const code = (fromUrl ? fromUrl[1] : trimmed).toUpperCase();
  return code;
}

/**
 * Public lookup so a brand-new user can resolve a referral code → referrer uid
 * without querying the (private) users collection. Each user registers their own
 * mapping at signup. Doc id = the referral code itself.
 */
export async function registerReferralCode(uid: string, referralCode: string): Promise<void> {
  await setDoc(doc(db, "referralCodes", referralCode), { uid });
}

/**
 * Registra o vínculo indicador → indicado no momento do cadastro do indicado.
 *
 * IMPORTANTE: NÃO credita pontos aqui. Pela regra do Clube Shark (Task 3.2), a
 * bonificação ao indicador só é liberada quando o indicado conclui a 1ª compra
 * PAGA. Esta função apenas valida o código e PERSISTE a amarração de forma
 * idempotente — deve ser AGUARDADA (await) antes de qualquer navegação, senão a
 * gravação é cancelada pelo redirect e o vínculo se perde (era o bug da 3.1).
 *
 * Retorna o uid do indicador quando a indicação é válida e foi registrada.
 */
export async function recordReferral(
  newUserId: string,
  rawReferralCode: string,
): Promise<string | null> {
  const referralCode = normalizeReferralCode(rawReferralCode);
  if (!referralCode) return null;

  const codeSnap = await getDoc(doc(db, "referralCodes", referralCode));
  if (!codeSnap.exists()) return null;

  const referrerId = codeSnap.data().uid as string | undefined;
  // Código inexistente, malformado ou auto-indicação → ignora silenciosamente.
  if (!referrerId || referrerId === newUserId) return null;

  // Idempotência: se já houver indicação registrada para este indicado, não
  // sobrescreve (impede re-vínculo ou troca de indicador).
  const existing = await getDoc(doc(db, "referrals", newUserId));
  if (existing.exists()) return existing.data().referrerId ?? null;

  // 1) Amarração no próprio perfil do indicado (consulta rápida no cliente).
  await updateDoc(doc(db, "users", newUserId), {
    referredBy: referrerId,
    updatedAt: serverTimestamp(),
  });

  // 2) Registro canônico da indicação, PENDENTE de bonificação. A Task 3.2
  //    promove para "qualified" e credita os pontos na 1ª compra paga.
  await setDoc(doc(db, "referrals", newUserId), {
    referrerId,
    referredUserId: newUserId,
    code: referralCode,
    status: "pending",
    pointsAwarded: 0,
    createdAt: serverTimestamp(),
  });

  return referrerId;
}

/**
 * Credita os pontos de uma compra concluída, aplicando a engine do Clube Shark:
 *  - taxa por nível atual do cliente (Baby/Hunter/Predatory/Megalodon);
 *  - identificação obrigatória: sem CPF preenchido, NÃO computa pontos;
 *  - base elegível = preço × quantidade de cada item, limitada ao total cobrado
 *    em produtos (total − frete; resgates não pontuam);
 *  - "Pontos em Dobro" (Task 3.5): 2× quando o produto/categoria está em campanha
 *    no catálogo NA HORA DO CRÉDITO — o pedido é gravado pelo cliente, então o
 *    `pointsMultiplier`/`pointsEarned` do pedido não é confiável e é ignorado.
 *
 * Recalcula a TAXA no momento do crédito (lê o perfil atual) para refletir o nível
 * vigente. Retorna os pontos
 * efetivamente creditados (0 = sem CPF ou sem base elegível).
 */
export async function awardPurchasePointsForOrder(order: Order): Promise<number> {
  if (order.isRedemption) return 0;

  const orderRef = doc(db, "orders", order.id);
  const userRef = doc(db, "users", order.customerId);

  // "Pontos em Dobro" pelo catálogo ATUAL (produto ou categoria em campanha).
  const productIds = [...new Set((order.items ?? []).map((i) => i.productId).filter(Boolean))];
  const [productSnaps, catSnap] = await Promise.all([
    Promise.all(productIds.map((id) => getDoc(doc(db, "products", id)))),
    getDocs(collection(db, "categories")),
  ]);
  const doubleCats = new Set(
    catSnap.docs.filter((c) => c.data().doublePoints === true).map((c) => String(c.data().slug ?? "")),
  );
  const doubleIds = new Set(
    productSnaps
      .filter((s) => s.exists() && (s.data().doublePoints === true || doubleCats.has(String(s.data().category ?? ""))))
      .map((s) => s.id),
  );

  // Transação: relê o pedido e só credita se `pointsAwarded` ainda for falso,
  // marcando-o no MESMO commit. Antes o guard vinha do estado da tela (cópia
  // local do pedido) e a marcação era uma escrita separada — clique duplo, duas
  // abas ou "entregar" + "creditar" concorrentes creditavam os pontos 2x.
  const points = await runTransaction(db, async (tx) => {
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) return 0;
    const fresh = orderSnap.data() as Order;
    if (fresh.pointsAwarded || fresh.isRedemption) return 0;

    const userSnap = await tx.get(userRef);
    const user = userSnap.exists() ? userSnap.data() : null;
    const cpfPresent = !!(user?.cpf && String(user.cpf).trim());

    // Base e multiplicador recalculados (não confia em pointsEarned/
    // pointsMultiplier/preço gravados pelo cliente no pedido).
    const earned = computeOrderPointsForItems({
      items: eligibleOrderPointItems({
        items: fresh.items ?? [],
        total: fresh.total,
        deliveryFee: fresh.deliveryFee,
        isDouble: (id) => doubleIds.has(id),
      }),
      currentPoints: (user?.loyaltyPoints as number) ?? 0,
      cpfPresent,
    });

    // Marca o pedido mesmo sem pontos (sem CPF), como o fluxo já fazia depois.
    tx.update(orderRef, { pointsAwarded: true, updatedAt: serverTimestamp() });
    if (earned <= 0 || !userSnap.exists()) return 0;

    tx.update(userRef, {
      loyaltyPoints: increment(earned),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, "loyaltyTransactions")), {
      userId: order.customerId,
      type: "earned",
      points: earned,
      reason: `Compra #${order.id.slice(-6).toUpperCase()}`,
      createdAt: serverTimestamp(),
    });
    return earned;
  });

  invalidate("orders");
  invalidate("users");
  return points;
}

export async function addLoyaltyPoints(
  uid: string,
  points: number,
  reason: string,
  type: LoyaltyTransaction["type"] = "earned"
): Promise<void> {
  // Saldo + lançamento no mesmo batch: ou gravam os dois, ou nenhum (antes uma
  // falha entre as duas escritas deixava saldo sem lastro no ledger/validade).
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    loyaltyPoints: increment(points),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "loyaltyTransactions")), {
    userId: uid,
    type,
    points,
    reason,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

/**
 * Ajuste manual de pontos pelo admin (PDV/balcão — Task 3.4). `points` é assinado:
 * positivo credita, negativo debita. Registra o motivo e o autor (`by`) no ledger
 * para auditoria. O crédito positivo entra na validade de 180 dias como qualquer
 * outro lote. Quem chama deve impedir débito maior que o saldo (UI), para não
 * deixar o saldo negativo.
 */
export async function adjustLoyaltyPoints(
  uid: string,
  points: number,
  reason: string,
  by?: string,
): Promise<void> {
  if (!points) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid), {
    loyaltyPoints: increment(points),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, "loyaltyTransactions")), {
    userId: uid,
    type: "adjustment",
    points,
    reason: reason.trim() || (points > 0 ? "Crédito manual" : "Débito manual"),
    ...(by ? { by } : {}),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  invalidate("users");
}

export async function getLoyaltyTransactions(uid: string): Promise<LoyaltyTransaction[]> {
  const q = query(
    collection(db, "loyaltyTransactions"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LoyaltyTransaction));
}

export async function getLoyaltyRewards(): Promise<LoyaltyReward[]> {
  const q = query(
    collection(db, "products"),
    where("active", "==", true),
    where("loyaltyPoints", ">", 0),
    orderBy("loyaltyPoints", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      description: data.shortDescription || data.description || "",
      image: data.images?.[0] ?? undefined,
      pointsCost: data.loyaltyPoints,
      stock: data.stock ?? 0,
      active: data.active,
      createdAt: data.createdAt,
    } as LoyaltyReward;
  });
}

/**
 * Resgata uma recompensa. A operação roda no SERVIDOR (/api/loyalty/redeem):
 * o servidor relê saldo/estoque e, numa transação, debita os pontos, baixa o
 * estoque, lança o "redeemed" no ledger e cria o pedido de resgate. Antes tudo
 * era feito pelo cliente — dava para gerar um pedido de resgate pago sem
 * debitar pontos, e dois resgates simultâneos deixavam o saldo negativo.
 * As checagens locais abaixo são só para feedback rápido na UI.
 *
 * Retorna o custo efetivamente debitado (o do produto no banco).
 */
export async function redeemReward(
  uid: string,
  reward: LoyaltyReward,
  currentPoints: number,
  // Mantido por compatibilidade: nome/telefone agora vêm do perfil no servidor.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _customer?: { name?: string; phone?: string },
): Promise<number> {
  if (currentPoints < reward.pointsCost) throw new Error("Pontos insuficientes");
  if (reward.stock <= 0) throw new Error("Recompensa indisponível");

  const current = auth.currentUser;
  if (!current || current.uid !== uid) throw new Error("Faça login novamente para resgatar.");
  const token = await current.getIdToken();

  const res = await fetch("/api/loyalty/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ rewardId: reward.id }),
  });
  const data = (await res.json().catch(() => ({}))) as { pointsCost?: number; error?: string };
  if (!res.ok) throw new Error(data.error || "Não foi possível concluir o resgate.");

  invalidate("products"); // estoque da recompensa baixou
  invalidate("users");    // pontos do cliente mudaram
  invalidate("orders");   // novo pedido de resgate
  return typeof data.pointsCost === "number" ? data.pointsCost : reward.pointsCost;
}
