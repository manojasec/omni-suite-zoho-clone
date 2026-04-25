import { describe, expect, it } from "vitest";
import { dealSchema, dealStatusSchema } from "@/modules/sales/schemas";

describe("sales/schemas — dealSchema", () => {
  it("accepts a minimal valid deal", () => {
    const r = dealSchema.parse({
      name: "Acme renewal",
      value: "1000",
      pipelineId: "p1",
      stageId: "s1",
    });
    expect(r.name).toBe("Acme renewal");
    expect(r.value).toBe("1000.00");
    expect(r.currency).toBe("USD");
  });

  it("requires a name and pipeline + stage", () => {
    expect(dealSchema.safeParse({ name: "", pipelineId: "p", stageId: "s" }).success).toBe(false);
    expect(dealSchema.safeParse({ name: "x", pipelineId: "", stageId: "s" }).success).toBe(false);
    expect(dealSchema.safeParse({ name: "x", pipelineId: "p", stageId: "" }).success).toBe(false);
  });

  it("normalises numeric strings with commas", () => {
    const r = dealSchema.parse({
      name: "x",
      value: "12,500.50",
      pipelineId: "p",
      stageId: "s",
    });
    expect(r.value).toBe("12500.50");
  });

  it("rejects negative values", () => {
    const r = dealSchema.safeParse({
      name: "x",
      value: "-1",
      pipelineId: "p",
      stageId: "s",
    });
    expect(r.success).toBe(false);
  });

  it("converts expectedCloseAt strings to Date", () => {
    const r = dealSchema.parse({
      name: "x",
      pipelineId: "p",
      stageId: "s",
      expectedCloseAt: "2026-12-01",
    });
    expect(r.expectedCloseAt).toBeInstanceOf(Date);
  });

  it("turns empty optional ids into null", () => {
    const r = dealSchema.parse({
      name: "x",
      pipelineId: "p",
      stageId: "s",
      contactId: "",
      companyId: "",
      ownerId: "",
    });
    expect(r.contactId).toBeNull();
    expect(r.companyId).toBeNull();
    expect(r.ownerId).toBeNull();
  });
});

describe("sales/schemas — dealStatusSchema", () => {
  it("accepts valid statuses", () => {
    expect(dealStatusSchema.safeParse({ status: "OPEN" }).success).toBe(true);
    expect(dealStatusSchema.safeParse({ status: "WON" }).success).toBe(true);
    expect(dealStatusSchema.safeParse({ status: "LOST", lostReason: "no budget" }).success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(dealStatusSchema.safeParse({ status: "MAYBE" }).success).toBe(false);
  });
});
