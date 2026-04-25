import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { AutoRefresh } from "@/components/app/auto-refresh";
import { CHAT_STATUSES, canChatTransition } from "@/modules/chat/schemas";
import {
  assignChatAction,
  deleteChatAction,
  sendAgentMessageAction,
  updateChatStatusAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ASSIGNED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CLOSED: "bg-muted text-muted-foreground",
};

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;

  const conv = await prisma.chatConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { agent: { select: { name: true, email: true } } },
      },
    },
  });
  if (!conv) notFound();

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { email: "asc" } },
  });

  const canSend = can(ctx.role, "chatMessage", "send");
  const canAssign = can(ctx.role, "chatConversation", "assign");
  const canEdit = can(ctx.role, "chatConversation", "edit");
  const canDelete = can(ctx.role, "chatConversation", "delete");

  const allowedStatuses = CHAT_STATUSES.filter((s) => canChatTransition(conv.status, s));

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={4000} />

      <div>
        <Link href="/app/chat" className="text-xs text-muted-foreground hover:underline">
          ← Inbox
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {conv.visitorName ?? conv.visitorEmail ?? "Anonymous visitor"}
          </h1>
          <span className={`rounded px-2 py-0.5 text-xs ${statusColor[conv.status]}`}>{conv.status}</span>
        </div>
        {conv.visitorEmail && conv.visitorName ? (
          <p className="text-sm text-muted-foreground">{conv.visitorEmail}</p>
        ) : null}
        {conv.pageUrl ? (
          <p className="text-xs text-muted-foreground">From: {conv.pageUrl}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 md:col-span-2 space-y-3">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {conv.messages.map((m) => {
              const isAgent = m.sender === "AGENT";
              const isSystem = m.sender === "SYSTEM";
              return (
                <div
                  key={m.id}
                  className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      isSystem
                        ? "bg-muted text-muted-foreground italic"
                        : isAgent
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-0.5">
                      {isAgent
                        ? (m.agent?.name ?? m.agent?.email ?? "Agent")
                        : isSystem
                          ? "System"
                          : (conv.visitorName ?? "Visitor")}
                      {" · "}
                      {m.createdAt.toISOString().slice(11, 16)}
                    </div>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              );
            })}
            {conv.messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No messages yet.</p>
            ) : null}
          </div>

          {canSend && conv.status !== "CLOSED" ? (
            <form action={sendAgentMessageAction.bind(null, conv.id)} className="space-y-2 border-t pt-3">
              <Label htmlFor="body" className="sr-only">Reply</Label>
              <Textarea id="body" name="body" rows={3} placeholder="Type your reply…" required />
              <div className="flex justify-end">
                <Button type="submit">Send reply</Button>
              </div>
            </form>
          ) : conv.status === "CLOSED" ? (
            <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
              Conversation is closed.
            </p>
          ) : null}
        </Card>

        <Card className="p-6 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Details</h2>
          <div><span className="text-muted-foreground">Started: </span>{conv.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</div>
          <div><span className="text-muted-foreground">Last activity: </span>{conv.lastMessageAt.toISOString().slice(0, 16).replace("T", " ")} UTC</div>
          <div><span className="text-muted-foreground">Assignee: </span>{conv.agent ? (conv.agent.name ?? conv.agent.email) : "Unassigned"}</div>
          {conv.resolvedAt ? <div><span className="text-muted-foreground">Resolved: </span>{conv.resolvedAt.toISOString().slice(0, 10)}</div> : null}
          {conv.closedAt ? <div><span className="text-muted-foreground">Closed: </span>{conv.closedAt.toISOString().slice(0, 10)}</div> : null}

          {canAssign ? (
            <form action={assignChatAction.bind(null, conv.id)} className="space-y-2 pt-2 border-t">
              <Label htmlFor="agentId">Assign to</Label>
              <Select id="agentId" name="agentId" defaultValue={conv.agentId ?? ""}>
                <option value="">Unassigned</option>
                {memberships.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">Update assignee</Button>
            </form>
          ) : null}

          {canEdit && allowedStatuses.length > 1 ? (
            <form action={updateChatStatusAction.bind(null, conv.id)} className="space-y-2 pt-2 border-t">
              <Label htmlFor="status">Move to</Label>
              <Select id="status" name="status" defaultValue={conv.status}>
                {allowedStatuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">Update status</Button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteChatAction.bind(null, conv.id)} className="pt-2 border-t">
              <Button type="submit" variant="destructive" size="sm">Delete conversation</Button>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
