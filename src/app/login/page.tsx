"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/hooks/useAuth";
import type { AuthError } from "@/hooks/useAuth";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  const { login, loginGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      if (redirect) window.location.href = redirect;
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginGoogle();
      if (redirect) window.location.href = redirect;
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="glass rounded-2xl border border-[var(--color-border)] p-8">
      {/* Google */}
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full mb-5"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <div className="w-4 h-4 border-2 border-[var(--color-text-muted)] border-t-[var(--color-text-primary)] rounded-full animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continuar com Google
      </Button>

      <div className="relative flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-[var(--color-border)]" />
        <span className="text-xs text-[var(--color-text-muted)]">ou com e-mail</span>
        <div className="flex-1 h-px bg-[var(--color-border)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email"
          label="E-mail"
          placeholder="seu@email.com"
          icon={<Mail className="w-4 h-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">Senha</label>
            <Link href="/forgot-password" className="text-xs text-[var(--color-neon-blue)] hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
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
          disabled={loading || googleLoading}
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Entrar
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
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
          <h1 className="text-2xl font-black text-[var(--color-text-primary)]">Bem-vindo de volta</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Entre na sua conta</p>
        </div>

        <Suspense fallback={<div className="glass rounded-2xl border border-[var(--color-border)] p-8 animate-pulse h-80" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-[var(--color-text-muted)] mt-6">
          Não tem uma conta?{" "}
          <Link href="/register" className="text-[var(--color-neon-blue)] hover:underline font-medium">
            Cadastre-se grátis
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
