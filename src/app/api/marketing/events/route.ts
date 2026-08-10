import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Registra o toque (clique) em uma notificação promocional de campanha.
 *
 * Protegida por autenticação real (Bearer idToken do Firebase): o servidor
 * valida que a notificação pertence ao usuário logado antes de gravar. O doc
 * id determinístico `click:<notificationId>` garante idempotência — cada
 * notificação conta no máximo um toque, mesmo com toques repetidos.
 *
 * Os eventos persistidos aqui ("campaign_clicked") alimentam a métrica
 * "Toques (link)" / CTR do painel de campanhas.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) {
    return NextResponse.json({ error: "sessão inválida" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { notificationId?: string; campaignId?: string }
    | null;
  const notificationId = body?.notificationId;
  const campaignId = body?.campaignId;
  if (!notificationId || !campaignId) {
    return NextResponse.json(
      { error: "notificationId e campaignId são obrigatórios" },
      { status: 400 },
    );
  }

  try {
    const db = getAdminDb();
    const notifSnap = await db.collection("notifications").doc(notificationId).get();
    if (!notifSnap.exists) {
      return NextResponse.json({ error: "notificação não encontrada" }, { status: 404 });
    }
    const notif = notifSnap.data() ?? {};
    // O usuário só pode marcar toque nas próprias notificações promocionais.
    if (notif.userId !== decoded.uid || notif.category !== "promo") {
      return NextResponse.json({ error: "notificação não encontrada" }, { status: 404 });
    }
    if (notif.marketingCampaignId !== campaignId) {
      return NextResponse.json({ error: "campanha não confere" }, { status: 400 });
    }

    const eventRef = db.collection("marketingEvents").doc(`click:${notificationId}`);
    if ((await eventRef.get()).exists) {
      return NextResponse.json({ ok: true, duplicated: true });
    }
    await eventRef.set({
      userId: decoded.uid,
      type: "campaign_clicked",
      campaignId,
      message: String(notif.body ?? "").slice(0, 300),
      link: String(notif.link ?? ""),
      createdAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[marketing] falha ao registrar toque:", err);
    return NextResponse.json({ error: "falha ao registrar o toque" }, { status: 500 });
  }
}
