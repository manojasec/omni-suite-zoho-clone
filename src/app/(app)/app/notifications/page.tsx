import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const ctx = await requireSession();
  const items = await prisma.notification.findMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread} unread of {items.length}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <Button type="submit" variant="outline" size="sm">Mark all read</Button>
          </form>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const mark = markNotificationReadAction.bind(null, n.id);
                return (
                  <li key={n.id} className={`flex items-start gap-3 p-4 ${n.readAt ? "opacity-70" : "bg-accent/30"}`}>
                    <span
                      aria-hidden
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-muted-foreground/30" : "bg-primary"}`}
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        <span className="text-[10px] uppercase text-muted-foreground">{n.type}</span>
                      </div>
                      {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                      <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
                        <time>{new Date(n.createdAt).toLocaleString()}</time>
                        {n.href ? (
                          <Link href={n.href} className="text-primary hover:underline">Open →</Link>
                        ) : null}
                        {!n.readAt ? (
                          <form action={mark}>
                            <button type="submit" className="hover:underline">Mark read</button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
