"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingBag,
  Warehouse, Receipt, Users, MoreHorizontal, QrCode,
  CalendarDays, PartyPopper, MessageSquareWarning, Bike, Ticket, CircleDollarSign, PiggyBank, Megaphone,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const ADMIN_LINKS = [
  { href: "/admin",           label: "Início",   icon: LayoutDashboard, exact: true  },
  { href: "/admin/products",  label: "Produtos", icon: Package,         exact: false },
  { href: "/admin/orders",    label: "Pedidos",  icon: ShoppingBag,     exact: false },
  { href: "/admin/inventory", label: "Estoque",  icon: Warehouse,       exact: false },
  { href: "/admin/sales",     label: "Vendas",   icon: Receipt,         exact: false },
];

const ADMIN_MORE_LINKS = [
  { href: "/admin/receivables", label: "A Receber", icon: CircleDollarSign },
  { href: "/admin/financial", label: "Financeiro", icon: PiggyBank        },
  { href: "/admin/users",    label: "Usuários",    icon: Users          },
  { href: "/admin/coupons",  label: "Cupons",      icon: Ticket         },
  { href: "/admin/delivery", label: "Frete",       icon: Bike           },
  { href: "/admin/sections", label: "Vitrine",     icon: LayoutDashboard },
  { href: "/admin/events",   label: "Eventos",     icon: PartyPopper    },
  { href: "/admin/announcements", label: "Promoções", icon: Megaphone   },
  { href: "/admin/payments", label: "Pagamentos",  icon: QrCode         },
  { href: "/admin/lounge",   label: "Lounge",      icon: CalendarDays   },
  { href: "/admin/reports",  label: "Reportes",    icon: MessageSquareWarning },
];

const SELLER_LINKS = [
  { href: "/admin/products", label: "Produtos", icon: Package,  exact: false },
  { href: "/admin/sales",    label: "Vendas",   icon: Receipt,  exact: false },
];

export function AdminMobileNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const mainLinks = isAdmin ? ADMIN_LINKS : SELLER_LINKS;

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href) && href !== "/admin";
  }

  return (
    <>
      {/* More menu overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More links panel */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] left-4 right-4 z-50 glass-strong rounded-2xl border border-[var(--color-border)] p-2 md:hidden"
          >
            {ADMIN_MORE_LINKS.map((link) => {
              const Icon = link.icon;
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-neon-blue-glow)] text-[var(--color-neon-blue)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden glass-strong border-t border-[var(--color-border)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-14">
          {mainLinks.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : isActive(link.href, false);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-[var(--color-neon-blue)]"
                    : "text-[var(--color-text-muted)] active:text-[var(--color-text-primary)]"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "scale-110" : ""} transition-transform`} />
                <span>{link.label}</span>
              </Link>
            );
          })}

          {/* "More" button — admin only */}
          {isAdmin && (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                moreOpen
                  ? "text-[var(--color-neon-blue)]"
                  : "text-[var(--color-text-muted)] active:text-[var(--color-text-primary)]"
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
              <span>Mais</span>
            </button>
          )}
        </div>
      </nav>
    </>
  );
}
