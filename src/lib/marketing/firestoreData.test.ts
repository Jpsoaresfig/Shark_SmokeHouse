import { describe, it, expect } from "vitest";
import { stripUndefinedDeep, updatePayload } from "./firestoreData";

class Sentinel {
  constructor(public readonly kind: string) {}
}

describe("stripUndefinedDeep — escrita segura no Admin SDK", () => {
  it("remove undefined de objetos aninhados e arrays", () => {
    const out = stripUndefinedDeep({
      a: 1,
      link: undefined,
      nested: { couponCode: undefined, keep: "x" },
      list: [1, undefined, { z: undefined, y: 2 }],
    });
    expect(out).toEqual({ a: 1, nested: { keep: "x" }, list: [1, { y: 2 }] });
    expect("link" in out).toBe(false);
  });

  it("não mexe em sentinelas/instâncias de classe (FieldValue, Timestamp)", () => {
    const s = new Sentinel("serverTimestamp");
    const out = stripUndefinedDeep({ updatedAt: s });
    expect(out.updatedAt).toBe(s);
  });
});

describe("updatePayload — undefined explícito apaga o campo", () => {
  it("troca undefined pela sentinela de remoção e preserva o resto", () => {
    const del = () => "DELETE";
    const out = updatePayload(
      { minOrder: undefined, expiresAt: undefined, value: 10, coupon: { type: "percent", minOrder: undefined } },
      del,
    );
    expect(out).toEqual({ minOrder: "DELETE", expiresAt: "DELETE", value: 10, coupon: { type: "percent" } });
  });

  it("campo ausente não é tocado", () => {
    expect(updatePayload({ active: false }, () => "DELETE")).toEqual({ active: false });
  });
});
