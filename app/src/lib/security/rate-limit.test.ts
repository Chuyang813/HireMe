import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows requests until the window limit is reached", () => {
    const key = `unit:${crypto.randomUUID()}`;

    expect(checkRateLimit(key, { max: 2, windowMs: 1_000 }).allowed).toBe(true);
    expect(checkRateLimit(key, { max: 2, windowMs: 1_000 }).allowed).toBe(true);

    const blocked = checkRateLimit(key, { max: 2, windowMs: 1_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the configured window", () => {
    vi.useFakeTimers();
    try {
      const key = `unit:${crypto.randomUUID()}`;
      expect(checkRateLimit(key, { max: 1, windowMs: 1_000 }).allowed).toBe(true);
      expect(checkRateLimit(key, { max: 1, windowMs: 1_000 }).allowed).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(checkRateLimit(key, { max: 1, windowMs: 1_000 }).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
