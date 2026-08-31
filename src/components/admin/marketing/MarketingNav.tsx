"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Split, Megaphone, Workflow, History, Ticket,
} from "lucide-react";

const MARKETING_NAV = [
  { href: "/admin/marketing", label: "Visão geral", icon: LayoutDashboard, exact: true },
  { href: "/admin/marketing/contacts", label: "Clientes", icon: Users },
  { href: "/admin/marketing/segments", label: "Segmentos", icon: Split },
  { href: "/admin/marketing/campaigns", label: "Campanhas", icon: Megaphone },
  { href: "/admin/marketing/automations", label: "Automações", icon: Workflow },
  { href: "/admin/marketing/history", label: "Histórico", icon: History },
  { href: "/admin/marketing/coupons", label: "Cupons", icon: Ticket },
];

/** Sub-navegação da área de marketing (exclusiva do admin). */
export function MarketingNav() {
  const pathname = usePathname();
  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <nav className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-2 flex gap-1.5 overflow-x-auto mb-6">
      {MARKETING_NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-all ${
              active
                ? "bg-[var(--color-neon-blue)] text-white shadow-[var(--shadow-neon-sm)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-overlay)]"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
