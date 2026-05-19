import { describe, it, expect } from "vitest";
import { registerHandler, getRegisteredKinds, nextBackoff } from "@/platform/jobs";

describe("job queue — pure helpers", () => {
  it("registerHandler adds the kind to the registry", () => {
    registerHandler("test.kind.alpha", async () => "ok");
    expect(getRegisteredKinds()).toContain("test.kind.alpha");
  });

  it("nextBackoff grows exponentially and is capped", () => {
    const a1 = nextBackoff(1).getTime() - Date.now();
    const a2 = nextBackoff(2).getTime() - Date.now();
    const a3 = nextBackoff(3).getTime() - Date.now();
    const aBig = nextBackoff(100).getTime() - Date.now();
    expect(a1).toBeGreaterThanOrEqual(900); // ~1s
    expect(a2).toBeGreaterThan(a1);
    expect(a3).toBeGreaterThan(a2);
    expect(aBig).toBeLessThanOrEqual(5 * 60 * 1000 + 100); // capped at 5m
  });

  it("nextBackoff(0) returns ~1s (never negative)", () => {
    const ms = nextBackoff(0).getTime() - Date.now();
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(2000);
  });
});
