"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, ShoppingBag, Users,
  Warehouse, Receipt, QrCode, CalendarDays, PartyPopper, Star, MessageSquareWarning, Bike, Ticket, CircleDollarSign, PiggyBank, Megaphone, EyeOff,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

type NavItem = { href: string; label: string; icon: React.ElementType; exact?: boolean };

const ADMIN_NAV: NavItem[] = [
  { href: "/admin",           label: "Início",        icon: LayoutDashboard, exact: true },
  { href: "/admin/products",  label: "Produtos",      icon: Package },
  { href: "/admin/orders",    label: "Pedidos",       icon: ShoppingBag },
  { href: "/admin/reviews",   label: "Avaliações",    icon: Star },
  { href: "/admin/users",     label: "Usuários",      icon: Users },
  { href: "/admin/coupons",   label: "Cupons",        icon: Ticket },
  { href: "/admin/inventory", label: "Estoque",       icon: Warehouse },
  { href: "/admin/internal",  label: "Produtos Ocultos", icon: EyeOff },
  { href: "/admin/sales",     label: "Vendas",        icon: Receipt },
  { href: "/admin/receivables", label: "A Receber",   icon: CircleDollarSign },
  { href: "/admin/financial", label: "Financeiro",    icon: PiggyBank },
  { href: "/admin/delivery",  label: "Frete",         icon: Bike },
  { href: "/admin/sections",  label: "Vitrine",       icon: LayoutDashboard },
  { href: "/admin/events",    label: "Eventos",       icon: PartyPopper },
  { href: "/admin/announcements", label: "Promoções", icon: Megaphone },
  { href: "/admin/payments",  label: "Pagamentos",    icon: QrCode },
  { href: "/admin/lounge",    label: "Agenda Lounge", icon: CalendarDays },
  { href: "/admin/reports",   label: "Reportes",      icon: MessageSquareWarning },
];

const SELLER_NAV: NavItem[] = [
  { href: "/admin/seller",   label: "Meu Painel", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Produtos",   icon: Package },
  { href: "/admin/sales",    label: "Vendas",     icon: Receipt },
];

/**
 * Barra de navegação do painel admin — destinos no topo, para uma visão
 * organizada. Substitui o atalho que ficava no rodapé do dashboard.
 */
export function AdminTopNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const links = user?.role === "admin" ? ADMIN_NAV : SELLER_NAV;

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    // Só no desktop — no mobile a navegação fica na barra inferior (AdminMobileNav).
    <nav className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 flex flex-wrap gap-1.5">
      {links.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-[var(--color-neon-blue)] text-white shadow-[var(--shadow-neon-sm)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
