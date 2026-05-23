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
import { assertWithinPlanLimit, PlanLimitError } from "@/modules/billing/limits";
import type { PlanLimitKey } from "@/modules/billing/plans";

const findUnique = prisma.workspace.findUnique as unknown as ReturnType<typeof vi.fn>;

// Map each resource key to its Prisma mock counter.
const counters: Record<PlanLimitKey, ReturnType<typeof vi.fn>> = {
  contacts: prisma.contact.count as unknown as ReturnType<typeof vi.fn>,
  deals: prisma.deal.count as unknown as ReturnType<typeof vi.fn>,
  invoices: prisma.invoice.count as unknown as ReturnType<typeof vi.fn>,
  projects: prisma.project.count as unknown as ReturnType<typeof vi.fn>,
  tickets: prisma.ticket.count as unknown as ReturnType<typeof vi.fn>,
  campaigns: prisma.campaign.count as unknown as ReturnType<typeof vi.fn>,
  forms: prisma.form.count as unknown as ReturnType<typeof vi.fn>,
  users: prisma.membership.count as unknown as ReturnType<typeof vi.fn>,
  storageMb: vi.fn().mockResolvedValue(0),
};

// FREE plan caps taken from plans.ts
const FREE_CAPS: Partial<Record<PlanLimitKey, number>> = {
  contacts: 500,
  deals: 100,
  invoices: 25,
  projects: 3,
  tickets: 100,
  campaigns: 1,
  forms: 2,
  users: 3,
};

describe("plan limit enforcement — all resource types", () => {
  beforeEach(() => {
    findUnique.mockReset();
    Object.values(counters).forEach((c) => c.mockReset());
  });

  const resources = Object.keys(FREE_CAPS) as PlanLimitKey[];

  for (const resource of resources) {
    const cap = FREE_CAPS[resource]!;

    it(`allows ${resource} when under the FREE limit (${cap})`, async () => {
      findUnique.mockResolvedValue({ plan: "FREE" });
      counters[resource].mockResolvedValue(cap - 1);
      await expect(assertWithinPlanLimit("ws", resource)).resolves.toBeUndefined();
    });

    it(`blocks ${resource} when FREE limit (${cap}) is reached`, async () => {
      findUnique.mockResolvedValue({ plan: "FREE" });
      counters[resource].mockResolvedValue(cap);
      await expect(assertWithinPlanLimit("ws", resource)).rejects.toBeInstanceOf(PlanLimitError);
    });

    it(`never blocks ${resource} on ENTERPRISE plan`, async () => {
      findUnique.mockResolvedValue({ plan: "ENTERPRISE" });
      counters[resource].mockResolvedValue(1_000_000);
      await expect(assertWithinPlanLimit("ws", resource)).resolves.toBeUndefined();
    });
  }

  it("PlanLimitError exposes the limit key and plan name", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    counters.deals.mockResolvedValue(100);
    try {
      await assertWithinPlanLimit("ws", "deals");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PlanLimitError);
      const err = e as PlanLimitError;
      expect(err.limit).toBe("deals");
      expect(err.currentPlan).toBe("FREE");
      expect(err.reason).toBe("limit");
      expect(err.message).toMatch(/upgrade/i);
    }
  });

  it("delta parameter is respected", async () => {
    findUnique.mockResolvedValue({ plan: "FREE" });
    // projects cap is 3; current = 2; delta = 1 → allowed
    counters.projects.mockResolvedValue(2);
    await expect(assertWithinPlanLimit("ws", "projects", 1)).resolves.toBeUndefined();
    // current = 3; delta = 1 → blocked
    counters.projects.mockResolvedValue(3);
    await expect(assertWithinPlanLimit("ws", "projects", 1)).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("STARTER plan allows more than FREE", async () => {
    findUnique.mockResolvedValue({ plan: "STARTER" });
    // STARTER: invoices = 500; FREE: invoices = 25
    counters.invoices.mockResolvedValue(200);
    await expect(assertWithinPlanLimit("ws", "invoices")).resolves.toBeUndefined();
  });
});
