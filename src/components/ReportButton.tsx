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

/**
 * Botão flutuante "Reportar problema", presente em todo o site (exceto no
 * painel admin). Abre um formulário curto e registra o reporte no Firestore,
 * capturando automaticamente a página atual e quem reportou (se logado).
 */
export function ReportButton() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Não aparece dentro do admin (lá o dono gerencia os reportes, não os cria).
  if (pathname.startsWith("/admin")) return null;

  async function handleSubmit() {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await createReport({
        message: message.trim(),
        page: pathname,
        userId: user?.uid,
        userName: user?.displayName,
        userEmail: user?.email,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
      toast.success("Reporte enviado! Obrigado por avisar. 🙏");
      setMessage("");
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

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            autoFocus
            maxLength={1000}
            placeholder="Ex.: ao finalizar a compra apareceu um erro e o pedido não foi criado..."
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-overlay)] px-3.5 py-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-neon-blue)] transition-all resize-none"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
            Enviamos junto a página atual{user ? " e seus dados de conta" : ""} para nos ajudar a entender o problema.
          </p>

          <div className="flex items-center justify-end gap-3 mt-5">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button variant="premium" onClick={handleSubmit} disabled={sending || !message.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar reporte</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
