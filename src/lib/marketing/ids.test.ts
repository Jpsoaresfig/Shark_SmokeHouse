import { describe, it, expect } from "vitest";
import {
  campaignExecutionKey, automationExecutionKey, automationUserKey,
  automationCouponCode,
} from "./ids";

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

  it("cupom de automação é determinístico por evento + dia", () => {
    expect(automationCouponCode("birthday", "2026-08-09")).toBe(automationCouponCode("birthday", "2026-08-09"));
    expect(automationCouponCode("birthday", "2026-08-10")).not.toBe(automationCouponCode("birthday", "2026-08-09"));
  });
});
