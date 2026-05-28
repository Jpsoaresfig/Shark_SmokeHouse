"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, Menu, X, LogOut, Settings,
  Package, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/catalog", label: "Catálogo" },
  { href: "/lounge", label: "Lounge" },
  { href: "/events", label: "Eventos" },
  { href: "/about", label: "Sobre" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const itemCount = useCartStore((s) => s.itemCount);
  const openCart = useCartStore((s) => s.openCart);
  const { user, logout } = useAuth();

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

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
        scrolled
          ? "glass border-b border-[var(--color-border)] py-3"
          : "bg-transparent py-5"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Logo variant="black" size="sm" />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Cart button */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={openCart}
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-neon-blue)] text-[var(--color-bg-base)] text-xs font-bold flex items-center justify-center shadow-[var(--shadow-neon-sm)]">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Button>

            {/* User menu */}
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-electric-blue)] to-[var(--color-neon-blue)] flex items-center justify-center text-xs font-bold text-white">
                    {user.displayName?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <span className="hidden sm:block text-sm text-[var(--color-text-secondary)]">
                    {user.displayName?.split(" ")[0]}
                  </span>
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-xl border border-[var(--color-border)] shadow-[var(--shadow-elevated)] py-1 z-50"
                    >
                      <div className="px-4 py-3 border-b border-[var(--color-border)]">
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{user.displayName}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
                      </div>
                      <div className="py-1">
                        {user.role === "admin" && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Dashboard Admin
                          </Link>
                        )}
                        {user.role === "seller" && (
                          <Link
                            href="/admin/sales"
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <BarChart3 className="w-4 h-4" />
                            Painel Vendedor
                          </Link>
                        )}
                        <Link
                          href="/orders"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Package className="w-4 h-4" />
                          Meus Pedidos
                        </Link>
                        <Link
                          href="/profile"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4" />
                          Minha Conta
                        </Link>
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
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Entrar</Link>
                </Button>
                <Button variant="premium" size="sm" asChild>
                  <Link href="/register">Cadastrar</Link>
                </Button>
              </div>
            )}

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pt-4 pb-2 space-y-1 border-t border-[var(--color-border)] mt-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center px-3 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                {!user && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href="/login">Entrar</Link>
                    </Button>
                    <Button variant="premium" size="sm" className="flex-1" asChild>
                      <Link href="/register">Cadastrar</Link>
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
