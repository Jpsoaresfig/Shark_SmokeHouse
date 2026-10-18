import { describe, it, expect } from "vitest";
import {
  campaignExecutionKey, automationExecutionKey, automationUserKey,
  automationCouponCode, campaignSkipKey,
} from "./ids";
import { normalizeCouponCode } from "@/lib/coupons";

describe("chaves de deduplicação", () => {
  it("campanha: uma vez por campanha por cliente, determinística", () => {
    expect(campaignExecutionKey("c1", "u1")).toBe("campaign:c1:u1");
    expect(campaignExecutionKey("c1", "u1")).toBe(campaignExecutionKey("c1", "u1"));
  });

  it("automação: uma vez por dia por automação/cliente", () => {
    expect(automationExecutionKey("a1", "u1", "2026-08-09")).toBe("auto:a1:u1:2026-08-09");
  });

  it("envio único (boas-vindas) ignora o dia", () => {
    expect(automationUserKey("a1", "u1")).toBe("auto:a1:u1");
  });

  it("cupom de automação é determinístico por automação + dia", () => {
    expect(automationCouponCode("a1", "birthday", "2026-08-09")).toBe(automationCouponCode("a1", "birthday", "2026-08-09"));
    expect(automationCouponCode("a1", "birthday", "2026-08-10")).not.toBe(automationCouponCode("a1", "birthday", "2026-08-09"));
  });

  it("duas automações do mesmo evento no mesmo dia têm cupons diferentes", () => {
    expect(automationCouponCode("aX7kP2", "promo_product", "2026-08-09"))
      .not.toBe(automationCouponCode("bQ9zR4", "promo_product", "2026-08-09"));
  });

  it("cupom de automação já é um código normalizado (checkout acha o doc)", () => {
    const code = automationCouponCode("aBcDeFgHiJkLmNoPqRsT", "promo_product", "2026-08-09");
    expect(normalizeCouponCode(code)).toBe(code);
    expect(code).not.toContain("/");
  });

  it("skip de campanha usa chave própria (não bloqueia o envio futuro)", () => {
    expect(campaignSkipKey("c1", "u1", "2026-08-09")).not.toBe(campaignExecutionKey("c1", "u1"));
  });
});
