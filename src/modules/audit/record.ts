import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Reusable helper for writing audit events. Pulls IP / UA from the current
 * request's headers when called inside a server action / route handler.
 *
 * Usage:
 *   await recordAuditEvent({
 *     workspaceId, actorId, action: "update", resource: "deal",
 *     resourceId: deal.id, diff: { from, to },
 *   });
 */
export async function recordAuditEvent(input: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  diff?: unknown;
}) {
  let ip: string | undefined;
  let userAgent: string | undefined;
  try {
    const h = await headers();
    ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? undefined;
    userAgent = h.get("user-agent") ?? undefined;
  } catch {
    // headers() is only available in request-scoped contexts; safe to ignore.
  }

  return prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      diff: (input.diff ?? undefined) as object | undefined,
      ip,
      userAgent,
    },
  });
}
