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
  const hostIsLocal = !host || /^(localhost|127\.)/.test(host);

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const envIsLocal = !!envUrl && /localhost|127\.|0\.0\.0\.0/.test(envUrl);
  if (envUrl && !(envIsLocal && !hostIsLocal)) return envUrl;

  // SEGURANÇA (host header injection): o link leva o oobCode — se o host viesse
  // livre do header, um atacante pediria a redefinição da vítima com
  // `Host: site-do-atacante` e capturaria o código (tomada de conta). Só
  // aceitamos hosts conhecidos (env/Vercel) ou localhost.
  if (host && (hostIsLocal || allowedHosts().has(host.toLowerCase()))) {
    const proto = hostIsLocal ? "http" : "https";
    return `${proto}://${host}`;
  }
  const fallback = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return fallback ? `https://${fallback}` : "http://localhost:3000";
}

/** Hosts válidos para os links do e-mail (domínio configurado + domínios da Vercel). */
function allowedHosts(): Set<string> {
  const out = new Set<string>();
  for (const raw of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    try {
      if (raw) out.add(new URL(raw).host.toLowerCase());
    } catch {
      // URL malformada na env — ignora
    }
  }
  for (const h of [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
  ]) {
    if (h) out.add(h.toLowerCase());
  }
  return out;
}

/* Limite best-effort (memória da instância) contra abuso do envio de e-mails:
   por IP e por e-mail. Não é global entre instâncias serverless, mas corta o
   disparo em massa trivial (custo no Resend / spam na caixa da vítima). */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IP = 5;
const MAX_PER_EMAIL = 3;
const hits = new Map<string, number[]>();

function rateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
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

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(`ip:${ip}`, MAX_PER_IP)) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos e tente de novo." },
      { status: 429 },
    );
  }
  // Por e-mail respondemos sucesso silencioso (não revela se a conta existe).
  if (rateLimited(`email:${email}`, MAX_PER_EMAIL)) {
    return NextResponse.json({ ok: true });
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
