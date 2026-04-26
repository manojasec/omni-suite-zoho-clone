import { z } from "zod";

const optionalString = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max).optional(),
  );

export const FLOW_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

export const FLOW_TRIGGERS = ["MANUAL", "WEBHOOK", "SCHEDULE"] as const;
export type FlowTrigger = (typeof FLOW_TRIGGERS)[number];

export const FLOW_NODE_KINDS = [
  "START",
  "TASK",
  "CONDITION",
  "APPROVAL",
  "WEBHOOK_CALL",
  "DELAY",
  "END",
] as const;
export type FlowNodeKind = (typeof FLOW_NODE_KINDS)[number];

export const FLOW_RUN_STATUSES = [
  "PENDING",
  "RUNNING",
  "AWAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELED",
] as const;
export type FlowRunStatus = (typeof FLOW_RUN_STATUSES)[number];

export const FLOW_STEP_STATUSES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "SKIPPED",
  "FAILED",
] as const;
export type FlowStepStatus = (typeof FLOW_STEP_STATUSES)[number];

export const FLOW_APPROVAL_DECISIONS = ["PENDING", "APPROVED", "REJECTED"] as const;
export type FlowApprovalDecision = (typeof FLOW_APPROVAL_DECISIONS)[number];

export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

export const FLOW_TRIGGER_LABELS: Record<FlowTrigger, string> = {
  MANUAL: "Manual",
  WEBHOOK: "Webhook",
  SCHEDULE: "Schedule",
};

export const FLOW_NODE_KIND_LABELS: Record<FlowNodeKind, string> = {
  START: "Start",
  TASK: "Task",
  CONDITION: "Condition",
  APPROVAL: "Approval",
  WEBHOOK_CALL: "Webhook call",
  DELAY: "Delay",
  END: "End",
};

export const FLOW_RUN_STATUS_LABELS: Record<FlowRunStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  AWAITING_APPROVAL: "Awaiting approval",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELED: "Canceled",
};

export const FLOW_STEP_STATUS_LABELS: Record<FlowStepStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  FAILED: "Failed",
};

export const FLOW_APPROVAL_DECISION_LABELS: Record<FlowApprovalDecision, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const flowSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: optionalString(500),
  trigger: z.enum(FLOW_TRIGGERS).default("MANUAL"),
  status: z.enum(FLOW_STATUSES).default("DRAFT"),
});

const nodeKeyRe = /^[a-z][a-z0-9_]{0,63}$/;

export const flowNodeSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(
      nodeKeyRe,
      "Use lowercase letters, digits, and underscores; must start with a letter",
    ),
  kind: z.enum(FLOW_NODE_KINDS),
  label: z.string().trim().min(1).max(160),
  posX: z.coerce.number().int().min(-10_000).max(10_000).default(0),
  posY: z.coerce.number().int().min(-10_000).max(10_000).default(0),
});

export const flowEdgeSchema = z.object({
  fromKey: z.string().trim().min(1).max(64).regex(nodeKeyRe),
  toKey: z.string().trim().min(1).max(64).regex(nodeKeyRe),
  branch: optionalString(40),
});

export const flowApprovalDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: optionalString(500),
});

