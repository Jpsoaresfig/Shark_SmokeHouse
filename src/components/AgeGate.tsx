"use client";

import { useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

const STORAGE_KEY = "age_confirmed";
const CHANGE_EVENT = "age-gate-change";

/** Confirmação em memória — cobre storage bloqueado (libera só nesta aba). */
let confirmedInMemory = false;

function readConfirmed(): boolean {
  if (confirmedInMemory) return true;
  try {
    return !!sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/**
 * Verificação de maioridade (18+). Renderizado já no servidor (bloqueia antes da
 * hidratação, sem "piscar" o conteúdo); quem já confirmou nesta sessão é
 * escondido por CSS via script inline do layout (`html[data-age-ok]`). O
 * conteúdo da página continua no HTML (bom para SEO).
 */
export function AgeGate() {
  // Servidor: assume não confirmado (mostra o gate). Cliente: lê o sessionStorage.
  const confirmed = useSyncExternalStore(subscribe, readConfirmed, () => false);
  const visible = !confirmed;

  const confirm = () => {
    confirmedInMemory = true;
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Storage bloqueado (modo privado antigo): vale o flag em memória.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const deny = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    // initial={false}: o SSR já sai visível (opacidade 1), sem depender do JS.
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          id="age-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="age-gate-title"
          initial={false}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex p-4 overflow-y-auto"
        >
          <motion.div
            initial={false}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", damping: 20 }}
            // m-auto: centraliza sem cortar o topo quando a tela é baixa (rola).
            className="m-auto w-full max-w-sm text-center"
          >
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <Logo variant="black" size="lg" asLink={false} />
            </div>

            {/* Gate */}
            <div className="glass rounded-2xl border border-[var(--color-border)] p-8">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-6 h-6 text-amber-400" />
              </div>
              <h2 id="age-gate-title" className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
                Verificação de Idade
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-1">
                Este site é destinado exclusivamente para
              </p>
              <p className="text-2xl font-black text-[var(--color-neon-blue)] mb-1">+18 anos</p>
              <p className="text-xs text-[var(--color-text-muted)] mb-8">
                A venda de produtos para tabaco é proibida para menores de idade.
              </p>

              <div className="flex flex-col gap-3">
                <Button variant="premium" size="lg" className="w-full" onClick={confirm}>
                  Tenho 18 anos ou mais
                </Button>
                <Button variant="ghost" size="sm" className="w-full text-[var(--color-text-muted)]" onClick={deny}>
                  Sou menor de idade
                </Button>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-muted)] mt-4 leading-relaxed">
              Fumar é prejudicial à saúde. Mantenha fora do alcance de crianças.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
