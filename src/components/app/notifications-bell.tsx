import Link from "next/link";
import { Bell } from "lucide-react";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function NotificationsBell() {
  const ctx = await requireSession();
  const unread = await prisma.notification.count({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId, readAt: null },
  });

  return (
    <Link
      href="/app/notifications"
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-accent"
      aria-label={`Notifications (${unread} unread)`}
    >
      <Bell className="h-4 w-4" />
      {unread > 0 ? (
        <span className="absolute -right-1 -top-1 inline-flex min-w-[1rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}
