/**
 * Flow execution engine. Pure step-resolver + a job-queue runner.
 *
 * Domain model:
 *   - A `Flow` is a graph of `FlowNode`s (kinds: START / TASK / CONDITION /
 *     APPROVAL / WEBHOOK_CALL / DELAY / END) joined by `FlowEdge`s. Edges
 *     emerging from a CONDITION node are labelled with a `branch`
 *     ("true"/"false"/etc).
 *   - A `FlowRun` walks the graph one node at a time. Each visited node
 *     produces a `FlowRunStep`.
 *   - The engine itself is fully synchronous & DB-free. The job runner
 *     `flow.run.advance` (registered via `registerFlowRunHandler`) loads
 *     state from the DB, calls into this engine, persists the result,
 *     and re-enqueues if more work remains.
 *
 * Decisions in this engine:
 *   - CONDITION evaluation uses a tiny safe expression DSL (`config.expr`)
 *     evaluated against `run.input` + accumulated `output`. We DO NOT run
 *     `eval`/`new Function`. Supported operators: `==`, `!=`, `<`, `<=`,
 *     `>`, `>=`, `&&`, `||`, `!`. Variables are dotted paths.
 *   - DELAY uses `config.seconds`; the runner re-enqueues with `runAt`.
 *   - APPROVAL pauses the run by returning `awaitingApproval` so the caller
 *     persists status = AWAITING_APPROVAL; an external decision
 *     (`decideApprovalStep`) resumes it.
 *   - WEBHOOK_CALL is delegated to the caller (it owns network IO).
 */

import type {
  FlowGraphEdge,
  FlowGraphNode,
  FlowNodeKind,
} from "./schemas";

export type FlowConfig = {
  /** CONDITION: a tiny boolean expression. Supports paths into context. */
  expr?: string;
  /** DELAY: seconds to wait before continuing. */
  seconds?: number;
  /** WEBHOOK_CALL: external URL the runner should POST to. */
  url?: string;
  /** WEBHOOK_CALL: HTTP method. Defaults to POST. */
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** APPROVAL: comma/semicolon level-encoded approver string. */
  approverIds?: string;
  /** TASK: a free-form action key the host app dispatches. */
  action?: string;
  /** Generic JSON parameters for any node. */
  params?: Record<string, unknown>;
};

export type FlowNodeDef = FlowGraphNode & {
  config: FlowConfig | null;
};

export type FlowGraph = {
  nodes: FlowNodeDef[];
  edges: FlowGraphEdge[];
};

export type FlowContext = {
  /** Input payload to the run. */
  input: Record<string, unknown>;
  /** Per-node outputs accumulated during the run, keyed by node `key`. */
  output: Record<string, unknown>;
};

export type StepOutcome =
  | { kind: "advance"; toKey: string; output?: unknown; note?: string }
  | { kind: "delay"; toKey: string; seconds: number; note?: string }
  | {
      kind: "awaitApproval";
      approverIds: string[];
      output?: unknown;
      note?: string;
    }
  | { kind: "webhook"; url: string; method: string; body: unknown; toKey: string }
  | { kind: "complete"; output?: unknown }
  | { kind: "fail"; error: string };

/** Find the START node key, or throw. */
export function findStartKey(graph: FlowGraph): string {
  const start = graph.nodes.find((n) => n.kind === "START");
  if (!start) throw new Error("Flow has no START node");
  return start.key;
}

/** Map of fromKey → ordered list of edges. */
export function indexEdges(graph: FlowGraph): Map<string, FlowGraphEdge[]> {
  const map = new Map<string, FlowGraphEdge[]>();
  for (const e of graph.edges) {
    const arr = map.get(e.fromKey) ?? [];
    arr.push(e);
    map.set(e.fromKey, arr);
  }
  return map;
}

function nextKey(
  graph: FlowGraph,
  fromKey: string,
  branch?: string,
): string | null {
  const edges = indexEdges(graph).get(fromKey) ?? [];
  if (branch) {
    const exact = edges.find((e) => (e.branch ?? "") === branch);
    if (exact) return exact.toKey;
  }
  // Default branch (no label) is preferred when no branch matched.
  const def = edges.find((e) => !e.branch);
  if (def) return def.toKey;
  return edges[0]?.toKey ?? null;
}

/**
 * Compute the next outcome for `node` given the run context. Pure.
 *
 * Caller is responsible for persisting the FlowRunStep + advancing to
 * `outcome.toKey` (or marking the run terminal/awaiting).
 */
