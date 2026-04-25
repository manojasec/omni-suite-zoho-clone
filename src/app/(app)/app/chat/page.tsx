import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { AutoRefresh } from "@/components/app/auto-refresh";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ASSIGNED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CLOSED: "bg-muted text-muted-foreground",
};

export default async function ChatInboxPage() {
  const ctx = await requireSession();

  const [conversations, ws] = await Promise.all([
    prisma.chatConversation.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { lastMessageAt: "desc" },
      take: 100,
      include: {
        agent: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.workspace.findUnique({ where: { id: ctx.workspaceId }, select: { slug: true } }),
  ]);

  const open = conversations.filter((c) => c.status === "OPEN").length;
  const assigned = conversations.filter((c) => c.status === "ASSIGNED").length;
  const resolved = conversations.filter((c) => c.status === "RESOLVED").length;

  return (
    <div className="space-y-6">
      <AutoRefresh intervalMs={5000} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live Chat Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Visitor conversations from your live-chat widget.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Open</div><div className="text-2xl font-semibold">{open}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Assigned</div><div className="text-2xl font-semibold">{assigned}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Resolved</div><div className="text-2xl font-semibold">{resolved}</div></Card>
      </div>

      <Card className="p-4">
        <div className="mb-2 text-xs text-muted-foreground">
          Visitor widget URL: <code className="rounded bg-muted px-1 py-0.5">/chat/{ws?.slug}</code>
        </div>
      </Card>

      <Card>
        <div className="border-b p-4 text-sm font-semibold">Conversations</div>
        <div className="divide-y">
          {conversations.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No conversations yet. Share your widget URL with visitors.
            </p>
          ) : null}
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/app/chat/${c.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.visitorName ?? c.visitorEmail ?? "Anonymous visitor"}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[c.status]}`}>{c.status}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c._count.messages} message{c._count.messages === 1 ? "" : "s"} ·{" "}
                  {c.agent ? `Assigned to ${c.agent.name ?? c.agent.email}` : "Unassigned"}
                  {c.pageUrl ? ` · ${c.pageUrl}` : ""}
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {c.lastMessageAt.toISOString().slice(0, 16).replace("T", " ")} UTC
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
