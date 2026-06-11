"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { verifyResetCode, confirmReset } from "@/lib/firebase/auth";

/** Traduz os códigos de erro do Firebase para mensagens amigáveis. */
function friendlyError(error: unknown): string {
  const code = (error as { code?: string }).code;
  switch (code) {
    case "auth/expired-action-code":
      return "Este link expirou. Solicite um novo e-mail de redefinição.";
    case "auth/invalid-action-code":
      return "Link inválido ou já utilizado. Solicite um novo e-mail de redefinição.";
    case "auth/user-disabled":
      return "Esta conta foi desativada. Entre em contato com o suporte.";
    case "auth/user-not-found":
      return "Conta não encontrada.";
    case "auth/weak-password":
      return "A senha deve ter pelo menos 6 caracteres.";
    default:
      return "Não foi possível concluir. Tente novamente.";
  }
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");

  // verifying → valida o código | invalid → link ruim | ready → form | done → sucesso
  // Sem oobCode o estado já nasce "invalid" (evita setState síncrono no effect).
  const [status, setStatus] = useState<"verifying" | "invalid" | "ready" | "done">(
    oobCode ? "verifying" : "invalid"
  );
  const [email, setEmail] = useState("");
  const [codeError, setCodeError] = useState(
    oobCode ? "" : "Link inválido. Solicite um novo e-mail de redefinição."
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Valida o oobCode assim que a tela abre.
  useEffect(() => {
    if (!oobCode) return;
    verifyResetCode(oobCode)
      .then((mail) => {
        setEmail(mail);
        setStatus("ready");
      })
      .catch((err) => {
        setCodeError(friendlyError(err));
        setStatus("invalid");
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await confirmReset(oobCode!, password);
      setStatus("done");
      // Leva ao login após um instante para o usuário ver a confirmação.
      setTimeout(() => router.push("/login"), 2500);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  // --- Verificando o link ---
  if (status === "verifying") {
    return (
      <div className="glass rounded-2xl border border-[var(--color-border)] p-10 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-neon-blue)] mx-auto mb-4" />
        <p className="text-sm text-[var(--color-text-secondary)]">Validando seu link…</p>
      </div>
    );
  }

  // --- Link inválido/expirado ---
  if (status === "invalid") {
    return (
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass rounded-2xl border border-[var(--color-error)]/30 p-8 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-red-500/10 border-2 border-[var(--color-error)]/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-[var(--color-error)]" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Link inválido
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">{codeError}</p>
        <Link href="/forgot-password">
          <Button variant="premium" size="lg" className="w-full">
            Solicitar novo link
          </Button>
        </Link>
      </motion.div>
    );
  }

  // --- Senha redefinida ---
  if (status === "done") {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass rounded-2xl border border-[var(--color-success)]/30 p-8 text-center"
      >
        <div className="w-14 h-14 rounded-full bg-[var(--color-success)]/10 border-2 border-[var(--color-success)]/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-[var(--color-success)]" />
        </div>
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">
          Senha redefinida!
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-6">
          Já pode entrar com a sua nova senha. Redirecionando para o login…
        </p>
        <Link href="/login">
          <Button variant="premium" size="lg" className="w-full">
            <span>Ir para o login</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    );
  }

  // --- Formulário de nova senha ---
  return (
    <div className="glass rounded-2xl border border-[var(--color-border)] p-8">
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-neon-blue)]/20 bg-[var(--color-neon-blue-glow)] px-3 py-2.5 mb-5">
        <ShieldCheck className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
        <p className="text-xs text-[var(--color-text-secondary)]">
          Definindo nova senha para <strong className="text-[var(--color-text-primary)]">{email}</strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Nova senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 pl-10 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] focus:shadow-[0_0_0_3px_var(--color-neon-blue-glow)] transition-all"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Confirmar nova senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3 py-2.5 pl-10 pr-10 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] focus:shadow-[0_0_0_3px_var(--color-neon-blue-glow)] transition-all"
              required
            />
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">Mínimo de 6 caracteres.</p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5"
            >
              <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <Button type="submit" variant="premium" size="lg" className="w-full" disabled={loading}>
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <><span>Redefinir senha</span><ArrowRight className="w-4 h-4" /></>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-[#08080f] via-[#0a0f1e] to-[#08080f]" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,255,0.07) 0%, transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="mb-4">
            <Logo variant="black" size="md" asLink={false} />
          </div>
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Nova senha</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 text-center">
            Crie uma nova senha para sua conta
          </p>
        </div>

        <Suspense
          fallback={
            <div className="glass rounded-2xl border border-[var(--color-border)] p-8 animate-pulse h-72" />
          }
        >
          <ResetPasswordForm />
        </Suspense>

        <div className="flex justify-center mt-6">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao login
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
