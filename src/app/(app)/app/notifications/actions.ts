"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";

export async function markNotificationReadAction(id: string) {
  const ctx = await requireSession();
  await prisma.notification.updateMany({
    where: { id, workspaceId: ctx.workspaceId, userId: ctx.userId },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}

export async function markAllNotificationsReadAction() {
  const ctx = await requireSession();
  await prisma.notification.updateMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
}
