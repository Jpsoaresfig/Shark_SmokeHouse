"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, CalendarDays, MessageCircle, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/",        label: "Início",      icon: Home           },
  { href: "/catalog", label: "Catálogo",    icon: Package        },
  { href: "/lounge",  label: "Agendamento", icon: CalendarDays   },
  { href: "/contact", label: "Contato",     icon: MessageCircle  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Hide on admin routes
  if (pathname.startsWith("/admin")) return null;

  const accountItem = {
    href: user ? "/account" : "/login",
    label: user ? "Minha Conta" : "Entrar",
    icon: User,
  };

  const items = [...NAV_ITEMS, accountItem];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden">
      {/* Top glow line */}
      <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-neon-blue)]/30 to-transparent" />

      <div className="glass border-t border-[var(--color-border)] px-2 pb-safe">
        <div className="flex items-stretch justify-around h-16">
          {items.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 flex-1 px-1 min-w-0 relative transition-colors duration-150",
                  isActive
                    ? "text-[var(--color-neon-blue)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                )}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--color-neon-blue)] shadow-[var(--shadow-neon-sm)]" />
                )}

                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0 transition-transform duration-150",
                    isActive && "scale-110"
                  )}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none truncate w-full text-center",
                    isActive ? "text-[var(--color-neon-blue)]" : "text-[var(--color-text-muted)]"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
