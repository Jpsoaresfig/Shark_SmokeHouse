import { describe, it, expect, vi } from "vitest";
import { cached, invalidate } from "./cache";

describe("cached", () => {
  it("reaproveita o valor dentro do TTL e refaz com force", async () => {
    const fetcher = vi.fn().mockResolvedValue([1]);
    await cached("t1", fetcher);
    await cached("t1", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await cached("t1", fetcher, true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("compartilha a mesma busca entre chamadas simultâneas", async () => {
    const fetcher = vi.fn().mockResolvedValue("x");
    const [a, b] = await Promise.all([cached("t2", fetcher), cached("t2", fetcher)]);
    expect(a).toBe("x");
    expect(b).toBe("x");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("não grava no cache uma busca iniciada antes de uma invalidação", async () => {
    let resolve!: (v: string) => void;
    const slow = () => new Promise<string>((r) => { resolve = r; });
    const p = cached("t3", slow);
    invalidate("t3"); // escrita aconteceu durante a leitura
    resolve("velho");
    expect(await p).toBe("velho");
    const fresh = vi.fn().mockResolvedValue("novo");
    expect(await cached("t3", fresh)).toBe("novo");
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("não guarda erros", async () => {
    const failing = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(cached("t4", failing)).rejects.toThrow("boom");
    const ok = vi.fn().mockResolvedValue(1);
    expect(await cached("t4", ok)).toBe(1);
  });
});