export function executeNode(
  graph: FlowGraph,
  node: FlowNodeDef,
  ctx: FlowContext,
): StepOutcome {
  switch (node.kind) {
    case "START": {
      const to = nextKey(graph, node.key);
      if (!to) return { kind: "fail", error: "START has no outgoing edge" };
      return { kind: "advance", toKey: to };
    }
    case "END":
      return { kind: "complete", output: ctx.output };
    case "TASK": {
      // The engine does not execute the side-effect; the job runner does.
      // We simply pass control onward.
      const to = nextKey(graph, node.key);
      if (!to) return { kind: "fail", error: `TASK ${node.key} has no outgoing edge` };
      return {
        kind: "advance",
        toKey: to,
        output: { action: node.config?.action ?? null },
      };
    }
    case "CONDITION": {
      const expr = node.config?.expr ?? "true";
      let truthy: boolean;
      try {
        truthy = evalCondition(expr, ctx);
      } catch (err) {
        return { kind: "fail", error: `Condition ${node.key}: ${(err as Error).message}` };
      }
      const to = nextKey(graph, node.key, truthy ? "true" : "false");
      if (!to) {
        return {
          kind: "fail",
          error: `CONDITION ${node.key} missing branch ${truthy ? "true" : "false"}`,
        };
      }
      return { kind: "advance", toKey: to, output: { branch: truthy } };
    }
    case "DELAY": {
      const seconds = Math.max(0, Math.floor(node.config?.seconds ?? 0));
      const to = nextKey(graph, node.key);
      if (!to) return { kind: "fail", error: `DELAY ${node.key} has no outgoing edge` };
      return { kind: "delay", toKey: to, seconds };
    }
    case "APPROVAL": {
      const approverIds = (node.config?.approverIds ?? "")
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (approverIds.length === 0) {
        return { kind: "fail", error: `APPROVAL ${node.key} has no approvers` };
      }
      return { kind: "awaitApproval", approverIds };
    }
    case "WEBHOOK_CALL": {
      const url = node.config?.url ?? "";
      if (!/^https?:\/\//i.test(url)) {
        return { kind: "fail", error: `WEBHOOK_CALL ${node.key} invalid URL` };
      }
      const to = nextKey(graph, node.key);
      if (!to) return { kind: "fail", error: `WEBHOOK_CALL ${node.key} has no outgoing edge` };
      return {
        kind: "webhook",
        url,
        method: node.config?.method ?? "POST",
        body: { ...node.config?.params, ctx },
        toKey: to,
      };
    }
    default: {
      const _exhaustive: never = node.kind as never;
      return { kind: "fail", error: `Unsupported node kind: ${String(_exhaustive)}` };
    }
  }
}

/**
 * Resume an APPROVAL step with a decision. Pure: returns the next outcome.
 * Approved → advance via default edge OR `branch="approved"`. Rejected →
 * branch="rejected" or fail.
 */
export function resumeApproval(
  graph: FlowGraph,
  node: FlowNodeDef,
  decision: "APPROVED" | "REJECTED",
): StepOutcome {
  if (node.kind !== "APPROVAL") {
    return { kind: "fail", error: `Node ${node.key} is not an approval` };
  }
  if (decision === "APPROVED") {
    const to =
      nextKey(graph, node.key, "approved") ?? nextKey(graph, node.key);
    if (!to) return { kind: "fail", error: `APPROVAL ${node.key} no edge` };
    return { kind: "advance", toKey: to, output: { decision } };
  }
  // Reject must use an explicit branch="rejected" edge; otherwise the run fails.
  const explicit = graph.edges.find(
    (e) => e.fromKey === node.key && e.branch === "rejected",
  );
  if (explicit) return { kind: "advance", toKey: explicit.toKey, output: { decision } };
  return { kind: "fail", error: `Approval rejected on ${node.key}` };
}

// ---------------- Condition expression DSL ----------------

/**
 * Tiny boolean expression evaluator. Handles operators and dotted paths into
 * `ctx.input` + `ctx.output`. NOT a general-purpose JS evaluator.
 *
 * Supported:
 *   `input.amount > 100`
 *   `output.foo == "bar" && input.tier != "free"`
 *   `!input.flag`
 *   parentheses
 *
 * Only the explicit operators above are recognised; anything else throws.
 */
export function evalCondition(expr: string, ctx: FlowContext): boolean {
  const tokens = tokenize(expr);
  const parser = new Parser(tokens, ctx);
  const value = parser.parseExpr();
  parser.expectEof();
  return Boolean(value);
}