/** Allowed transitions for the flow definition. ARCHIVED is terminal. */
export const FLOW_TRANSITIONS: Record<FlowStatus, readonly FlowStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["PAUSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionFlow(from: FlowStatus, to: FlowStatus): boolean {
  return FLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Allowed transitions for a run. */
export const FLOW_RUN_TRANSITIONS: Record<FlowRunStatus, readonly FlowRunStatus[]> = {
  PENDING: ["RUNNING", "CANCELED"],
  RUNNING: ["AWAITING_APPROVAL", "COMPLETED", "FAILED", "CANCELED"],
  AWAITING_APPROVAL: ["RUNNING", "FAILED", "CANCELED"],
  COMPLETED: [],
  FAILED: [],
  CANCELED: [],
};

export function canTransitionRun(
  from: FlowRunStatus,
  to: FlowRunStatus,
): boolean {
  return FLOW_RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isRunTerminal(status: FlowRunStatus): boolean {
  return status === "COMPLETED" || status === "FAILED" || status === "CANCELED";
}

export type FlowGraphNode = {
  key: string;
  kind: FlowNodeKind;
};

export type FlowGraphEdge = {
  fromKey: string;
  toKey: string;
  branch?: string | null;
};

export type FlowGraphIssue = {
  code:
    | "MISSING_START"
    | "MISSING_END"
    | "MULTIPLE_START"
    | "DUPLICATE_KEY"
    | "ORPHAN_NODE"
    | "EDGE_TO_UNKNOWN"
    | "EDGE_FROM_UNKNOWN"
    | "EDGE_FROM_END"
    | "CONDITION_MISSING_BRANCH";
  message: string;
  ref?: string;
};

/**
 * Validate a flow graph. Returns the list of issues; empty means publish-ready.
 */
export function validateFlowGraph(
  nodes: readonly FlowGraphNode[],
  edges: readonly FlowGraphEdge[],
): FlowGraphIssue[] {
  const issues: FlowGraphIssue[] = [];
  const byKey = new Map<string, FlowGraphNode>();
  const dupKeys = new Set<string>();
  for (const n of nodes) {
    if (byKey.has(n.key)) dupKeys.add(n.key);
    else byKey.set(n.key, n);
  }
  for (const k of dupKeys) {
    issues.push({
      code: "DUPLICATE_KEY",
      message: `Node key "${k}" is used more than once`,
      ref: k,
    });
  }

  const starts = nodes.filter((n) => n.kind === "START");
  const ends = nodes.filter((n) => n.kind === "END");
  if (starts.length === 0)
    issues.push({ code: "MISSING_START", message: "Flow has no START node" });
  if (starts.length > 1)
    issues.push({
      code: "MULTIPLE_START",
      message: "Flow has more than one START node",
    });
  if (ends.length === 0)
    issues.push({ code: "MISSING_END", message: "Flow has no END node" });

  const adjacency = new Map<string, FlowGraphEdge[]>();
  for (const e of edges) {
    const fromNode = byKey.get(e.fromKey);
    const toNode = byKey.get(e.toKey);
    if (!fromNode) {
      issues.push({
        code: "EDGE_FROM_UNKNOWN",
        message: `Edge references unknown source "${e.fromKey}"`,
        ref: e.fromKey,
      });
      continue;
    }
    if (!toNode) {
      issues.push({
        code: "EDGE_TO_UNKNOWN",
        message: `Edge references unknown target "${e.toKey}"`,
        ref: e.toKey,
      });
      continue;
    }
    if (fromNode.kind === "END") {
      issues.push({
        code: "EDGE_FROM_END",
        message: `END node "${fromNode.key}" cannot have outgoing edges`,
        ref: fromNode.key,
      });
    }
    const list = adjacency.get(fromNode.key) ?? [];
    list.push(e);
    adjacency.set(fromNode.key, list);
  }

  // CONDITION nodes need at least one labeled branch.
  for (const n of nodes) {
    if (n.kind !== "CONDITION") continue;
    const out = adjacency.get(n.key) ?? [];
    const hasLabeled = out.some((e) => (e.branch ?? "").trim().length > 0);
    if (!hasLabeled) {
      issues.push({
        code: "CONDITION_MISSING_BRANCH",
        message: `Condition "${n.key}" needs at least one labeled branch (e.g. "yes"/"no")`,
        ref: n.key,
      });
    }
  }

  // Orphans: non-START nodes with no incoming edges.
  const incomingCount = new Map<string, number>();
  for (const e of edges) {
    if (!byKey.has(e.fromKey) || !byKey.has(e.toKey)) continue;
    incomingCount.set(e.toKey, (incomingCount.get(e.toKey) ?? 0) + 1);
  }
  for (const n of nodes) {
    if (n.kind === "START") continue;
    if ((incomingCount.get(n.key) ?? 0) === 0) {
      issues.push({
        code: "ORPHAN_NODE",
        message: `Node "${n.key}" has no incoming edges`,
        ref: n.key,
      });
    }
  }

  return issues;
}

/** Compute next nodes from a given key, optionally filtered by branch label. */
export function nextNodes(
  edges: readonly FlowGraphEdge[],
  fromKey: string,
  branch?: string | null,
): string[] {
  return edges
    .filter((e) => e.fromKey === fromKey)
    .filter((e) => {
      if (branch == null) return true;
      const b = (e.branch ?? "").trim().toLowerCase();
      return b === branch.trim().toLowerCase() || b === "";
    })
    .map((e) => e.toKey);
}

export type FlowRunSummary = {
  total: number;
  byStatus: Record<FlowRunStatus, number>;
  awaitingApproval: number;
};

export function summarizeRuns(
  runs: readonly { status: FlowRunStatus }[],
): FlowRunSummary {
  const byStatus: Record<FlowRunStatus, number> = {
    PENDING: 0,
    RUNNING: 0,
    AWAITING_APPROVAL: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELED: 0,
  };
  for (const r of runs) byStatus[r.status] += 1;
  return {
    total: runs.length,
    byStatus,
    awaitingApproval: byStatus.AWAITING_APPROVAL,
  };
}

export function formatRelativeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ${sec % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  const t = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(t.getTime())) return "";
  return t.toISOString().slice(0, 16).replace("T", " ");
}

/** Default starter graph: START → END, useful for new flows. */
export function defaultStarterGraph(): {
  nodes: { key: string; kind: FlowNodeKind; label: string; posX: number; posY: number }[];
  edges: { fromKey: string; toKey: string; branch?: string }[];
} {
  return {
    nodes: [
      { key: "start", kind: "START", label: "Start", posX: 80, posY: 80 },
      { key: "end", kind: "END", label: "End", posX: 80, posY: 320 },
    ],
    edges: [{ fromKey: "start", toKey: "end" }],
  };
}
