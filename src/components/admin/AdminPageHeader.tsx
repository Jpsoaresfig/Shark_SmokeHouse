"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

interface AdminPageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}

export function AdminPageHeader({ title, subtitle, action }: AdminPageHeaderProps) {
  const router = useRouter();
  const { user } = useAuthStore();
  // Vendedor volta para o próprio painel; admin volta para o dashboard.
  const backHref = user?.role === "seller" ? "/admin/seller" : "/admin";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(backHref)}
          className="hidden md:flex items-center justify-center w-11 h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)] transition-all shrink-0"
          title="Voltar ao painel"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">{title}</h1>
          {subtitle && (
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="sm:ml-auto">{action}</div>}
    </div>
  );
}
