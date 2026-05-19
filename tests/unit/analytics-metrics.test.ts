import { describe, it, expect } from "vitest";
import {
  METRIC_CATALOG,
  deltaFor,
  getMetric,
  isValidDimension,
  isValidGrain,
  listMetrics,
  metricsForSource,
} from "@/modules/analytics/metrics";

describe("analytics metrics catalog", () => {
  it("exposes a non-empty registry", () => {
    const all = listMetrics();
    expect(all.length).toBeGreaterThan(0);
    expect(getMetric("deals.revenue")?.aggregator).toBe("SUM");
    expect(getMetric("does.not.exist")).toBeNull();
  });

  it("every metric has a stable id matching its key", () => {
    for (const [key, def] of Object.entries(METRIC_CATALOG)) {
      expect(def.id).toBe(key);
      expect(def.dimensions.length).toBeGreaterThan(0);
    }
  });

  it("SUM/AVG metrics declare a valueField; COUNT metrics omit it", () => {
    for (const m of listMetrics()) {
      if (m.aggregator === "COUNT") expect(m.valueField).toBeUndefined();
      else expect(typeof m.valueField).toBe("string");
    }
  });

  it("filters metrics by source", () => {
    const dealMetrics = metricsForSource("DEAL");
    expect(dealMetrics.every((m) => m.source === "DEAL")).toBe(true);
    expect(dealMetrics.length).toBeGreaterThan(0);
  });

  it("validates dimensions and grains", () => {
    expect(isValidDimension("deals.revenue", "stage")).toBe(true);
    expect(isValidDimension("deals.revenue", "ghost")).toBe(false);
    expect(isValidDimension("unknown", "stage")).toBe(false);
    expect(isValidGrain("mrr", "month")).toBe(true);
    expect(isValidGrain("mrr", "day")).toBe(false); // mrr restricts grains
    expect(isValidGrain("deals.revenue", "day")).toBe(true);
  });

  it("deltaFor classifies direction against goal", () => {
    // up-goal metric, increase → good
    expect(deltaFor("deals.revenue", 120, 100).direction).toBe("good");
    expect(deltaFor("deals.revenue", 120, 100).percent).toBeCloseTo(0.2, 5);
    // up-goal metric, decrease → bad
    expect(deltaFor("deals.revenue", 80, 100).direction).toBe("bad");
    // down-goal metric (expenses), decrease → good
    expect(deltaFor("expenses.total", 80, 100).direction).toBe("good");
    // flat
    expect(deltaFor("deals.revenue", 100, 100).direction).toBe("flat");
    // previous=0 with non-zero current → +100%
    expect(deltaFor("deals.revenue", 50, 0).percent).toBe(1);
    expect(deltaFor("deals.revenue", 0, 0).direction).toBe("flat");
  });
});
