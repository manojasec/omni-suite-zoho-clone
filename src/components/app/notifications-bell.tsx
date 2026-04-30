import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NotificationsBellClient } from "./notifications-bell-client";

export async function NotificationsBell() {
  const ctx = await requireSession();
  const unread = await prisma.notification.count({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId, readAt: null },
  });

  return <NotificationsBellClient initialUnread={unread} />;
}
