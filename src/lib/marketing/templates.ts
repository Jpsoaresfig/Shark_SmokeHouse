/**
 * Presets de mensagens do módulo de marketing — módulo puro.
 * Servem de ponto de partida ao criar automações e são semeados no Firestore
 * (marketingTemplates) pelo cron, para o editor ter sugestões prontas.
 */
import type { MarketingAutomationEvent, MarketingTemplate } from "@/types/marketing";

export interface TemplatePreset {
  event: MarketingAutomationEvent;
  name: string;
  title: string;
  message: string;
  link?: string;
}

export const TEMPLATE_PRESETS: readonly TemplatePreset[] = [
  {
    event: "welcome",
    name: "Boas-vindas",
    title: "Bem-vindo(a) ao Clube Shark! 🦈",
    message:
      "Olá, {{nome}}! Você acaba de entrar no Clube Shark com {{pontos}} pontos de boas-vindas. Faça sua primeira compra e acumule ainda mais a cada pedido.",
    link: "/catalog",
  },
  {
    event: "first_purchase",
    name: "Primeira compra",
    title: "Primeira compra confirmada 🎉",
    message:
      "{{nome}}, sua primeira compra chegou! Agora você é oficialmente do time. Continue comprando para subir de nível no Clube Shark.",
    link: "/catalog",
  },
  {
    event: "birthday",
    name: "Aniversário",
    title: "Feliz aniversário! 🎂",
    message:
      "{{nome}}, feliz aniversário da Shark SmokeHouse! Use o cupom {{cupom}} na sua próxima compra. 🦈",
    link: "/catalog",
  },
  {
    event: "inactive_30",
    name: "Inativo 30 dias",
    title: "A gente sente sua falta 🦈",
    message:
      "Olá, {{nome}}! Já faz {{dias_sem_comprar}} dias sem te ver. Volte com o cupom {{cupom}} e aproveite.",
    link: "/catalog",
  },
  {
    event: "inactive_60",
    name: "Inativo 60 dias",
    title: "Última chamada! 🔥",
    message:
      "{{nome}}, não queremos perder você! Com o cupom {{cupom}} seu próximo pedido fica mais barato.",
    link: "/catalog",
  },
  {
    event: "big_spender",
    name: "Grandes compradores",
    title: "Obrigado por ser gigante 🏆",
    message:
      "{{nome}}, você está no topo do Clube Shark. Ganhou o cupom {{cupom}} como agradecimento.",
    link: "/catalog",
  },
  {
    event: "points_expiring",
    name: "Pontos expirando",
    title: "Seus pontos estão para expirar ⏳",
    message:
      "{{nome}}, seus {{pontos}} pontos do Clube Shark expiram em breve! Use-os antes que desapareçam. 🦈",
    link: "/clube",
  },
  {
    event: "promo_product",
    name: "Promoção de produto",
    title: "Oferta imperdível 🔥",
    message:
      "{{nome}}, selecionamos {{produto}} com desconto especial para você: cupom {{cupom}} com {{valor}} off. Aproveite!",
    link: "/catalog",
  },
  {
    event: "abandoned_cart",
    name: "Carrinho abandonado",
    title: "Seu carrinho ainda está aqui 🛒",
    message:
      "Olá, {{nome}}, seu carrinho ficou para trás. Finalize sua compra com o cupom {{cupom}}.",
    link: "/checkout",
  },
];

/** Template pronto para persistir (id = evento, estável para upsert). */
export function defaultTemplates(): MarketingTemplate[] {
  return TEMPLATE_PRESETS.map((t) => ({
    id: t.event,
    name: t.name,
    event: t.event,
    title: t.title,
    message: t.message,
    ...(t.link ? { link: t.link } : {}),
    createdAt: "",
    updatedAt: "",
  }));
}

export function presetFor(
  event: MarketingAutomationEvent,
): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((t) => t.event === event);
}
