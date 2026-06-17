/**
 * Taxas de parcelamento no cartão de crédito (maquininha).
 *
 * A tabela é editável pelo admin (settings → Pagamentos) e fica salva em
 * `SiteSettings.payment.creditInstallmentFees`. Quando o cliente parcela em N
 * vezes, a taxa correspondente é somada ao total do pedido; 1x (à vista/direto)
 * não tem taxa de parcelamento.
 */
import type { InstallmentFee } from "@/types";

/** Tabela padrão (usada quando o admin ainda não configurou nada). */
export const DEFAULT_INSTALLMENT_FEES: InstallmentFee[] = [
  { installments: 2, feePercent: 6.91 },
  { installments: 3, feePercent: 8.29 },
  { installments: 4, feePercent: 9.65 },
  { installments: 5, feePercent: 10.98 },
  { installments: 6, feePercent: 12.28 },
  { installments: 7, feePercent: 13.46 },
  { installments: 8, feePercent: 14.72 },
];

/** Remove entradas inválidas (parcelas < 2 ou números não finitos) e ordena por nº de parcelas. */
export function normalizeInstallmentFees(
  fees: InstallmentFee[] | undefined | null,
): InstallmentFee[] {
  if (!fees?.length) return [];
  return fees
    .filter(
      (f) =>
        Number.isFinite(f.installments) &&
        f.installments >= 2 &&
        Number.isFinite(f.feePercent),
    )
    .sort((a, b) => a.installments - b.installments);
}

/** Taxa (%) de uma quantidade de parcelas; 0 para 1x (à vista) ou quando não cadastrada. */
export function installmentFeePercent(
  fees: InstallmentFee[] | undefined | null,
  installments: number,
): number {
  if (installments <= 1) return 0;
  return (
    normalizeInstallmentFees(fees).find((f) => f.installments === installments)
      ?.feePercent ?? 0
  );
}

/** Formata uma taxa para exibição em pt-BR (ex.: 6.91 → "6,91%"). */
export function formatFeePercent(pct: number): string {
  return `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

/** Valor (R$) da taxa de cartão sobre uma base (subtotal + frete) para uma % dada. */
export function cardFeeAmountFor(base: number, pct: number): number {
  return Math.round(base * (pct / 100) * 100) / 100;
}

/** Total do pedido (R$) somando a taxa de cartão e descontando o cupom. */
export function cardTotalFor(base: number, pct: number, discount: number): number {
  return Math.max(0, base + cardFeeAmountFor(base, pct) - discount);
}