type Token =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "ident"; v: string }
  | { t: "op"; v: string }
  | { t: "lparen" }
  | { t: "rparen" }
  | { t: "true" }
  | { t: "false" }
  | { t: "null" };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      out.push({ t: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      out.push({ t: "rparen" });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = src.indexOf(c, i + 1);
      if (end === -1) throw new Error("Unterminated string literal");
      out.push({ t: "str", v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9]+(?:\.[0-9]+)?/.exec(src.slice(i));
      out.push({ t: "num", v: Number(m![0]) });
      i += m![0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_.]*/.exec(src.slice(i))!;
      const word = m[0];
      if (word === "true") out.push({ t: "true" });
      else if (word === "false") out.push({ t: "false" });
      else if (word === "null") out.push({ t: "null" });
      else out.push({ t: "ident", v: word });
      i += word.length;
      continue;
    }
    // Operators: ==, !=, <=, >=, <, >, &&, ||, !
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      out.push({ t: "op", v: two });
      i += 2;
      continue;
    }
    if (["<", ">", "!"].includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Unexpected character: ${c}`);
  }
  return out;
}

class Parser {
  private p = 0;
  constructor(private tokens: Token[], private ctx: FlowContext) {}

  peek(): Token | undefined {
    return this.tokens[this.p];
  }
  eat(): Token {
    const t = this.tokens[this.p++];
    if (!t) throw new Error("Unexpected end of expression");
    return t;
  }
  expectEof(): void {
    if (this.p < this.tokens.length) throw new Error("Trailing tokens");
  }

  parseExpr(): unknown {
    return this.parseOr();
  }
  parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "||") {
      this.eat();
      const right = this.parseAnd();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }
  parseAnd(): unknown {
    let left = this.parseEq();
    while (this.peek()?.t === "op" && (this.peek() as { v: string }).v === "&&") {
      this.eat();
      const right = this.parseEq();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }
  parseEq(): unknown {
    let left = this.parseRel();
    const op = this.peek();
    if (op?.t === "op" && (op.v === "==" || op.v === "!=")) {
      this.eat();
      const right = this.parseRel();
      // Use loose equality: matches JS `==`, so `undefined == null` is true.
      // eslint-disable-next-line eqeqeq
      const eq = left == right;
      return op.v === "==" ? eq : !eq;
    }
    return left;
  }
  parseRel(): unknown {
    let left = this.parseUnary();
    const op = this.peek();
    if (op?.t === "op" && (op.v === "<" || op.v === "<=" || op.v === ">" || op.v === ">=")) {
      this.eat();
      const right = this.parseUnary();
      const a = Number(left);
      const b = Number(right);
      switch (op.v) {
        case "<":
          return a < b;
        case "<=":
          return a <= b;
        case ">":
          return a > b;
        case ">=":
          return a >= b;
      }
    }
    return left;
  }
  parseUnary(): unknown {
    const t = this.peek();
    if (t?.t === "op" && t.v === "!") {
      this.eat();
      return !this.parseUnary();
    }
    return this.parsePrimary();
  }
  parsePrimary(): unknown {
    const t = this.eat();
    if (t.t === "num") return t.v;
    if (t.t === "str") return t.v;
    if (t.t === "true") return true;
    if (t.t === "false") return false;
    if (t.t === "null") return null;
    if (t.t === "ident") return resolvePath(this.ctx, t.v);
    if (t.t === "lparen") {
      const v = this.parseExpr();
      const r = this.eat();
      if (r.t !== "rparen") throw new Error("Expected )");
      return v;
    }
    throw new Error(`Unexpected token`);
  }
}

function resolvePath(ctx: FlowContext, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = parts[0] === "input" ? ctx.input : parts[0] === "output" ? ctx.output : undefined;
  for (let i = 1; i < parts.length; i++) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  return cur;
}

// ---------------- Job-handler integration ----------------

export const FLOW_ADVANCE_JOB_KIND = "flow.run.advance";

export type FlowAdvanceJob = {
  runId: string;
};

export type FlowKindHelpers = {
  /** `node.kind` strings supported by the engine. */
  kinds: readonly FlowNodeKind[];
};

export const flowKindHelpers: FlowKindHelpers = {
  kinds: ["START", "TASK", "CONDITION", "APPROVAL", "WEBHOOK_CALL", "DELAY", "END"],
};
