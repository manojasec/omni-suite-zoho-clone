import "server-only";
import { prisma } from "@/lib/prisma";
import { getPlan, type PlanFeatureKey, type PlanLimitKey } from "./plans";

export class PlanLimitError extends Error {
  constructor(
    public limit: PlanLimitKey | PlanFeatureKey,
    public reason: "limit" | "feature",
    public currentPlan: string,
    message: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

const COUNTERS: Record<PlanLimitKey, (workspaceId: string) => Promise<number>> = {
  users: (id) => prisma.membership.count({ where: { workspaceId: id, status: "ACTIVE" } }),
  contacts: (id) => prisma.contact.count({ where: { workspaceId: id } }),
  deals: (id) => prisma.deal.count({ where: { workspaceId: id } }),
  invoices: (id) => prisma.invoice.count({ where: { workspaceId: id } }),
  projects: (id) => prisma.project.count({ where: { workspaceId: id } }),
  tickets: (id) => prisma.ticket.count({ where: { workspaceId: id } }),
  campaigns: (id) => prisma.campaign.count({ where: { workspaceId: id } }),
  forms: (id) => prisma.form.count({ where: { workspaceId: id } }),
  // Storage tracked elsewhere; for now, always 0.
  storageMb: async () => 0,
};

/**
 * Throws PlanLimitError when adding a new resource would exceed the workspace's plan limit.
 * Pass `delta = 1` for "creating one new item".
 */
export async function assertWithinPlanLimit(
  workspaceId: string,
  key: PlanLimitKey,
  delta = 1,
): Promise<void> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  if (!ws) throw new Error("Workspace not found");
  const plan = getPlan(ws.plan);
  const cap = plan.limits[key];
  if (cap === -1) return;
  const current = await COUNTERS[key](workspaceId);
  if (current + delta > cap) {
    throw new PlanLimitError(
      key,
      "limit",
      plan.key,
      `Plan limit reached: ${key} (${current}/${cap}). Upgrade your plan to add more.`,
    );
  }
}

/**
 * Throws PlanLimitError when the workspace's plan does not include `feature`.
 */
export async function assertPlanFeature(
  workspaceId: string,
  feature: PlanFeatureKey,
): Promise<void> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  if (!ws) throw new Error("Workspace not found");
  const plan = getPlan(ws.plan);
  if (!plan.features[feature]) {
    throw new PlanLimitError(
      feature,
      "feature",
      plan.key,
      `Feature "${feature}" is not available on the ${plan.label} plan. Upgrade to unlock it.`,
    );
  }
}

export async function getWorkspacePlan(workspaceId: string) {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      plan: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!ws) throw new Error("Workspace not found");
  return { ...ws, definition: getPlan(ws.plan) };
}
