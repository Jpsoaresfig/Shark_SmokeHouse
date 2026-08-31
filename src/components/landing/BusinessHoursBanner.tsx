"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { useBusinessHours } from "@/stores/siteSettingsStore";
import { isOpenNow, formatTodayStatus, configuredDayCount } from "@/lib/businessHours";

/**
 * Faixa de horário de funcionamento exibida no topo da página inicial.
 * Aparece somente quando o admin ligou o limitador de horário e configurou
 * pelo menos um dia. Mostra se a loja está aberta/fechada agora e o horário de hoje.
 */
export function BusinessHoursBanner() {
  const { businessHours, loaded } = useBusinessHours();
  if (!loaded || !businessHours?.enabled) return null;
  if (configuredDayCount(businessHours) === 0) return null;

  const { open } = isOpenNow(businessHours);

  return (
    <div
      className={`w-full mt-24 px-4 py-2.5 text-center text-xs font-medium border-b ${
        open
          ? "bg-[var(--color-success)]/10 border-[var(--color-success)]/20 text-[var(--color-success)]"
          : "bg-[var(--color-warning)]/10 border-[var(--color-warning)]/25 text-[var(--color-warning)]"
      }`}
    >
      <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 flex-wrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>
          {open
            ? `${formatTodayStatus(businessHours)} — estamos abertos!`
            : (businessHours.closedMessage?.trim()
                ? businessHours.closedMessage.trim()
                : `A loja está fechada no momento. ${formatTodayStatus(businessHours)}. Quando ela abrir, seu pedido é liberado automaticamente.`)}
        </span>
        {!open && (
          <Link href="/catalog" className="underline underline-offset-2 hover:opacity-80">
            Ver catálogo
          </Link>
        )}
      </div>
    </div>
  );
}
