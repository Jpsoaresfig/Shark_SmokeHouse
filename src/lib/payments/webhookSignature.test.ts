import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildSignatureManifest,
  parseSignatureHeader,
  verifyMercadoPagoSignature,
} from "./webhookSignature";

const secret = "segredo-teste";
function sign(dataId: string, requestId: string, ts: string) {
  return createHmac("sha256", secret).update(`id:${dataId};request-id:${requestId};ts:${ts};`).digest("hex");
}

describe("webhookSignature", () => {
  it("lê ts e v1 do header", () => {
    expect(parseSignatureHeader("ts=123,v1=abc")).toEqual({ ts: "123", v1: "abc" });
    expect(parseSignatureHeader(null)).toEqual({});
  });

  it("monta o manifesto omitindo partes ausentes", () => {
    expect(buildSignatureManifest("ABC1", "req", "9")).toBe("id:abc1;request-id:req;ts:9;");
    expect(buildSignatureManifest(null, null, "9")).toBe("ts:9;");
  });

  it("aceita assinatura válida e recusa adulterada", () => {
    const v1 = sign("123456", "req-1", "1704908010");
    const base = { xRequestId: "req-1", dataId: "123456", secret };
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=1704908010,v1=${v1}` })).toBe(true);
    expect(verifyMercadoPagoSignature({ ...base, dataId: "999", xSignature: `ts=1704908010,v1=${v1}` })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...base, xSignature: `ts=1704908011,v1=${v1}` })).toBe(false);
    expect(verifyMercadoPagoSignature({ ...base, xSignature: null })).toBe(false);
  });
});
