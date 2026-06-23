import { Bug, CreditCard, Palette, Lightbulb, HelpCircle, type LucideIcon } from "lucide-react";
import type { ReportCategory } from "@/types";
import type { BadgeProps } from "@/components/ui/badge";

/**
 * Catálogo de categorias de reporte — usado tanto no formulário de envio
 * quanto na tela do admin. Apenas dados estáticos (sem lógica de render).
 */
export interface ReportCategoryMeta {
  value: ReportCategory;
  label: string;
  /** Texto curto que orienta o usuário sobre quando usar a categoria. */
  hint: string;
  icon: LucideIcon;
  badge: BadgeProps["variant"];
}

export const REPORT_CATEGORIES: ReportCategoryMeta[] = [
  { value: "bug",        label: "Bug / erro",      hint: "Algo quebrou ou não funcionou",      icon: Bug,        badge: "destructive" },
  { value: "payment",    label: "Pagamento",       hint: "Problema no PIX, cartão ou checkout", icon: CreditCard, badge: "warning" },
  { value: "visual",     label: "Visual / layout", hint: "Algo fora do lugar ou estranho",      icon: Palette,    badge: "purple" },
  { value: "suggestion", label: "Sugestão",        hint: "Ideia ou melhoria pro site",          icon: Lightbulb,  badge: "success" },
  { value: "other",      label: "Outro",           hint: "Qualquer outra coisa",                icon: HelpCircle, badge: "secondary" },
];

/**
 * Lookup por valor, com fallback para "other" sob a chave especial undefined.
 * É um objeto (valor), não uma função — pode ser indexado direto no render sem
 * disparar o erro de "impure function" do React Compiler.
 */
export const REPORT_CATEGORY_BY_VALUE: Record<ReportCategory, ReportCategoryMeta> = {
  bug:        REPORT_CATEGORIES[0],
  payment:    REPORT_CATEGORIES[1],
  visual:     REPORT_CATEGORIES[2],
  suggestion: REPORT_CATEGORIES[3],
  other:      REPORT_CATEGORIES[4],
};
