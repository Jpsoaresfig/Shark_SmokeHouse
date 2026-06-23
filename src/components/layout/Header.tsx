"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Menu, X, LogOut, Star,
  Package, BarChart3, User as UserIcon, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { MyOrdersButton } from "@/components/shop/MyOrdersButton";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useCartStore } from "@/stores/cartStore";
import { useSiteSections } from "@/stores/siteSettingsStore";
import { getCategories } from "@/lib/firebase/categories";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

const allNavLinks = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/clube",   label: "Clube"    },
  { href: "/lounge",  label: "Lounge"   },
  { href: "/events",  label: "Eventos"  },
  { href: "/about",   label: "Sobre"    },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const pathname = usePathname();

  const itemCount = useCartStore((s) => s.itemCount);
  const openCart = useCartStore((s) => s.openCart);
  const sections = useSiteSections();
  const { user, logout } = useAuth();

  const navLinks = allNavLinks.filter(
    (link) => link.href !== "/lounge" || sections.lounge
  );

  /* Categorias para o menu cascata do Catálogo (Task 4.2) */
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  /* Scroll listener */
  useEffect(() => {
    let rafId: number;
    const handler = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setScrolled(window.scrollY > 20));
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => {
      window.removeEventListener("scroll", handler);
      cancelAnimationFrame(rafId);
    };
  }, []);

  /* Close menus on route change */
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  /* Lock body scroll while mobile drawer is open */
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300 backdrop-blur-xl border-b",
          scrolled
            ? "py-2.5 border-[var(--color-border-strong)] shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
            : "py-3.5 border-[var(--color-border-subtle)]"
        )}
        style={{
          background: scrolled
            ? "linear-gradient(180deg, rgba(15,15,26,0.92) 0%, rgba(8,8,15,0.86) 100%)"
            : "linear-gradient(180deg, rgba(15,15,26,0.78) 0%, rgba(8,8,15,0.55) 100%)",
        }}
      >
        {/* Linha neon sutil — toque premium */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--color-neon-blue)]/40 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2">
            {/* Logo */}
            <Logo variant="black" size="sm" />

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) =>
                link.href === "/catalog" && categories.length > 0 ? (
                  // Menu cascata de categorias (Task 4.2) — abre no hover, via CSS,
                  // sem recarregar a página; clicar numa categoria filtra o catálogo.
                  <div key={link.href} className="relative group">
                    <Link
                      href={link.href}
                      className="flex items-center gap-1 text-eyebrow text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] border-b-2 border-transparent group-hover:border-[var(--color-neon-blue)] pb-0.5 transition-all duration-200"
                    >
                      {link.label}
                      <ChevronDown className="w-3.5 h-3.5 transition-transform duration-200 group-hover:rotate-180" />
                    </Link>
                    {/* pt-3 cria a "ponte" de hover entre o link e o painel */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200">
                      <div className="w-56 glass-strong rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-elevated)] py-1.5 max-h-[70vh] overflow-y-auto">
                        <Link
                          href="/catalog"
                          className="block px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
                        >
                          Todos os produtos
                        </Link>
                        <div className="border-t border-[var(--color-border)] my-1" />
                        {categories.map((c) => (
                          <Link
                            key={c.id}
                            href={`/catalog?cat=${c.slug}`}
                            className="block px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
                          >
                            {c.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-eyebrow text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border-b-2 border-transparent hover:border-[var(--color-neon-blue)] pb-0.5 transition-all duration-200"
                  >
                    {link.label}
                  </Link>
                ),
              )}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Centro de notificações (sininho com abas) — só para logados */}
              {user && <NotificationCenter />}

              {/* Pedidos em andamento (tempo real) — ao lado do carrinho */}
              <MyOrdersButton />

              {/* Cart */}
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={openCart}
                aria-label="Carrinho"
              >
                <ShoppingCart className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] text-[10px] font-bold flex items-center justify-center shadow-[var(--shadow-neon-sm)]">
                    {itemCount > 9 ? "9+" : itemCount}
                  </span>
                )}
              </Button>

              {/* ── Desktop: user dropdown ── */}
              {user ? (
                <div className="relative hidden md:block">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-xs font-bold text-white">
                      {user.displayName?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)]">
                      {user.displayName?.split(" ")[0]}
                    </span>
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <>
                        {/* click-outside catcher */}
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setUserMenuOpen(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-elevated)] py-1 z-50"
                        >
                          <div className="px-4 py-3 border-b border-[var(--color-border)]">
                            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{user.displayName}</p>
                            <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                            {user.role === "customer" && (
                              <div className="flex items-center gap-1 mt-1.5">
                                <Star className="w-3 h-3 text-[var(--color-warning)]" />
                                <span className="text-xs font-semibold text-[var(--color-warning)]">
                                  {(user.loyaltyPoints ?? 0).toLocaleString("pt-BR")} pontos
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="py-1">
                            {user.role === "admin" && (
                              <DropdownLink href="/admin" icon={BarChart3} onClick={() => setUserMenuOpen(false)}>Dashboard Admin</DropdownLink>
                            )}
                            {user.role === "seller" && (
                              <DropdownLink href="/admin/seller" icon={BarChart3} onClick={() => setUserMenuOpen(false)}>Painel Vendedor</DropdownLink>
                            )}
                            {user.role === "motoboy" && (
                              <DropdownLink href="/motoboy" icon={BarChart3} onClick={() => setUserMenuOpen(false)}>Minhas Entregas</DropdownLink>
                            )}
                            <DropdownLink href="/orders" icon={Package} onClick={() => setUserMenuOpen(false)}>Meus Pedidos</DropdownLink>
                            <DropdownLink href="/account" icon={UserIcon} onClick={() => setUserMenuOpen(false)}>Minha Conta</DropdownLink>
                            <div className="border-t border-[var(--color-border)] my-1" />
                            <button
                              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                              onClick={() => { setUserMenuOpen(false); logout(); }}
                            >
                              <LogOut className="w-4 h-4" />
                              Sair
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-2 ml-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/login">Entrar</Link>
                  </Button>
                  <Button variant="premium" size="sm" asChild>
                    <Link href="/register">Cadastrar</Link>
                  </Button>
                </div>
              )}

              {/* ── Mobile: single combined menu button ── */}
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-lg text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-hover)] transition-colors"
                aria-label="Abrir menu"
              >
                {user ? (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-xs font-bold text-white">
                    {user.displayName?.[0]?.toUpperCase() ?? "U"}
                  </div>
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer (overlay — does NOT push content) ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="mobile-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              key="mobile-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="fixed top-0 right-0 bottom-0 z-[70] w-[85%] max-w-sm glass-strong border-l border-[var(--color-border)] flex flex-col md:hidden"
              style={{
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
              }}
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
                <span className="text-eyebrow text-[var(--color-text-muted)]">Menu</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User card */}
              {user && (
                <div className="px-5 py-4 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-base font-bold text-white shrink-0">
                      {user.displayName?.[0]?.toUpperCase() ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{user.displayName}</p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                    </div>
                  </div>
                  {user.role === "customer" && (
                    <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/20">
                      <Star className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                      <span className="text-xs font-bold text-[var(--color-warning)]">
                        {(user.loyaltyPoints ?? 0).toLocaleString("pt-BR")} pontos
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {/* Navigation */}
                <div className="space-y-0.5">
                  <p className="text-eyebrow text-[var(--color-text-muted)] px-3 mb-1.5">Navegação</p>
                  {navLinks.map((link) =>
                    link.href === "/catalog" && categories.length > 0 ? (
                      // Catálogo com cascata de categorias (Task 4.2) — expande no toque.
                      <div key={link.href}>
                        <div className="flex items-center">
                          <DrawerLink href={link.href} onClick={() => setMobileOpen(false)} className="flex-1">
                            {link.label}
                          </DrawerLink>
                          <button
                            onClick={() => setMobileCatsOpen((v) => !v)}
                            aria-label="Categorias"
                            aria-expanded={mobileCatsOpen}
                            className="w-11 h-12 flex items-center justify-center rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                          >
                            <ChevronDown className={cn("w-4 h-4 transition-transform", mobileCatsOpen && "rotate-180")} />
                          </button>
                        </div>
                        <AnimatePresence initial={false}>
                          {mobileCatsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              {categories.map((c) => (
                                <DrawerLink
                                  key={c.id}
                                  href={`/catalog?cat=${c.slug}`}
                                  onClick={() => setMobileOpen(false)}
                                  className="h-10 pl-7 text-[var(--color-text-muted)]"
                                >
                                  {c.label}
                                </DrawerLink>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <DrawerLink
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                      >
                        {link.label}
                      </DrawerLink>
                    ),
                  )}
                </div>

                {/* User-specific */}
                {user && (
                  <div className="mt-5 space-y-0.5">
                    <p className="text-eyebrow text-[var(--color-text-muted)] px-3 mb-1.5">Conta</p>
                    {user.role === "admin" && (
                      <DrawerLink href="/admin" icon={BarChart3} onClick={() => setMobileOpen(false)}>
                        Dashboard Admin
                      </DrawerLink>
                    )}
                    {user.role === "seller" && (
                      <DrawerLink href="/admin/seller" icon={BarChart3} onClick={() => setMobileOpen(false)}>
                        Painel Vendedor
                      </DrawerLink>
                    )}
                    {user.role === "motoboy" && (
                      <DrawerLink href="/motoboy" icon={BarChart3} onClick={() => setMobileOpen(false)}>
                        Minhas Entregas
                      </DrawerLink>
                    )}
                    <DrawerLink href="/orders" icon={Package} onClick={() => setMobileOpen(false)}>
                      Meus Pedidos
                    </DrawerLink>
                    <DrawerLink href="/account" icon={UserIcon} onClick={() => setMobileOpen(false)}>
                      Minha Conta
                    </DrawerLink>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="border-t border-[var(--color-border)] p-4">
                {user ? (
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-[var(--color-error)]/30 bg-red-500/5 text-sm font-medium text-[var(--color-error)] hover:bg-red-500/10 active:bg-red-500/10 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 h-11" asChild>
                      <Link href="/login" onClick={() => setMobileOpen(false)}>Entrar</Link>
                    </Button>
                    <Button variant="premium" className="flex-1 h-11" asChild>
                      <Link href="/register" onClick={() => setMobileOpen(false)}>Cadastrar</Link>
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Internal helpers ───────────────────────────────────── */

function DropdownLink({
  href, icon: Icon, children, onClick,
}: {
  href: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
    >
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

function DrawerLink({
  href, icon: Icon, children, onClick, className,
}: {
  href: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 h-12 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-hover)] transition-colors",
        className,
      )}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </Link>
  );
}
