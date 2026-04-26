import { describe, expect, it } from "vitest";
import {
  FLOW_NODE_KINDS,
  FLOW_RUN_STATUSES,
  FLOW_STATUSES,
  FLOW_RUN_TRANSITIONS,
  FLOW_TRANSITIONS,
  canTransitionFlow,
  canTransitionRun,
  defaultStarterGraph,
  flowApprovalDecisionSchema,
  flowEdgeSchema,
  flowNodeSchema,
  flowSchema,
  formatRelativeDuration,
  isRunTerminal,
  nextNodes,
  summarizeRuns,
  validateFlowGraph,
} from "@/modules/flows/schemas";

describe("flow constants", () => {
  it("exposes expected enum values", () => {
    expect(FLOW_STATUSES).toEqual(["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"]);
    expect(FLOW_NODE_KINDS).toContain("START");
    expect(FLOW_NODE_KINDS).toContain("END");
    expect(FLOW_NODE_KINDS).toContain("APPROVAL");
    expect(FLOW_RUN_STATUSES).toContain("AWAITING_APPROVAL");
  });
});

describe("flowSchema", () => {
  it("parses with defaults", () => {
    const r = flowSchema.parse({ name: "Onboard new hire" });
    expect(r.name).toBe("Onboard new hire");
    expect(r.trigger).toBe("MANUAL");
    expect(r.status).toBe("DRAFT");
  });

  it("treats empty description as undefined", () => {
    const r = flowSchema.parse({ name: "x", description: "" });
    expect(r.description).toBeUndefined();
  });

  it("rejects empty name", () => {
    expect(() => flowSchema.parse({ name: "" })).toThrow();
  });
});

describe("flowNodeSchema", () => {
  it("requires lowercase identifier-style keys", () => {
    expect(() =>
      flowNodeSchema.parse({ key: "Approve!", kind: "TASK", label: "x" }),
    ).toThrow();
    expect(() =>
      flowNodeSchema.parse({ key: "1approve", kind: "TASK", label: "x" }),
    ).toThrow();
    expect(
      flowNodeSchema.parse({ key: "approve_invoice", kind: "TASK", label: "x" })
        .key,
    ).toBe("approve_invoice");
  });

  it("coerces position fields", () => {
    const r = flowNodeSchema.parse({
      key: "n",
      kind: "TASK",
      label: "x",
      posX: "120",
      posY: "200",
    });
    expect(r.posX).toBe(120);
    expect(r.posY).toBe(200);
  });
});

describe("flowEdgeSchema", () => {
  it("normalizes optional branch", () => {
    const r = flowEdgeSchema.parse({ fromKey: "a", toKey: "b", branch: "" });
    expect(r.branch).toBeUndefined();
  });

  it("rejects invalid keys", () => {
    expect(() =>
      flowEdgeSchema.parse({ fromKey: "A", toKey: "b" }),
    ).toThrow();
  });
});

describe("flowApprovalDecisionSchema", () => {
  it("only accepts APPROVED or REJECTED", () => {
    expect(flowApprovalDecisionSchema.parse({ decision: "APPROVED" }).decision).toBe(
      "APPROVED",
    );
    expect(() =>
      flowApprovalDecisionSchema.parse({ decision: "PENDING" }),
    ).toThrow();
  });
});

describe("flow status transitions", () => {
  it("matches the documented matrix", () => {
    expect(FLOW_TRANSITIONS.ARCHIVED).toEqual([]);
    expect(canTransitionFlow("DRAFT", "ACTIVE")).toBe(true);
    expect(canTransitionFlow("ACTIVE", "PAUSED")).toBe(true);
    expect(canTransitionFlow("ACTIVE", "DRAFT")).toBe(false);
    expect(canTransitionFlow("PAUSED", "ACTIVE")).toBe(true);
    expect(canTransitionFlow("ARCHIVED", "ACTIVE")).toBe(false);
  });
});

describe("run transitions", () => {
  it("matches the documented matrix", () => {
    expect(FLOW_RUN_TRANSITIONS.COMPLETED).toEqual([]);
    expect(canTransitionRun("PENDING", "RUNNING")).toBe(true);
    expect(canTransitionRun("RUNNING", "AWAITING_APPROVAL")).toBe(true);
    expect(canTransitionRun("AWAITING_APPROVAL", "RUNNING")).toBe(true);
    expect(canTransitionRun("AWAITING_APPROVAL", "COMPLETED")).toBe(false);
    expect(canTransitionRun("COMPLETED", "RUNNING")).toBe(false);
  });

  it("identifies terminal statuses", () => {
    expect(isRunTerminal("COMPLETED")).toBe(true);
    expect(isRunTerminal("FAILED")).toBe(true);
    expect(isRunTerminal("CANCELED")).toBe(true);
    expect(isRunTerminal("RUNNING")).toBe(false);
  });
});

