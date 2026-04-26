import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TEAM_CHANNEL_KIND_LABELS } from "@/modules/team-channels/schemas";
import {
  postMessageAction,
  deleteMessageAction,
  joinChannelAction,
  leaveChannelAction,
  archiveChannelAction,
  deleteChannelAction,
  inviteMemberAction,
  removeMemberAction,
  markChannelReadAction,
} from "../actions";

export const dynamic = "force-dynamic";

function fmtTime(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "teamChannel", "view");
  const { id } = await params;

  const channel = await prisma.teamChannel.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      _count: { select: { messages: true } },
    },
  });
  if (!channel) notFound();

  const myMember = channel.members.find((m) => m.userId === ctx.userId);
  const isPrivate = channel.kind === "PRIVATE" || channel.kind === "DIRECT";
  if (isPrivate && !myMember) notFound();

  const messages = await prisma.teamMessage.findMany({
    where: { channelId: id },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  // Fire-and-forget mark-as-read for the viewer.
  if (myMember) {
    await prisma.teamChannelMember.update({
      where: { channelId_userId: { channelId: id, userId: ctx.userId } },
      data: { lastReadAt: new Date() },
    });
  }

  const canEdit = can(ctx.role, "teamChannel", "edit");
  const canDelete = can(ctx.role, "teamChannel", "delete");
  const canPost = can(ctx.role, "teamMessage", "create");

  // Members not yet in the channel — for invite UI.
  const memberIdSet = new Set(channel.members.map((m) => m.userId));
  const workspaceMembers = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { name: "asc" } },
    take: 200,
  });
  const inviteCandidates = workspaceMembers
    .map((m) => m.user)
    .filter((u) => u && !memberIdSet.has(u.id));

  // Server action for "Mark all read" button (kept simple).
  async function markRead() {
    "use server";
    await markChannelReadAction(id);
    redirect(`/app/channels/${id}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight"># {channel.name}</h1>
            <p className="text-sm text-muted-foreground">
              {TEAM_CHANNEL_KIND_LABELS[channel.kind]} · {channel.members.length} members · {channel._count.messages} messages
              {channel.archived ? " · ARCHIVED" : ""}
            </p>
            {channel.topic ? <p className="mt-1 text-sm">{channel.topic}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {!myMember && !isPrivate ? (
              <form action={joinChannelAction.bind(null, channel.id)}>
                <Button type="submit" size="sm">Join</Button>
              </form>
            ) : null}
            {myMember ? (
              <form action={leaveChannelAction.bind(null, channel.id)}>
                <Button type="submit" variant="outline" size="sm">Leave</Button>
              </form>
            ) : null}
            {canEdit ? (
              <form action={archiveChannelAction.bind(null, channel.id)}>
                <Button type="submit" variant="outline" size="sm">
                  {channel.archived ? "Unarchive" : "Archive"}
                </Button>
              </form>
            ) : null}
            {canDelete ? (
              <form action={deleteChannelAction.bind(null, channel.id)}>
                <Button type="submit" variant="outline" size="sm" className="text-red-600">Delete</Button>
              </form>
            ) : null}
          </div>
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto divide-y">
            {messages.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No messages yet — start the conversation.
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="px-4 py-3 hover:bg-muted/30 group">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold">{m.author?.name ?? m.author?.email ?? "User"}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{fmtTime(m.createdAt)}</span>
                    </div>
                    {(m.authorId === ctx.userId || canDelete) ? (
                      <form action={deleteMessageAction.bind(null, channel.id, m.id)} className="opacity-0 group-hover:opacity-100">
                        <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">Delete</button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{m.body}</p>
                </div>
              ))
            )}
          </div>
          {canPost && myMember && !channel.archived ? (
            <form action={postMessageAction.bind(null, channel.id)} className="border-t bg-muted/30 p-3 flex gap-2">
              <Textarea
                name="body"
                rows={2}
                maxLength={8000}
                required
                placeholder={`Message # ${channel.name}`}
                className="flex-1"
              />
              <div className="flex flex-col justify-end gap-1">
                <Button type="submit" size="sm">Send</Button>
              </div>
            </form>
          ) : null}
          {myMember ? (
            <form action={markRead} className="border-t bg-muted/20 px-3 py-2 text-right">
              <button type="submit" className="text-xs text-muted-foreground hover:text-foreground">Mark as read</button>
            </form>
          ) : null}
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3">Members</h2>
          <ul className="space-y-1">
            {channel.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                <span>{m.user?.name ?? m.user?.email ?? "—"}</span>
                {canEdit && m.userId !== ctx.userId ? (
                  <form action={removeMemberAction.bind(null, channel.id, m.userId)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">×</button>
                  </form>
                ) : null}
              </li>
            ))}
            {channel.members.length === 0 ? (
              <li className="text-xs text-muted-foreground">No members yet.</li>
            ) : null}
          </ul>
          {canEdit && inviteCandidates.length > 0 ? (
            <form action={inviteMemberAction.bind(null, channel.id)} className="mt-4 space-y-2 border-t pt-3">
              <Label htmlFor="userId">Invite member</Label>
              <Select id="userId" name="userId" defaultValue="">
                <option value="" disabled>Select a teammate…</option>
                {inviteCandidates.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </Select>
              <Button type="submit" size="sm" variant="outline" className="w-full">Add to channel</Button>
            </form>
          ) : null}
        </Card>

        <Card className="p-4 text-xs text-muted-foreground">
          <p>
            <Link href="/app/channels" className="hover:underline">← All channels</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
