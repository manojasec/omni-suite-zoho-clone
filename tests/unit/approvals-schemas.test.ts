import { describe, expect, it } from "vitest";
import {
  APPROVAL_STATUSES,
  approvalPolicySchema,
  approvalRequestSchema,
  approvalStatusColor,
  decodeApprovers,
  encodeApprovers,
  formatApprovalStatus,
  isApprover,
  policyApplies,
} from "@/modules/approvals/schemas";

describe("approvals/schemas", () => {
  it("exposes the four canonical statuses", () => {
    expect(APPROVAL_STATUSES).toEqual([
      "PENDING",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
    ]);
  });

  it("formats statuses to title case", () => {
    expect(formatApprovalStatus("PENDING")).toBe("Pending");
    expect(formatApprovalStatus("REJECTED")).toBe("Rejected");
  });

  it("returns distinct color classes per status", () => {
    const colors = APPROVAL_STATUSES.map(approvalStatusColor);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("policyApplies: null threshold always applies", () => {
    expect(policyApplies({ threshold: null, amount: 0 })).toBe(true);
    expect(policyApplies({ threshold: null, amount: null })).toBe(true);
  });

  it("policyApplies: requires amount when threshold is set", () => {
    expect(policyApplies({ threshold: 100, amount: null })).toBe(false);
    expect(policyApplies({ threshold: 100, amount: 50 })).toBe(false);
    expect(policyApplies({ threshold: 100, amount: 100 })).toBe(true);
    expect(policyApplies({ threshold: 100, amount: 250 })).toBe(true);
  });

  it("isApprover returns true only for listed userIds", () => {
    expect(isApprover(["a", "b"], "a")).toBe(true);
    expect(isApprover(["a", "b"], "c")).toBe(false);
  });

  it("encode/decode approvers round-trips and dedupes", () => {
    expect(encodeApprovers(["a", "b", "a"])).toBe("a,b");
    expect(decodeApprovers("a, b , c")).toEqual(["a", "b", "c"]);
    expect(decodeApprovers("")).toEqual([]);
  });

  it("validates a minimum policy payload", () => {
    const r = approvalPolicySchema.safeParse({
      name: "Manager approval",
      resource: "expense",
      threshold: "100",
      approverIds: ["user_1"],
      isActive: true,
    });
    expect(r.success).toBe(true);
  });

  it("policy schema requires at least one approver", () => {
    const r = approvalPolicySchema.safeParse({
      name: "x",
      resource: "expense",
      threshold: "",
      approverIds: [],
      isActive: true,
    });
    expect(r.success).toBe(false);
  });

  it("policy schema rejects unknown resource", () => {
    const r = approvalPolicySchema.safeParse({
      name: "x",
      resource: "wat",
      approverIds: ["u"],
      isActive: true,
    });
    expect(r.success).toBe(false);
  });

  it("validates a request payload with optional amount", () => {
    const r = approvalRequestSchema.safeParse({
      resource: "expense",
      resourceId: "exp_1",
      amount: "150.50",
      reason: "Conference travel",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe(150.5);
      expect(r.data.resourceId).toBe("exp_1");
    }
  });

  it("request schema treats blank amount as undefined", () => {
    const r = approvalRequestSchema.safeParse({
      resource: "expense",
      resourceId: "exp_1",
      amount: "",
      reason: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBeUndefined();
  });

  it("request schema rejects empty resourceId", () => {
    const r = approvalRequestSchema.safeParse({
      resource: "expense",
      resourceId: "",
    });
    expect(r.success).toBe(false);
  });
});
