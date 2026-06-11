"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/hooks/useAuth";
import type { AuthError } from "@/hooks/useAuth";

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center px-4 py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-[#08080f] via-[#0a0f1e] to-[#08080f]" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] max-w-[120vw] h-[500px] rounded-full"
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
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Recuperar senha</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 text-center">
            Enviaremos um link de redefinição para seu e-mail
          </p>
        </div>

        <div className="glass rounded-2xl border border-[var(--color-border)] p-8">
          {sent ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-4"
            >
              <div className="w-14 h-14 rounded-full bg-[var(--color-success)]/10 border-2 border-[var(--color-success)]/30 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-[var(--color-success)]" />
              </div>
              <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-2">E-mail enviado!</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                Verifique sua caixa de entrada em
              </p>
              <p className="text-sm font-semibold text-[var(--color-neon-blue)] mb-6">{email}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Não recebeu? Verifique a pasta de spam ou tente novamente.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setSent(false)}
              >
                Tentar outro e-mail
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                label="E-mail cadastrado"
                placeholder="seu@email.com"
                icon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--color-error)]/30 bg-red-500/10 px-3 py-2.5"
                >
                  <AlertCircle className="w-4 h-4 text-[var(--color-error)] shrink-0" />
                  <p className="text-sm text-[var(--color-error)]">{error}</p>
                </motion.div>
              )}

              <Button
                type="submit"
                variant="premium"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Enviar link de recuperação"
                )}
              </Button>
            </form>
          )}
        </div>

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
