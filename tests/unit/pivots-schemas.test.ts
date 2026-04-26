import { describe, expect, it } from "vitest";
import { pivotReportSchema } from "@/modules/pivots/schemas";

describe("pivotReportSchema", () => {
  it("accepts valid DEAL by status COUNT", () => {
    const r = pivotReportSchema.safeParse({
      name: "Deals by status",
      source: "DEAL",
      rowField: "status",
      colField: "",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.colField).toBeUndefined();
      expect(r.data.valueField).toBeUndefined();
      expect(r.data.rangeDays).toBe(30);
    }
  });

  it("rejects unknown rowField", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "DEAL",
      rowField: "nope",
      colField: "",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown colField", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "DEAL",
      rowField: "status",
      colField: "bogus",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects rowField === colField", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "DEAL",
      rowField: "status",
      colField: "status",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects SUM without valueField", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "INVOICE",
      rowField: "status",
      colField: "",
      valueMetric: "SUM",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects SUM with non-metric field", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "INVOICE",
      rowField: "status",
      colField: "",
      valueMetric: "SUM",
      valueField: "status",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects COUNT with valueField", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "INVOICE",
      rowField: "status",
      colField: "",
      valueMetric: "COUNT",
      valueField: "total",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });

  it("accepts INVOICE SUM(total) by status", () => {
    const r = pivotReportSchema.safeParse({
      name: "Invoice totals",
      source: "INVOICE",
      rowField: "status",
      colField: "",
      valueMetric: "SUM",
      valueField: "total",
      rangeDays: "90",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.valueField).toBe("total");
      expect(r.data.rangeDays).toBe(90);
    }
  });

  it("accepts row + col cross-tab on DEAL", () => {
    const r = pivotReportSchema.safeParse({
      name: "Cross",
      source: "DEAL",
      rowField: "ownerId",
      colField: "status",
      valueMetric: "SUM",
      valueField: "value",
      rangeDays: "30",
    });
    expect(r.success).toBe(true);
  });

  it("rejects rangeDays out of range", () => {
    const r = pivotReportSchema.safeParse({
      name: "X",
      source: "DEAL",
      rowField: "status",
      colField: "",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "0",
    });
    expect(r.success).toBe(false);
  });

  it("requires non-empty name", () => {
    const r = pivotReportSchema.safeParse({
      name: "",
      source: "DEAL",
      rowField: "status",
      colField: "",
      valueMetric: "COUNT",
      valueField: "",
      rangeDays: "30",
    });
    expect(r.success).toBe(false);
  });
});
