"use client";

import Link from "next/link";
import { MessageCircle, MapPin, Phone, Mail, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/Logo";
import { useSiteSections } from "@/stores/siteSettingsStore";

export function Footer() {
  const sections = useSiteSections();

  const footerLinks = {
    loja: [
      { href: "/catalog", label: "Catálogo" },
      { href: "/catalog?category=cigars", label: "Charutos" },
      { href: "/catalog?category=hookah", label: "Narguilé" },
      { href: "/catalog?category=accessories", label: "Acessórios" },
      { href: "/catalog?category=beverages", label: "Bebidas" },
    ],
    empresa: [
      { href: "/about", label: "Sobre Nós" },
      ...(sections.lounge
        ? [{ href: "/lounge", label: "Lounge Agendamento" }]
        : []),
      { href: "/events", label: "Eventos" },
      { href: "/loyalty", label: "Clube Fidelidade" },
    ],
    suporte: [
      { href: "/faq", label: "Perguntas Frequentes" },
      { href: "/orders", label: "Acompanhar Pedido" },
      { href: "/contact", label: "Fale Conosco" },
      { href: "/privacy", label: "Privacidade" },
      { href: "/terms", label: "Termos de Uso" },
    ],
  };

  return (
    <footer className="bg-[var(--color-bg-surface)] border-t border-[var(--color-border)] mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4">
              <Logo variant="black" size="md" />
            </div>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed max-w-xs mb-6">
              A tabacaria premium que une sofisticação, cultura e experiência única para os apreciadores do bom gosto.
            </p>
            {/* Contact info */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <MapPin className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>Av. Alfredo Ferreira da Rocha, 742 — Mangabeira I, João Pessoa, PB</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Phone className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>(83) 99902-0606</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Mail className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>contato@sharksmokehou.se</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Clock className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>Seg – Dom: 14h às 02h</span>
              </div>
            </div>
            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent-pink)] hover:border-[var(--color-accent-pink)] hover:bg-pink-500/10 transition-all"
              >
                <span className="text-xs font-bold">IG</span>
              </a>
              <a
                href="https://wa.me/5583999020606"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-success)] hover:border-[var(--color-success)] hover:bg-emerald-500/10 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {(Object.entries(footerLinks) as [string, { href: string; label: string }[]][]).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-[var(--color-text-muted)] mb-4">
                {section.charAt(0).toUpperCase() + section.slice(1)}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="mb-6" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-text-muted)]">
          <p>© {new Date().getFullYear()} Shark SmokeHouse. Todos os direitos reservados.</p>
          <p className="flex items-center gap-1.5">
            <span className="text-[var(--color-warning)]">⚠</span>
            Venda proibida para menores de 18 anos. Fumar prejudica a saúde.
          </p>
        </div>
      </div>
    </footer>
  );
}
