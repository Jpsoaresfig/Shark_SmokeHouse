"use client";

import { useState } from "react";
import { Activity, AlertTriangle, MessageSquareWarning } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ReportsTab } from "@/components/admin/ops/ReportsTab";
import { SystemTab } from "@/components/admin/ops/SystemTab";
import { AlertsTab } from "@/components/admin/ops/AlertsTab";

type TabId = "reports" | "system" | "alerts";

const TABS: { id: TabId; label: string; icon: typeof MessageSquareWarning }[] = [
  { id: "reports", label: "Reportes",     icon: MessageSquareWarning },
  { id: "system",  label: "Sistema",      icon: Activity },
  { id: "alerts",  label: "Alertas",      icon: AlertTriangle },
];

/**
 * Centro de Operações — 3 abas:
 *   1. Reportes: problemas reportados por usuários no site.
 *   2. Sistema: saúde dos serviços, métricas, erros, webhooks e crons.
 *   3. Alertas: alertas do sistema, pedidos presos e inconsistências de estoque.
 */
export default function AdminReports() {
  const [tab, setTab] = useState<TabId>("reports");

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader
          title="Centro de Operações"
          subtitle="Reportes, monitoramento do sistema e alertas"
        />

        {/* Navegação entre abas */}
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-[var(--color-neon-blue)] text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-neon-blue)] hover:border-[var(--color-neon-blue)]/40"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "reports" && <ReportsTab />}
        {tab === "system" && <SystemTab />}
        {tab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
}
