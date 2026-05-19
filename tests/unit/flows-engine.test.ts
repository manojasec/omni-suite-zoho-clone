import { describe, it, expect } from "vitest";
import {
  evalCondition,
  executeNode,
  findStartKey,
  resumeApproval,
  type FlowGraph,
  type FlowNodeDef,
} from "@/modules/flows/engine";

const baseGraph: FlowGraph = {
  nodes: [
    { key: "start", kind: "START", config: null },
    { key: "approve", kind: "APPROVAL", config: { approverIds: "alice" } },
    { key: "branch", kind: "CONDITION", config: { expr: "input.amount > 100" } },
    { key: "task_high", kind: "TASK", config: { action: "notify_finance" } },
    { key: "task_low", kind: "TASK", config: { action: "log_only" } },
    { key: "wait", kind: "DELAY", config: { seconds: 60 } },
    { key: "end", kind: "END", config: null },
  ],
  edges: [
    { fromKey: "start", toKey: "approve" },
    { fromKey: "approve", toKey: "branch" },
    { fromKey: "branch", toKey: "task_high", branch: "true" },
    { fromKey: "branch", toKey: "task_low", branch: "false" },
    { fromKey: "task_high", toKey: "wait" },
    { fromKey: "task_low", toKey: "end" },
    { fromKey: "wait", toKey: "end" },
  ],
};

describe("flows engine — graph helpers", () => {
  it("findStartKey returns the START node key", () => {
    expect(findStartKey(baseGraph)).toBe("start");
  });
});

describe("flows engine — executeNode", () => {
  const ctx = { input: { amount: 250 }, output: {} };

  it("START advances to its outgoing edge", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[0]!, ctx);
    expect(out).toMatchObject({ kind: "advance", toKey: "approve" });
  });

  it("APPROVAL produces awaitApproval with parsed approvers", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[1]!, ctx);
    expect(out).toEqual({ kind: "awaitApproval", approverIds: ["alice"] });
  });

  it("CONDITION takes the true branch when expr is truthy", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[2]!, ctx);
    expect(out).toMatchObject({ kind: "advance", toKey: "task_high" });
  });

  it("CONDITION takes the false branch when expr is falsy", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[2]!, {
      input: { amount: 50 },
      output: {},
    });
    expect(out).toMatchObject({ kind: "advance", toKey: "task_low" });
  });

  it("DELAY returns a delay outcome with seconds + next key", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[5]!, ctx);
    expect(out).toEqual({ kind: "delay", toKey: "end", seconds: 60 });
  });

  it("END completes the run", () => {
    const out = executeNode(baseGraph, baseGraph.nodes[6]!, ctx);
    expect(out.kind).toBe("complete");
  });

  it("WEBHOOK_CALL rejects non-http URLs", () => {
    const node: FlowNodeDef = {
      key: "wh",
      kind: "WEBHOOK_CALL",
      config: { url: "javascript:alert(1)" },
    };
    const out = executeNode(
      { nodes: [node], edges: [] },
      node,
      ctx,
    );
    expect(out.kind).toBe("fail");
  });
});

describe("flows engine — resumeApproval", () => {
  it("APPROVED advances along default edge", () => {
    const node = baseGraph.nodes[1]!;
    const out = resumeApproval(baseGraph, node, "APPROVED");
    expect(out).toMatchObject({ kind: "advance", toKey: "branch" });
  });

  it("REJECTED fails when no rejected branch exists", () => {
    const node = baseGraph.nodes[1]!;
    const out = resumeApproval(baseGraph, node, "REJECTED");
    expect(out.kind).toBe("fail");
  });

  it("REJECTED routes via branch=rejected when present", () => {
    const g: FlowGraph = {
      ...baseGraph,
      edges: [
        ...baseGraph.edges,
        { fromKey: "approve", toKey: "end", branch: "rejected" },
      ],
    };
    const out = resumeApproval(g, g.nodes[1]!, "REJECTED");
    expect(out).toMatchObject({ kind: "advance", toKey: "end" });
  });
});

describe("flows engine — evalCondition", () => {
  const ctx = { input: { amount: 200, tier: "pro" }, output: { x: 5 } };

  it("evaluates simple comparisons", () => {
    expect(evalCondition("input.amount > 100", ctx)).toBe(true);
    expect(evalCondition("input.amount < 100", ctx)).toBe(false);
  });

  it("supports && and ||", () => {
    expect(evalCondition('input.amount > 100 && input.tier == "pro"', ctx)).toBe(true);
    expect(evalCondition('input.tier == "free" || output.x == 5', ctx)).toBe(true);
  });

  it("supports unary !", () => {
    expect(evalCondition('!(input.tier == "free")', ctx)).toBe(true);
  });

  it("treats undefined paths as undefined (falsy)", () => {
    expect(evalCondition("input.missing == null", ctx)).toBe(true);
  });

  it("rejects unknown operators", () => {
    expect(() => evalCondition("input.amount ** 2", ctx)).toThrow();
  });
});
