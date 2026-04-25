import { describe, expect, it } from "vitest";
import { projectSchema, taskSchema, taskStatusMoveSchema } from "@/modules/projects/schemas";

describe("projects/schemas — projectSchema", () => {
  it("requires a name", () => {
    expect(projectSchema.safeParse({ name: "" }).success).toBe(false);
    expect(projectSchema.safeParse({ name: "Apollo" }).success).toBe(true);
  });

  it("defaults status to PLANNING", () => {
    const r = projectSchema.parse({ name: "x" });
    expect(r.status).toBe("PLANNING");
  });

  it("normalises empty optional strings to null", () => {
    const r = projectSchema.parse({ name: "x", description: "" });
    expect(r.description).toBeNull();
  });

  it("rejects negative budget amount", () => {
    expect(projectSchema.safeParse({ name: "x", budgetAmount: "-1" }).success).toBe(false);
  });

  it("accepts a numeric budget amount", () => {
    const r = projectSchema.parse({ name: "x", budgetAmount: "1500.5" });
    expect(r.budgetAmount).toBe("1500.50");
  });

  it("parses a date string", () => {
    const r = projectSchema.parse({ name: "x", startDate: "2025-01-01" });
    expect(r.startDate).toBeInstanceOf(Date);
  });
});

describe("projects/schemas — taskSchema", () => {
  it("requires a title", () => {
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false);
    expect(taskSchema.safeParse({ title: "ship it" }).success).toBe(true);
  });

  it("defaults status TODO and priority MEDIUM", () => {
    const r = taskSchema.parse({ title: "x" });
    expect(r.status).toBe("TODO");
    expect(r.priority).toBe("MEDIUM");
  });

  it("rejects an invalid status", () => {
    expect(taskSchema.safeParse({ title: "x", status: "BOGUS" }).success).toBe(false);
  });
});

describe("projects/schemas — taskStatusMoveSchema", () => {
  it("requires a valid status", () => {
    expect(taskStatusMoveSchema.safeParse({ taskId: "t1", status: "DONE" }).success).toBe(true);
    expect(taskStatusMoveSchema.safeParse({ taskId: "t1", status: "BOGUS" }).success).toBe(false);
    expect(taskStatusMoveSchema.safeParse({ taskId: "", status: "DONE" }).success).toBe(false);
  });
});
