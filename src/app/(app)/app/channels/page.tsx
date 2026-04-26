import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TEAM_CHANNEL_KIND_LABELS } from "@/modules/team-channels/schemas";

export const dynamic = "force-dynamic";

export default async function ChannelsListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "view");

  const channels = await prisma.teamChannel.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      archived: false,
      OR: [
        { kind: "PUBLIC" },
        { members: { some: { userId: ctx.userId } } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true, messages: true } },
      members: { where: { userId: ctx.userId }, select: { lastReadAt: true } },
    },
    take: 200,
  });

  // Compute unread counts in a single batch.
  const unreadCounts = new Map<string, number>();
  await Promise.all(
    channels.map(async (c) => {
      const lastRead = c.members[0]?.lastReadAt;
      if (!lastRead) return;
      const count = await prisma.teamMessage.count({
        where: { channelId: c.id, createdAt: { gt: lastRead }, authorId: { not: ctx.userId } },
      });
      if (count > 0) unreadCounts.set(c.id, count);
    }),
  );

  const canCreate = can(ctx.role, "teamChannel", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
        {canCreate ? <Link href="/app/channels/new"><Button>New channel</Button></Link> : null}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Channel</th>
              <th className="px-3 py-2 text-left">Visibility</th>
              <th className="px-3 py-2 text-right">Members</th>
              <th className="px-3 py-2 text-right">Messages</th>
              <th className="px-3 py-2 text-right">Unread</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const unread = unreadCounts.get(c.id) ?? 0;
              return (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link href={`/app/channels/${c.id}`} className="font-medium hover:underline">
                      # {c.name}
                    </Link>
                    {c.topic ? <p className="text-xs text-muted-foreground">{c.topic}</p> : null}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{TEAM_CHANNEL_KIND_LABELS[c.kind]}</td>
                  <td className="px-3 py-2 text-right">{c._count.members}</td>
                  <td className="px-3 py-2 text-right">{c._count.messages}</td>
                  <td className="px-3 py-2 text-right">
                    {unread > 0 ? (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{unread}</span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
            {channels.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No channels yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