describe("validateFlowGraph", () => {
  it("accepts a minimal start→end graph", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "end", kind: "END" },
      ],
      [{ fromKey: "start", toKey: "end" }],
    );
    expect(issues).toEqual([]);
  });

  it("flags missing START and END", () => {
    const issues = validateFlowGraph([{ key: "t1", kind: "TASK" }], []);
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("MISSING_START");
    expect(codes).toContain("MISSING_END");
  });

  it("flags multiple START nodes", () => {
    const issues = validateFlowGraph(
      [
        { key: "s1", kind: "START" },
        { key: "s2", kind: "START" },
        { key: "end", kind: "END" },
      ],
      [
        { fromKey: "s1", toKey: "end" },
        { fromKey: "s2", toKey: "end" },
      ],
    );
    expect(issues.map((i) => i.code)).toContain("MULTIPLE_START");
  });

  it("flags duplicate node keys", () => {
    const issues = validateFlowGraph(
      [
        { key: "x", kind: "START" },
        { key: "x", kind: "TASK" },
        { key: "end", kind: "END" },
      ],
      [{ fromKey: "x", toKey: "end" }],
    );
    expect(issues.some((i) => i.code === "DUPLICATE_KEY")).toBe(true);
  });

  it("flags edges referencing unknown nodes", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "end", kind: "END" },
      ],
      [
        { fromKey: "start", toKey: "ghost" },
        { fromKey: "phantom", toKey: "end" },
      ],
    );
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("EDGE_TO_UNKNOWN");
    expect(codes).toContain("EDGE_FROM_UNKNOWN");
  });

  it("flags outgoing edges from END nodes", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "end", kind: "END" },
        { key: "extra", kind: "TASK" },
      ],
      [
        { fromKey: "start", toKey: "end" },
        { fromKey: "end", toKey: "extra" },
      ],
    );
    expect(issues.some((i) => i.code === "EDGE_FROM_END")).toBe(true);
  });

  it("flags orphan non-start nodes", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "lonely", kind: "TASK" },
        { key: "end", kind: "END" },
      ],
      [{ fromKey: "start", toKey: "end" }],
    );
    expect(
      issues.find((i) => i.code === "ORPHAN_NODE" && i.ref === "lonely"),
    ).toBeDefined();
  });

  it("flags conditions with no labeled branch", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "cond", kind: "CONDITION" },
        { key: "end", kind: "END" },
      ],
      [
        { fromKey: "start", toKey: "cond" },
        { fromKey: "cond", toKey: "end" },
      ],
    );
    expect(
      issues.some((i) => i.code === "CONDITION_MISSING_BRANCH"),
    ).toBe(true);
  });

  it("accepts conditions with labeled branches", () => {
    const issues = validateFlowGraph(
      [
        { key: "start", kind: "START" },
        { key: "cond", kind: "CONDITION" },
        { key: "yes_path", kind: "TASK" },
        { key: "end", kind: "END" },
      ],
      [
        { fromKey: "start", toKey: "cond" },
        { fromKey: "cond", toKey: "yes_path", branch: "yes" },
        { fromKey: "cond", toKey: "end", branch: "no" },
        { fromKey: "yes_path", toKey: "end" },
      ],
    );
    expect(issues.find((i) => i.code === "CONDITION_MISSING_BRANCH")).toBeUndefined();
  });
});

describe("nextNodes", () => {
  const edges = [
    { fromKey: "a", toKey: "b" },
    { fromKey: "a", toKey: "c", branch: "yes" },
    { fromKey: "a", toKey: "d", branch: "no" },
  ];

  it("returns all targets when branch is unspecified", () => {
    expect(nextNodes(edges, "a")).toEqual(["b", "c", "d"]);
  });

  it("filters by matching branch (and keeps unlabeled fallthrough)", () => {
    const r = nextNodes(edges, "a", "yes");
    expect(r).toContain("c");
    expect(r).toContain("b"); // unlabeled fallthrough
    expect(r).not.toContain("d");
  });

  it("returns empty for unknown source", () => {
    expect(nextNodes(edges, "z")).toEqual([]);
  });
});

describe("summarizeRuns", () => {
  it("counts by status and surfaces awaitingApproval", () => {
    const r = summarizeRuns([
      { status: "RUNNING" },
      { status: "RUNNING" },
      { status: "AWAITING_APPROVAL" },
      { status: "COMPLETED" },
    ]);
    expect(r.total).toBe(4);
    expect(r.byStatus.RUNNING).toBe(2);
    expect(r.awaitingApproval).toBe(1);
  });
});

describe("formatRelativeDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatRelativeDuration(5_000)).toBe("5s");
    expect(formatRelativeDuration(125_000)).toBe("2m 5s");
    expect(formatRelativeDuration(3_700_000)).toBe("1h 1m");
  });
  it("clamps invalid input", () => {
    expect(formatRelativeDuration(-1)).toBe("0s");
    expect(formatRelativeDuration(Number.NaN)).toBe("0s");
  });
});

describe("defaultStarterGraph", () => {
  it("produces a valid two-node graph", () => {
    const g = defaultStarterGraph();
    const issues = validateFlowGraph(
      g.nodes.map((n) => ({ key: n.key, kind: n.kind })),
      g.edges.map((e) => ({ fromKey: e.fromKey, toKey: e.toKey, branch: e.branch })),
    );
    expect(issues).toEqual([]);
  });
});
