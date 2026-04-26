import { describe, expect, it } from "vitest";
import {
  ASSET_STATUSES,
  CHANGE_RISKS,
  CHANGE_STATUSES,
  CHANGE_TRANSITIONS,
  PRIORITIES,
  PROBLEM_STATUSES,
  PROBLEM_TRANSITIONS,
  assetSchema,
  canTransitionChange,
  canTransitionProblem,
  changeRiskWeight,
  changeSchema,
  formatAssetLabel,
  formatDate,
  priorityWeight,
  problemSchema,
  resolveProblemSchema,
  summarizeByStatus,
} from "@/modules/itsm/schemas";

describe("assetSchema", () => {
  it("accepts a minimal asset", () => {
    const r = assetSchema.parse({ tag: "AST-0001", name: "MacBook Pro 14" });
    expect(r.tag).toBe("AST-0001");
    expect(r.name).toBe("MacBook Pro 14");
    expect(r.status).toBe("IN_USE");
    expect(r.category).toBe("general");
  });

  it("rejects empty tag", () => {
    expect(() => assetSchema.parse({ tag: "", name: "X" })).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => assetSchema.parse({ tag: "T", name: "" })).toThrow();
  });

  it("coerces cost from string and clamps negatives", () => {
    const ok = assetSchema.parse({ tag: "T", name: "X", cost: "1499.50" });
    expect(ok.cost).toBeCloseTo(1499.5);
    expect(() =>
      assetSchema.parse({ tag: "T", name: "X", cost: "-1" }),
    ).toThrow();
  });

  it("normalises empty optional strings to undefined", () => {
    const r = assetSchema.parse({
      tag: "T",
      name: "X",
      serial: "",
      vendor: "",
      location: "",
      assignedToEmployeeId: "",
      notes: "",
    });
    expect(r.serial).toBeUndefined();
    expect(r.vendor).toBeUndefined();
    expect(r.location).toBeUndefined();
    expect(r.assignedToEmployeeId).toBeUndefined();
    expect(r.notes).toBeUndefined();
  });

  it("rejects unknown status", () => {
    expect(() =>
      assetSchema.parse({ tag: "T", name: "X", status: "BOGUS" }),
    ).toThrow();
  });
});

describe("changeSchema", () => {
  it("accepts a minimal change", () => {
    const r = changeSchema.parse({ title: "Patch DB" });
    expect(r.title).toBe("Patch DB");
    expect(r.risk).toBe("MEDIUM");
  });

  it("rejects empty title", () => {
    expect(() => changeSchema.parse({ title: "" })).toThrow();
  });

  it("rejects unknown risk", () => {
    expect(() => changeSchema.parse({ title: "x", risk: "EXTREME" })).toThrow();
  });
});

describe("problemSchema", () => {
  it("accepts a minimal problem", () => {
    const r = problemSchema.parse({ title: "Outages" });
    expect(r.priority).toBe("MEDIUM");
  });

  it("respects priority", () => {
    const r = problemSchema.parse({ title: "x", priority: "URGENT" });
    expect(r.priority).toBe("URGENT");
  });

  it("rejects unknown priority", () => {
    expect(() =>
      problemSchema.parse({ title: "x", priority: "ASAP" }),
    ).toThrow();
  });
});

describe("resolveProblemSchema", () => {
  it("requires non-empty resolution", () => {
    expect(() => resolveProblemSchema.parse({ resolution: "" })).toThrow();
    const r = resolveProblemSchema.parse({ resolution: "Restart fixed it" });
    expect(r.resolution).toBe("Restart fixed it");
  });
});

describe("change transitions", () => {
  it("DRAFT can submit or cancel", () => {
    expect(canTransitionChange("DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransitionChange("DRAFT", "CANCELED")).toBe(true);
    expect(canTransitionChange("DRAFT", "APPROVED")).toBe(false);
  });

  it("SUBMITTED can be approved/rejected/canceled", () => {
    expect(canTransitionChange("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransitionChange("SUBMITTED", "REJECTED")).toBe(true);
    expect(canTransitionChange("SUBMITTED", "COMPLETED")).toBe(false);
  });

  it("APPROVED → IN_PROGRESS → COMPLETED", () => {
    expect(canTransitionChange("APPROVED", "IN_PROGRESS")).toBe(true);
    expect(canTransitionChange("IN_PROGRESS", "COMPLETED")).toBe(true);
  });

  it("terminal states are sticky", () => {
    expect(canTransitionChange("COMPLETED", "DRAFT")).toBe(false);
    expect(canTransitionChange("REJECTED", "DRAFT")).toBe(false);
    expect(canTransitionChange("CANCELED", "DRAFT")).toBe(false);
  });
});

describe("problem transitions", () => {
  it("OPEN can advance to investigation or beyond", () => {
    expect(canTransitionProblem("OPEN", "INVESTIGATING")).toBe(true);
    expect(canTransitionProblem("OPEN", "RESOLVED")).toBe(true);
  });

  it("RESOLVED can re-open or close", () => {
    expect(canTransitionProblem("RESOLVED", "OPEN")).toBe(true);
    expect(canTransitionProblem("RESOLVED", "CLOSED")).toBe(true);
    expect(canTransitionProblem("RESOLVED", "INVESTIGATING")).toBe(false);
  });

  it("CLOSED is terminal", () => {
    expect(canTransitionProblem("CLOSED", "OPEN")).toBe(false);
  });
});

describe("helpers", () => {
  it("formatDate handles Date / null / invalid", () => {
    expect(formatDate(new Date("2026-04-15T00:00:00Z"))).toBe("2026-04-15");
    expect(formatDate(null)).toBe("");
    expect(formatDate(new Date("not-a-date"))).toBe("");
  });

  it("formatAssetLabel renders [tag] name", () => {
    expect(formatAssetLabel({ tag: "AST-1", name: "X" })).toBe("[AST-1] X");
  });

  it("summarizeByStatus counts buckets and ignores unknown", () => {
    const counts = summarizeByStatus(
      [
        { status: "OPEN" },
        { status: "OPEN" },
        { status: "RESOLVED" },
        { status: "BOGUS" as unknown as "OPEN" },
      ],
      PROBLEM_STATUSES,
    );
    expect(counts.OPEN).toBe(2);
    expect(counts.RESOLVED).toBe(1);
    expect(counts.CLOSED).toBe(0);
  });

  it("changeRiskWeight ranks correctly", () => {
    expect(changeRiskWeight("LOW")).toBe(1);
    expect(changeRiskWeight("MEDIUM")).toBe(2);
    expect(changeRiskWeight("HIGH")).toBe(3);
  });

  it("priorityWeight ranks correctly", () => {
    expect(priorityWeight("LOW")).toBe(1);
    expect(priorityWeight("URGENT")).toBe(4);
  });

  it("constants are stable", () => {
    expect(ASSET_STATUSES).toContain("IN_USE");
    expect(CHANGE_STATUSES).toContain("APPROVED");
    expect(CHANGE_RISKS).toContain("HIGH");
    expect(PROBLEM_STATUSES).toContain("KNOWN_ERROR");
    expect(PRIORITIES).toContain("URGENT");
    expect(CHANGE_TRANSITIONS.COMPLETED).toEqual([]);
    expect(PROBLEM_TRANSITIONS.CLOSED).toEqual([]);
  });
});
