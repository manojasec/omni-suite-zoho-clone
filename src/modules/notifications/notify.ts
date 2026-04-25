import "server-only";
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_TYPES = [
  "task.assigned",
  "ticket.assigned",
  "deal.updated",
  "invoice.paid",
  "invite.accepted",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Persist a notification for a single user.
 */
export async function notifyUser(input: {
  workspaceId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  meta?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      meta: input.meta as object | undefined,
    },
  });
}

/**
 * Fan-out notification to many users in one batch insert.
 */
export async function notifyUsers(input: {
  workspaceId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  href?: string;
  meta?: Record<string, unknown>;
}) {
  if (input.userIds.length === 0) return { count: 0 };
  return prisma.notification.createMany({
    data: input.userIds.map((userId) => ({
      workspaceId: input.workspaceId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
      meta: input.meta as object | undefined,
    })),
  });
}
