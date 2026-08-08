import { describe, it, expect } from "vitest";
import { formatTimeAgo } from "@/lib/timeAgo";

const now = new Date("2026-08-08T12:00:00.000Z");

describe("formatTimeAgo", () => {
  it("agora para menos de 1 minuto", () => {
    expect(formatTimeAgo("2026-08-08T11:59:30.000Z", now)).toBe("agora");
  });

  it("agora para valores futuros", () => {
    expect(formatTimeAgo("2026-08-08T12:05:00.000Z", now)).toBe("agora");
  });

  it("minutos", () => {
    expect(formatTimeAgo("2026-08-08T11:57:00.000Z", now)).toBe("há 3 min");
  });

  it("horas", () => {
    expect(formatTimeAgo("2026-08-08T10:30:00.000Z", now)).toBe("há 1 hora");
    expect(formatTimeAgo("2026-08-08T09:00:00.000Z", now)).toBe("há 3 horas");
  });

  it("dias", () => {
    expect(formatTimeAgo("2026-08-05T12:00:00.000Z", now)).toBe("há 3 dias");
  });
});
