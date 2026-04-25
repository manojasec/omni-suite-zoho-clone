import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the prisma client used inside limits.ts so we can drive the counters.
vi.mock("@/lib/prisma", () => {
  return {
    prisma: {
      workspace: { findUnique: vi.fn() },
      contact: { count: vi.fn() },
      deal: { count: vi.fn() },
      invoice: { count: vi.fn() },
      project: { count: vi.fn() },
      ticket: { count: vi.fn() },
      campaign: { count: vi.fn() },
      form: { count: vi.fn() },
      membership: { count: vi.fn() },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { assertWithinPlanLimit, assertPlanFeature, PlanLimitError } from "@/modules/billing/limits";

const findUnique = prisma.workspace.findUnique as unknown as ReturnType<typeof vi.fn>;
const contactCount = prisma.contact.count as unknown as ReturnType<typeof vi.fn>;

describe("assertWithinPlanLimit", () => {
  beforeEach(() => {
    findUnique.mockReset();
    contactCount.mockReset();
  });

  it("allows when under the limit", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    contactCount.mockResolvedValue(10);
    await expect(assertWithinPlanLimit("ws", "contacts")).resolves.toBeUndefined();
  });

  it("throws PlanLimitError when limit is hit", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    contactCount.mockResolvedValue(500); // FREE cap is 500
    await expect(assertWithinPlanLimit("ws", "contacts")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("never throws for ENTERPRISE plan (unlimited)", async () => {
    findUnique.mockResolvedValue({ plan: "ENTERPRISE" });
    contactCount.mockResolvedValue(1_000_000);
    await expect(assertWithinPlanLimit("ws", "contacts")).resolves.toBeUndefined();
  });
});

describe("assertPlanFeature", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("denies advancedReports on FREE", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    await expect(assertPlanFeature("ws", "advancedReports")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("allows advancedReports on PROFESSIONAL", async () => {
    findUnique.mockResolvedValue({ plan: "PROFESSIONAL" });
    await expect(assertPlanFeature("ws", "advancedReports")).resolves.toBeUndefined();
  });

  it("allows SSO only on ENTERPRISE", async () => {
    findUnique.mockResolvedValue({ plan: "PROFESSIONAL" });
    await expect(assertPlanFeature("ws", "sso")).rejects.toBeInstanceOf(PlanLimitError);
    findUnique.mockResolvedValue({ plan: "ENTERPRISE" });
    await expect(assertPlanFeature("ws", "sso")).resolves.toBeUndefined();
  });
});
