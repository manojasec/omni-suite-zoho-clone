/**
 * Multi-level approval routing engine.
 *
 * The existing `ApprovalPolicy.approverIds` column is a `Text` field. To stay
 * compatible with the data already produced by the simple single-level UI,
 * we encode multi-level routing inside the same string:
 *
 *   single level (default):  "alice,bob,carol"
 *   multi level:             "alice;bob,carol;david"
 *                            ↑      ↑↑↑↑↑↑↑↑↑↑    ↑
 *                            L1     L2 (any of)   L3
 *
 * Within a level, the policy is satisfied when **any** approver decides
 * APPROVED (or the optional quorum count is reached). One REJECT at any
 * level ends the request.
 *
 * Each level may carry a `quorum` annotation `bob,carol#2` meaning "two of
 * these approvers must approve". Default quorum is 1.
 */

export type ApprovalLevel = {
  /** Approver user-ids able to decide for this level. */
  approverIds: string[];
  /** Number of distinct APPROVED decisions required from this level. */
  quorum: number;
};

export type DecisionLog = {
  approverId: string;
  decision: "APPROVED" | "REJECTED";
  /** Index of the level the decision targeted (0-based). */
  level: number;
};

export type RoutingState = {
  /** All levels in order. */
  levels: ApprovalLevel[];
  /** All decisions so far (oldest → newest). */
  decisions: DecisionLog[];
};

export type RoutingProgress = {
  /** Index of the level currently awaiting decisions, or `null` when complete. */
  currentLevel: number | null;
  /** Final status when complete; PENDING while in progress. */
  status: "PENDING" | "APPROVED" | "REJECTED";
  /** Approver-ids still allowed to decide at the current level. */
  pendingApprovers: string[];
  /** Number of approvals still required at the current level. */
  approvalsRemaining: number;
};

/** Parse the encoded approverIds string. Returns at least one level. */
export function parseLevels(encoded: string): ApprovalLevel[] {
  const segments = encoded
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length === 0) return [];
  return segments.map((seg) => {
    const [approversStr, quorumStr] = seg.split("#");
    const approverIds = approversStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const quorum = Math.max(1, Math.min(approverIds.length, Number(quorumStr) || 1));
    return { approverIds, quorum };
  });
}

/** Re-encode levels back into the storage format. */
export function encodeLevels(levels: ApprovalLevel[]): string {
  return levels
    .map((lvl) => {
      const ids = lvl.approverIds.join(",");
      return lvl.quorum > 1 ? `${ids}#${lvl.quorum}` : ids;
    })
    .join(";");
}

/**
 * Compute the routing progress given the level definition + decision history.
 * Pure: derives state entirely from `state`.
 */
export function progressOf(state: RoutingState): RoutingProgress {
  const { levels, decisions } = state;
  if (levels.length === 0) {
    return {
      currentLevel: null,
      status: "APPROVED",
      pendingApprovers: [],
      approvalsRemaining: 0,
    };
  }

  // Any rejection ends the request immediately.
  const reject = decisions.find((d) => d.decision === "REJECTED");
  if (reject) {
    return {
      currentLevel: null,
      status: "REJECTED",
      pendingApprovers: [],
      approvalsRemaining: 0,
    };
  }

  for (let i = 0; i < levels.length; i++) {
    const lvl = levels[i];
    const approvalsAtLevel = decisions.filter(
      (d) => d.level === i && d.decision === "APPROVED",
    );
    const distinctApprovers = new Set(approvalsAtLevel.map((d) => d.approverId));
    if (distinctApprovers.size >= lvl.quorum) continue; // level cleared
    return {
      currentLevel: i,
      status: "PENDING",
      pendingApprovers: lvl.approverIds.filter((id) => !distinctApprovers.has(id)),
      approvalsRemaining: lvl.quorum - distinctApprovers.size,
    };
  }
  // All levels satisfied.
  return {
    currentLevel: null,
    status: "APPROVED",
    pendingApprovers: [],
    approvalsRemaining: 0,
  };
}

export type DecisionResult = {
  /** New decision-log to persist. Caller appends to history. */
  decision: DecisionLog;
  /** Routing state after the decision is applied. */
  next: RoutingProgress;
  /** Convenience: same as `next.status !== "PENDING"`. */
  complete: boolean;
};

/**
 * Apply a single decision. Throws when the approver is not eligible at the
 * current level, or when the request is already complete, or when the
 * approver has already decided at this level.
 */
export function applyDecision(
  state: RoutingState,
  approverId: string,
  decision: "APPROVED" | "REJECTED",
): DecisionResult {
  const progress = progressOf(state);
  if (progress.status !== "PENDING") {
    throw new Error("Approval request is already complete");
  }
  if (progress.currentLevel === null) {
    throw new Error("No active level");
  }
  const level = state.levels[progress.currentLevel];
  if (!level.approverIds.includes(approverId)) {
    throw new Error("User is not an approver at this level");
  }
  const already = state.decisions.find(
    (d) => d.approverId === approverId && d.level === progress.currentLevel,
  );
  if (already) {
    throw new Error("Approver has already decided at this level");
  }
  const newDec: DecisionLog = {
    approverId,
    decision,
    level: progress.currentLevel,
  };
  const next = progressOf({
    ...state,
    decisions: [...state.decisions, newDec],
  });
  return {
    decision: newDec,
    next,
    complete: next.status !== "PENDING",
  };
}

/** Convenience: who can act on this request right now? */
export function pendingApproversFor(state: RoutingState): string[] {
  return progressOf(state).pendingApprovers;
}
