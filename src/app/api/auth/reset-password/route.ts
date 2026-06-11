import { NextResponse, type NextRequest } from "next/server";
import { Resend } from "resend";
import { getAdminAuth } from "@/lib/firebase/admin";
import { passwordResetEmail } from "@/lib/email/passwordResetTemplate";

export const runtime = "nodejs";

/**
 * Base URL para os links/imagens do e-mail.
 * Prioridade: NEXT_PUBLIC_APP_URL (override explícito) → host da requisição
 * (funciona em local e em produção automaticamente) → localhost.
 *
 * Defesa: se NEXT_PUBLIC_APP_URL apontar para localhost mas a requisição vier
 * de um domínio real (ex.: o .env local foi importado por engano na Vercel),
 * ignoramos o override e usamos o host real — assim os links nunca saem como
 * localhost em produção.
 */
function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostIsLocal = !host || host.startsWith("localhost") || host.startsWith("127.");

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const envIsLocal = !!envUrl && /localhost|127\.|0\.0\.0\.0/.test(envUrl);
  if (envUrl && !(envIsLocal && !hostIsLocal)) return envUrl;

  if (host) {
    const proto =
      request.headers.get("x-forwarded-proto") ?? (hostIsLocal ? "http" : "https");
    return `${proto}://${host}`;
  }
  return "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  const APP_URL = getBaseUrl(request);

  let email: string;
  try {
    const body = await request.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  }

  try {
    // Gera o link padrão do Firebase só para extrair o oobCode, e então monta
    // o link apontando para a NOSSA tela de redefinição (/reset-password),
    // com a identidade visual da Shark — em vez do handler hospedado do Firebase.
    const fbLink = await getAdminAuth().generatePasswordResetLink(email, {
      url: `${APP_URL}/login`,
    });
    const oobCode = new URL(fbLink).searchParams.get("oobCode");
    const resetLink = oobCode
      ? `${APP_URL}/reset-password?oobCode=${encodeURIComponent(oobCode)}`
      : fbLink; // fallback defensivo caso o formato do link mude

    const resend = new Resend(process.env.RESEND_API_KEY);
    const from = process.env.RESEND_FROM ?? "Shark SmokeHouse <onboarding@resend.dev>";
    const { subject, html, text } = passwordResetEmail({
      resetLink,
      appUrl: APP_URL,
      logoUrl: `${APP_URL}/logo_nova_preta_sq.jpeg`,
    });

    const { error } = await resend.emails.send({ from, to: email, subject, html, text });
    if (error) {
      console.error("Falha ao enviar e-mail (Resend):", error);
      return NextResponse.json({ error: "Não foi possível enviar o e-mail." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Para não revelar quais e-mails existem (email enumeration), respondemos
    // sucesso mesmo quando a conta não existe — apenas não enviamos nada.
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found" || code === "auth/email-not-found") {
      return NextResponse.json({ ok: true });
    }
    console.error("Erro ao gerar link de redefinição:", err);
    return NextResponse.json({ error: "Erro ao processar o pedido." }, { status: 500 });
  }
}
