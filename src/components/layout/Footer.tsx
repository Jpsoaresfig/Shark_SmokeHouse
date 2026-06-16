"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, MapPin, Phone, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/ui/Logo";
import { useSiteSections } from "@/stores/siteSettingsStore";
import { getCategories } from "@/lib/firebase/categories";
import type { Category } from "@/types";

export function Footer() {
  const sections = useSiteSections();

  // Categorias reais cadastradas no admin — os links da coluna "Loja" nunca
  // ficam quebrados quando as categorias mudam.
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  const footerLinks: { title: string; links: { href: string; label: string }[] }[] = [
    {
      title: "Loja",
      links: [
        { href: "/catalog", label: "Catálogo" },
        ...categories.slice(0, 8).map(c => ({
          href: `/catalog?cat=${c.slug}`,
          label: c.label,
        })),
      ],
    },
    {
      title: "Experiências",
      links: [
        ...(sections.lounge ? [{ href: "/lounge", label: "Lounge" }] : []),
        { href: "/events", label: "Eventos" },
      ],
    },
    {
      title: "Institucional",
      links: [
        { href: "/about", label: "Sobre Nós" },
        { href: "/clube", label: "Clube Shark" },
        { href: "/contact", label: "Contato" },
        { href: "/orders", label: "Acompanhar Pedido" },
      ],
    },
  ];

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
              Na Shark Smoke House, você encontra produtos selecionados, atendimento de
              qualidade e um ambiente pensado para quem valoriza conforto e bons momentos.
              Tudo isso em um espaço que se tornou referência em João Pessoa.
            </p>
            {/* Contact info */}
            <div className="space-y-2.5">
              <a
                href="https://maps.app.goo.gl/P8ZJh4wtXAMu73et5"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] transition-colors"
              >
                <MapPin className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>Avenida Alfredo Ferreira da Rocha, 742 — Mangabeira I, João Pessoa, PB</span>
              </a>
              <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Phone className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0" />
                <span>(83) 9902-0606</span>
              </div>
              <div className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
                <Clock className="w-4 h-4 text-[var(--color-neon-blue)] shrink-0 mt-0.5" />
                <span>
                  Segunda: Fechado<br />
                  Ter – Sex: 13h às 21h<br />
                  Sáb – Dom: 14h às 21h<br />
                  Lounge (Ter – Dom): 20h às 22h
                </span>
              </div>
            </div>
            {/* Social */}
            <div className="flex items-center gap-3 mt-6">
              <a
                href="https://www.instagram.com/shark_smokehouse_"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram da Shark Smokehouse"
                className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-accent-pink)] hover:border-[var(--color-accent-pink)] hover:bg-pink-500/10 transition-all"
              >
                <span className="text-xs font-bold">IG</span>
              </a>
              <a
                href="https://wa.me/558399020606"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-success)] hover:border-[var(--color-success)] hover:bg-emerald-500/10 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {footerLinks.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-semibold tracking-widest uppercase text-[var(--color-text-muted)] mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
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
          <p className="flex items-center gap-3 flex-wrap justify-center">
            <span>© {new Date().getFullYear()} Shark SmokeHouse. Todos os direitos reservados.</span>
            <Link href="/privacy" className="hover:text-[var(--color-neon-blue)] transition-colors">Privacidade</Link>
            <Link href="/terms" className="hover:text-[var(--color-neon-blue)] transition-colors">Termos de Uso</Link>
          </p>
          <p className="flex items-center gap-1.5">
            <span className="text-[var(--color-warning)]">⚠</span>
            Venda proibida para menores de 18 anos. Fumar prejudica a saúde.
          </p>
        </div>
      </div>
    </footer>
  );
}
