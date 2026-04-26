import { describe, expect, it } from "vitest";
import { dashboardSchema, widgetSchema, SOURCE_CATALOG } from "@/modules/dashboards/schemas";

describe("dashboardSchema", () => {
  it("accepts valid input", () => {
    const r = dashboardSchema.safeParse({ name: "Sales", description: "Pipeline overview" });
    expect(r.success).toBe(true);
  });
  it("rejects empty name", () => {
    expect(dashboardSchema.safeParse({ name: "", description: "" }).success).toBe(false);
  });
  it("treats empty description as undefined", () => {
    const r = dashboardSchema.safeParse({ name: "X", description: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.description).toBeUndefined();
  });
  it("rejects name > 160 chars", () => {
    expect(dashboardSchema.safeParse({ name: "x".repeat(161) }).success).toBe(false);
  });
});

describe("widgetSchema KPI", () => {
  it("accepts COUNT KPI without metricField/groupBy", () => {
    const r = widgetSchema.safeParse({ title: "Open deals", kind: "KPI", source: "DEAL", metric: "COUNT", rangeDays: "30" });
    expect(r.success).toBe(true);
  });
  it("requires metricField for SUM", () => {
    const r = widgetSchema.safeParse({ title: "Pipeline", kind: "KPI", source: "DEAL", metric: "SUM", metricField: "", rangeDays: "30" });
    expect(r.success).toBe(false);
  });
  it("rejects invalid metricField for source", () => {
    const r = widgetSchema.safeParse({ title: "X", kind: "KPI", source: "DEAL", metric: "SUM", metricField: "bogus", rangeDays: "30" });
    expect(r.success).toBe(false);
  });
  it("accepts SUM with allowed metric field", () => {
    const r = widgetSchema.safeParse({ title: "Pipeline", kind: "KPI", source: "DEAL", metric: "SUM", metricField: "value", rangeDays: "30" });
    expect(r.success).toBe(true);
  });
  it("rejects metricField when COUNT", () => {
    const r = widgetSchema.safeParse({ title: "X", kind: "KPI", source: "DEAL", metric: "COUNT", metricField: "value", rangeDays: "30" });
    expect(r.success).toBe(false);
  });
});

describe("widgetSchema BAR/PIE/TABLE", () => {
  it("requires groupBy for BAR", () => {
    const r = widgetSchema.safeParse({ title: "X", kind: "BAR", source: "DEAL", metric: "COUNT", rangeDays: "30" });
    expect(r.success).toBe(false);
  });
  it("accepts BAR with allowed groupBy", () => {
    const r = widgetSchema.safeParse({ title: "Deals by stage", kind: "BAR", source: "DEAL", metric: "COUNT", groupBy: "stageId", rangeDays: "30" });
    expect(r.success).toBe(true);
  });
  it("rejects unknown groupBy", () => {
    const r = widgetSchema.safeParse({ title: "X", kind: "BAR", source: "DEAL", metric: "COUNT", groupBy: "bogus", rangeDays: "30" });
    expect(r.success).toBe(false);
  });
  it("accepts TABLE with SUM + valid metricField + groupBy", () => {
    const r = widgetSchema.safeParse({ title: "Revenue by status", kind: "TABLE", source: "INVOICE", metric: "SUM", metricField: "total", groupBy: "status", rangeDays: "90" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rangeDays).toBe(90);
  });
});

describe("widgetSchema rangeDays", () => {
  it("rejects 0", () => {
    expect(widgetSchema.safeParse({ title: "X", kind: "KPI", source: "DEAL", metric: "COUNT", rangeDays: "0" }).success).toBe(false);
  });
  it("rejects > 3650", () => {
    expect(widgetSchema.safeParse({ title: "X", kind: "KPI", source: "DEAL", metric: "COUNT", rangeDays: "3651" }).success).toBe(false);
  });
});

describe("SOURCE_CATALOG", () => {
  it("covers every source", () => {
    const sources = ["DEAL", "INVOICE", "CONTACT", "TICKET", "TASK", "PROJECT", "EXPENSE", "SUBSCRIPTION", "SUBSCRIPTION_INVOICE", "CAMPAIGN"] as const;
    for (const s of sources) {
      expect(SOURCE_CATALOG[s]).toBeDefined();
      expect(SOURCE_CATALOG[s].dateField).toBeTruthy();
    }
  });
  it("DEAL allows value as metric field", () => {
    expect(SOURCE_CATALOG.DEAL.metricFields).toContain("value");
  });
  it("INVOICE allows total as metric field", () => {
    expect(SOURCE_CATALOG.INVOICE.metricFields).toContain("total");
  });
});
