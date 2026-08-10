import type { MarketingContact } from "@/types/marketing";

/** Fábrica de contato enriquecido para testes de segmentação/planejamento. */
export function baseContact(overrides: Partial<MarketingContact> = {}): MarketingContact {
  return {
    uid: "u1",
    name: "Cliente Teste",
    email: "cliente@teste.com",
    phone: undefined,
    hasPhone: false,
    hasCpf: false,
    loyaltyPoints: 0,
    loyaltyLevel: "Baby Shark",
    ordersCount: 0,
    totalSpent: 0,
    ticketAvg: 0,
    lastOrderDays: null,
    firstOrderDays: null,
    daysSinceActivity: 0,
    birthdayMonth: null,
    birthdayInDays: null,
    pointsExpiringInDays: null,
    purchasedCategories: [],
    purchasedProducts: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
