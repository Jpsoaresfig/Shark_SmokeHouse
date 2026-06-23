"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { usePromoPopup } from "@/stores/siteSettingsStore";

/** Chave de dispensa por conteúdo: muda quando o admin edita a promoção, então
 *  uma promo nova volta a aparecer mesmo que a anterior já tenha sido fechada. */
function dismissKey(title: string, message: string) {
  return `promoPopup:dismissed:${title}__${message}`;
}

/**
 * Popup promocional configurável pelo dono (Configurações → Popup Promocional).
 * Aparece na loja (não no admin), o cliente pode fechar ou clicar para ir direto
 * ao produto/oferta. Mostra uma vez por sessão por conteúdo.
 */
export function PromoPopup() {
  const pathname = usePathname();
  const { promoPopup, loaded } = usePromoPopup();
  const [open, setOpen] = useState(false);

  const isAdmin = pathname.startsWith("/admin");
  const hasContent = !!(promoPopup.title?.trim() || promoPopup.message?.trim());
  const active = loaded && promoPopup.enabled && hasContent && !isAdmin;

  useEffect(() => {
    if (!active) return;
    // Já fechou esta promoção nesta sessão?
    const key = dismissKey(promoPopup.title, promoPopup.message);
    if (typeof window !== "undefined" && sessionStorage.getItem(key)) return;
    // Pequeno atraso para não competir com o carregamento da página / age gate.
    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, [active, promoPopup.title, promoPopup.message]);

  function dismiss() {
    setOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(dismissKey(promoPopup.title, promoPopup.message), "1");
    }
  }

  if (!active) return null;

  const link = promoPopup.linkUrl?.trim() || "/catalog";
  const isExternal = /^https?:\/\//i.test(link);
  const ctaLabel = promoPopup.ctaLabel?.trim() || "Quero aproveitar";

  const ctaInner = (
    <>
      {ctaLabel}
      <ArrowRight className="w-4 h-4" />
    </>
  );
  const ctaClass =
    "flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[var(--color-neon-blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="promo-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={dismiss}
          />
          <motion.div
            key="promo-card"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            role="dialog"
            aria-label="Promoção"
            className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-elevated)]"
          >
            <button
              type="button"
              onClick={dismiss}
              aria-label="Fechar"
              className="absolute top-2.5 right-2.5 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/40 text-white/90 hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {promoPopup.imageUrl ? (
              <div className="relative w-full aspect-[16/10] bg-[var(--color-bg-overlay)]">
                <Image src={promoPopup.imageUrl} alt={promoPopup.title || "Promoção"} fill className="object-cover" sizes="384px" />
              </div>
            ) : (
              <div className="h-1.5 w-full bg-gradient-to-r from-[var(--color-electric-blue)] to-[var(--color-neon-blue)]" />
            )}

            <div className="p-5">
              {promoPopup.title?.trim() && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                  <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-neon-blue)]">
                    {promoPopup.title}
                  </p>
                </div>
              )}
              {promoPopup.message?.trim() && (
                <p className="text-base font-semibold text-[var(--color-text-primary)] leading-snug mb-4 whitespace-pre-wrap">
                  {promoPopup.message}
                </p>
              )}

              {isExternal ? (
                <a href={link} target="_blank" rel="noopener noreferrer" onClick={dismiss} className={ctaClass}>
                  {ctaInner}
                </a>
              ) : (
                <Link href={link} onClick={dismiss} className={ctaClass}>
                  {ctaInner}
                </Link>
              )}

              <button
                type="button"
                onClick={dismiss}
                className="mt-2 w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                Agora não
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
