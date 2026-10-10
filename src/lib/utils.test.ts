import { describe, it, expect } from "vitest";
import { toDate, formatDate } from "@/lib/utils";

describe("toDate / formatDate com datas puras (YYYY-MM-DD)", () => {
  it("interpreta como dia local (não UTC)", () => {
    const d = toDate("2026-06-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("formatDate não desloca o dia", () => {
    expect(formatDate("2026-06-15")).toBe("15/06/2026");
  });

  it("mantém ISO com horário como instante absoluto", () => {
    expect(toDate("2026-06-15T12:00:00.000Z").toISOString()).toBe("2026-06-15T12:00:00.000Z");
  });
});
