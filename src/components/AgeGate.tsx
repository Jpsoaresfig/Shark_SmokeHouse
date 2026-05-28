"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";

export function AgeGate() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const confirmed = sessionStorage.getItem("age_confirmed");
    if (!confirmed) setVisible(true);
  }, []);

  const confirm = () => {
    sessionStorage.setItem("age_confirmed", "1");
    setVisible(false);
  };

  const deny = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: "rgba(4, 4, 10, 0.98)", backdropFilter: "blur(40px)" }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", damping: 20 }}
            className="w-full max-w-sm text-center"
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
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">
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
