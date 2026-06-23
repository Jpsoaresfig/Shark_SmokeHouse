"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareWarning, Loader2, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { createReport } from "@/lib/firebase/reports";
import { toast } from "@/stores/toastStore";
import { REPORT_CATEGORIES } from "@/lib/reports-meta";
import type { ReportCategory, ReportContext } from "@/types";

/** Captura o contexto técnico do navegador (só com campos preenchidos). */
function collectContext(): ReportContext {
  if (typeof window === "undefined") return {};
  const nav = window.navigator;
  const ctx: ReportContext = {
    fullUrl: window.location.href,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height}`,
    language: nav.language,
    platform: nav.platform,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer || undefined,
    online: nav.onLine,
  };
  // Firestore rejeita undefined: mantém só o que tem valor.
  return Object.fromEntries(
    Object.entries(ctx).filter(([, v]) => v !== undefined && v !== "")
  ) as ReportContext;
}

/**
 * Botão flutuante "Reportar problema", presente em todo o site (exceto no
 * painel admin). Abre um formulário curto e registra o reporte no Firestore,
 * capturando automaticamente a página atual e quem reportou (se logado).
 */
export function ReportButton() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Não aparece dentro do admin (lá o dono gerencia os reportes, não os cria).
  if (pathname.startsWith("/admin")) return null;

  const canSubmit = !!category && !!message.trim() && !sending;

  async function handleSubmit() {
    if (!category || !message.trim() || sending) return;
    setSending(true);
    try {
      await createReport({
        category,
        message: message.trim(),
        page: pathname,
        userId: user?.uid,
        userName: user?.displayName,
        userEmail: user?.email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        context: collectContext(),
      });
      toast.success("Reporte enviado! Obrigado por avisar. 🙏");
      setMessage("");
      setCategory(null);
      setOpen(false);
    } catch (err) {
      console.error("[report] createReport", err);
      toast.error("Não foi possível enviar o reporte. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Botão flutuante — acima da barra inferior no mobile. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reportar um problema"
        className="fixed z-40 bottom-20 md:bottom-5 right-4 md:right-5 flex items-center gap-2 h-11 px-3.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] shadow-[var(--shadow-elevated)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40 transition-all"
      >
        <MessageSquareWarning className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline text-sm font-medium">Reportar problema</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar um problema</DialogTitle>
            <DialogDescription>
              Encontrou um erro ou algo estranho? Conte pra gente o que aconteceu — isso nos ajuda a corrigir rápido.
            </DialogDescription>
          </DialogHeader>

          {/* Categoria — ajuda a classificar e priorizar o reporte. */}
          <div className="mb-1">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
              Qual o tipo do problema?
            </p>
            <div className="flex flex-wrap gap-2">
              {REPORT_CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    title={c.hint}
                    className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? "bg-[var(--color-neon-blue)] text-white border border-[var(--color-neon-blue)]"
                        : "border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-neon-blue)]/40"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {c.label}
                  </button>
                );
              })}
            </div>
            {category && (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                {REPORT_CATEGORIES.find((c) => c.value === category)?.hint}
              </p>
            )}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="Ex.: ao finalizar a compra apareceu um erro e o pedido não foi criado..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3.5 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none mt-4"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            Enviamos junto a página atual, alguns dados técnicos do seu aparelho
            {user ? " e seus dados de conta" : ""} para nos ajudar a entender o problema.
          </p>

          <div className="flex items-center justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button variant="premium" onClick={handleSubmit} disabled={!canSubmit}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar reporte</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
