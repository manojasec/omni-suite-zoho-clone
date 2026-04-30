import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CHANNEL_KIND_LABELS } from "@/modules/cliq/schemas";
import {
  deleteChannelAction,
  joinChannelAction,
  postMessageAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "view");
  const canDelete = can(ctx.role, "channel", "delete");

  const channel = await prisma.channel.findFirst({
    where: {
      id,
      workspaceId: ctx.workspaceId,
      OR: [
        { kind: "PUBLIC" },
        { members: { some: { userId: ctx.userId } } },
      ],
    },
    include: {
      members: true,
    },
  });
  if (!channel) notFound();

  const messages = await prisma.channelMessage.findMany({
    where: { channelId: id, parentId: null },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  const authorIds = Array.from(new Set(messages.map((m) => m.authorId)));
  const authors = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const authorMap = new Map(authors.map((u) => [u.id, u]));

  const isMember = channel.members.some((m) => m.userId === ctx.userId);
  const canPost = isMember && can(ctx.role, "channel", "edit");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            #{channel.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            {CHANNEL_KIND_LABELS[channel.kind]} · {channel.members.length}{" "}
            members
            {channel.topic ? ` · ${channel.topic}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {!isMember && channel.kind === "PUBLIC" ? (
            <form action={joinChannelAction.bind(null, channel.id)}>
              <Button type="submit" size="sm">
                Join
              </Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteChannelAction.bind(null, channel.id)}>
              <Button type="submit" variant="ghost">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card className="space-y-2 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet — say hello!
          </p>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const author = authorMap.get(m.authorId);
              return (
                <li key={m.id} className="rounded border px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {author?.name || author?.email || "Unknown"} ·{" "}
                    {m.createdAt.toISOString().slice(11, 19)}
                  </div>
                  <div className="whitespace-pre-wrap">{m.body}</div>
                </li>
              );
            })}
          </ul>
        )}
        {canPost ? (
          <form
            action={postMessageAction.bind(null, channel.id)}
            className="flex items-end gap-2 pt-2"
          >
            <div className="flex-1">
              <Input
                name="body"
                placeholder={`Message #${channel.name}`}
                required
                maxLength={4000}
              />
            </div>
            <Button type="submit" size="sm">
              Send
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
