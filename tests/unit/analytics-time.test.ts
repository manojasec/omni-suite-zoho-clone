import { describe, expect, it } from "vitest";
import { lastNMonths, bucketByMonth } from "@/modules/analytics/time";

describe("analytics/time", () => {
  it("returns N months ending at the reference month", () => {
    const ref = new Date(Date.UTC(2024, 5, 15)); // Jun 2024
    const m = lastNMonths(3, ref);
    expect(m).toHaveLength(3);
    expect(m.map((b) => b.key)).toEqual(["2024-04", "2024-05", "2024-06"]);
  });

  it("buckets rows by createdAt month and respects pick()", () => {
    const ref = new Date(Date.UTC(2024, 5, 15));
    const buckets = lastNMonths(3, ref);
    const rows = [
      { createdAt: new Date(Date.UTC(2024, 4, 2)), v: 10 },
      { createdAt: new Date(Date.UTC(2024, 4, 28)), v: 5 },
      { createdAt: new Date(Date.UTC(2024, 5, 1)), v: 7 },
      { createdAt: new Date(Date.UTC(2023, 0, 1)), v: 999 }, // outside window
    ];
    const counts = bucketByMonth(rows, buckets);
    expect(counts.map((c) => c.value)).toEqual([0, 2, 1]);
    const sums = bucketByMonth(rows, buckets, (r) => r.v);
    expect(sums.map((c) => c.value)).toEqual([0, 15, 7]);
  });
});
