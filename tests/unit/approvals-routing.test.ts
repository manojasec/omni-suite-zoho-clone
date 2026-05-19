import { describe, it, expect } from "vitest";
import {
  applyDecision,
  encodeLevels,
  parseLevels,
  pendingApproversFor,
  progressOf,
} from "@/modules/approvals/routing";

describe("approval routing — parseLevels / encodeLevels", () => {
  it("parses single-level (legacy) format", () => {
    const levels = parseLevels("alice,bob,carol");
    expect(levels).toHaveLength(1);
    expect(levels[0]?.approverIds).toEqual(["alice", "bob", "carol"]);
    expect(levels[0]?.quorum).toBe(1);
  });

  it("parses multi-level with semicolons", () => {
    const levels = parseLevels("alice;bob,carol;david");
    expect(levels.map((l) => l.approverIds)).toEqual([
      ["alice"],
      ["bob", "carol"],
      ["david"],
    ]);
  });

  it("parses per-level quorum annotation", () => {
    const levels = parseLevels("a,b,c#2;d");
    expect(levels[0]?.quorum).toBe(2);
    expect(levels[1]?.quorum).toBe(1);
  });

  it("clamps invalid quorums into the valid range", () => {
    const levels = parseLevels("a,b#9");
    expect(levels[0]?.quorum).toBe(2);
  });

  it("encodeLevels round-trips multi-level data", () => {
    const enc = encodeLevels([
      { approverIds: ["a", "b", "c"], quorum: 2 },
      { approverIds: ["d"], quorum: 1 },
    ]);
    expect(enc).toBe("a,b,c#2;d");
    expect(parseLevels(enc)).toEqual([
      { approverIds: ["a", "b", "c"], quorum: 2 },
      { approverIds: ["d"], quorum: 1 },
    ]);
  });
});

describe("approval routing — progressOf", () => {
  it("returns level 0 with all approvers pending initially", () => {
    const state = {
      levels: parseLevels("alice;bob,carol"),
      decisions: [],
    };
    const p = progressOf(state);
    expect(p.currentLevel).toBe(0);
    expect(p.status).toBe("PENDING");
    expect(p.pendingApprovers).toEqual(["alice"]);
  });

  it("advances to next level after current is satisfied", () => {
    const state = {
      levels: parseLevels("alice;bob,carol"),
      decisions: [{ approverId: "alice", decision: "APPROVED" as const, level: 0 }],
    };
    const p = progressOf(state);
    expect(p.currentLevel).toBe(1);
    expect(p.pendingApprovers).toEqual(["bob", "carol"]);
  });

  it("reports APPROVED when every level cleared", () => {
    const state = {
      levels: parseLevels("alice;bob"),
      decisions: [
        { approverId: "alice", decision: "APPROVED" as const, level: 0 },
        { approverId: "bob", decision: "APPROVED" as const, level: 1 },
      ],
    };
    expect(progressOf(state).status).toBe("APPROVED");
  });

  it("reports REJECTED when any level rejects", () => {
    const state = {
      levels: parseLevels("alice;bob"),
      decisions: [{ approverId: "alice", decision: "REJECTED" as const, level: 0 }],
    };
    expect(progressOf(state).status).toBe("REJECTED");
  });

  it("requires quorum count of distinct approvers", () => {
    const state = {
      levels: parseLevels("a,b,c#2"),
      decisions: [{ approverId: "a", decision: "APPROVED" as const, level: 0 }],
    };
    expect(progressOf(state).status).toBe("PENDING");
    expect(progressOf(state).approvalsRemaining).toBe(1);
  });
});

describe("approval routing — applyDecision", () => {
  const baseLevels = parseLevels("alice;bob,carol#2");

  it("rejects when approver not at the active level", () => {
    expect(() =>
      applyDecision({ levels: baseLevels, decisions: [] }, "bob", "APPROVED"),
    ).toThrow(/not an approver/);
  });

  it("rejects double-decision by same approver at same level", () => {
    const decided = applyDecision(
      { levels: baseLevels, decisions: [] },
      "alice",
      "APPROVED",
    );
    const stateAfter = {
      levels: baseLevels,
      decisions: [decided.decision],
    };
    expect(() => applyDecision(stateAfter, "alice", "REJECTED")).toThrow(
      /already complete|already decided|not an approver/,
    );
  });

  it("returns complete=true once final approval lands", () => {
    let state = { levels: baseLevels, decisions: [] as ReturnType<typeof applyDecision>["decision"][] };
    let res = applyDecision(state, "alice", "APPROVED");
    state = { ...state, decisions: [...state.decisions, res.decision] };
    res = applyDecision(state, "bob", "APPROVED");
    state = { ...state, decisions: [...state.decisions, res.decision] };
    expect(res.complete).toBe(false); // need 2 of {b,c}
    res = applyDecision(state, "carol", "APPROVED");
    expect(res.complete).toBe(true);
    expect(res.next.status).toBe("APPROVED");
  });

  it("pendingApproversFor reflects the active level", () => {
    const state = {
      levels: baseLevels,
      decisions: [{ approverId: "alice", decision: "APPROVED" as const, level: 0 }],
    };
    expect(pendingApproversFor(state)).toEqual(["bob", "carol"]);
  });
});
