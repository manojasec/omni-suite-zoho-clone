import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimit } from "@/platform/rate-limit";

afterEach(() => resetRateLimit());

describe("platform/rate-limit", () => {
  it("allows requests up to the limit and rejects subsequent hits", () => {
    let t = 1_000_000;
    const now = () => t;
    const opts = { key: "k1", limit: 3, windowMs: 60_000, now };
    expect(rateLimit(opts).allowed).toBe(true);
    expect(rateLimit(opts).allowed).toBe(true);
    expect(rateLimit(opts).allowed).toBe(true);
    const fourth = rateLimit(opts);
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it("re-enables requests after the window slides forward", () => {
    let t = 1_000_000;
    const now = () => t;
    const opts = { key: "k2", limit: 2, windowMs: 1000, now };
    expect(rateLimit(opts).allowed).toBe(true);
    expect(rateLimit(opts).allowed).toBe(true);
    expect(rateLimit(opts).allowed).toBe(false);
    t += 1_500;
    expect(rateLimit(opts).allowed).toBe(true);
  });

  it("counts hits per key independently", () => {
    const now = () => 5_000;
    expect(rateLimit({ key: "a", limit: 1, windowMs: 1000, now }).allowed).toBe(
      true,
    );
    expect(rateLimit({ key: "b", limit: 1, windowMs: 1000, now }).allowed).toBe(
      true,
    );
  });

  it("records hits even past the limit so attackers can't reset", () => {
    let t = 0;
    const now = () => t;
    const opts = { key: "k3", limit: 1, windowMs: 1000, now };
    expect(rateLimit(opts).allowed).toBe(true);
    expect(rateLimit(opts).allowed).toBe(false);
    t += 600;
    // Still within the window of the most recent (rejected) hit.
    expect(rateLimit(opts).allowed).toBe(false);
    // Skip past the window of every recorded hit (latest was at t=600).
    t = 2_000;
    expect(rateLimit(opts).allowed).toBe(true);
  });

  it("reports a reasonable resetAt and remaining", () => {
    const now = () => 100;
    const r = rateLimit({ key: "k4", limit: 5, windowMs: 1000, now });
    expect(r.remaining).toBe(4);
    expect(r.resetAt).toBe(100 + 1000);
  });
});
