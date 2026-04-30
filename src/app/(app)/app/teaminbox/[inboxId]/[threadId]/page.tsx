import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { postReplyAction, setThreadStatusAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ThreadDetailPage({
  params,
}: {
  params: Promise<{ inboxId: string; threadId: string }>;
}) {
  const { inboxId, threadId } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "view");
  const canEdit = can(ctx.role, "sharedInbox", "edit");

  const thread = await prisma.sharedThread.findFirst({
    where: { id: threadId, inboxId, workspaceId: ctx.workspaceId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      inbox: { select: { name: true } },
    },
  });
  if (!thread) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {thread.subject}
          </h1>
          <p className="text-xs text-muted-foreground">
            {thread.inbox.name} · From {thread.fromName} ({thread.fromEmail})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && thread.status !== "CLOSED" ? (
            <>
              <form action={setThreadStatusAction.bind(null, threadId, "PENDING")}>
                <Button type="submit" size="sm" variant="ghost">
                  Mark pending
                </Button>
              </form>
              <form action={setThreadStatusAction.bind(null, threadId, "CLOSED")}>
                <Button type="submit" size="sm">
                  Close
                </Button>
              </form>
            </>
          ) : null}
          {canEdit && thread.status === "CLOSED" ? (
            <form action={setThreadStatusAction.bind(null, threadId, "OPEN")}>
              <Button type="submit" size="sm">
                Reopen
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <ul className="space-y-2">
          {thread.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded border px-3 py-2 text-sm ${
                m.direction === "NOTE"
                  ? "border-yellow-300 bg-yellow-50/50"
                  : m.direction === "OUT"
                    ? "border-blue-300 bg-blue-50/50"
                    : ""
              }`}
            >
              <div className="text-xs text-muted-foreground">
                {m.direction} · {m.authorName} ·{" "}
                {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
            </li>
          ))}
        </ul>
      </Card>

      {canEdit && thread.status !== "CLOSED" ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Reply</h2>
          <form
            action={postReplyAction.bind(null, threadId)}
            className="space-y-2"
          >
            <div>
              <Label htmlFor="direction">Type</Label>
              <select
                id="direction"
                name="direction"
                defaultValue="OUT"
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                <option value="OUT">Reply to customer</option>
                <option value="NOTE">Internal note</option>
              </select>
            </div>
            <div>
              <Label htmlFor="body">Message</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={4}
                className="w-full rounded border bg-background p-2 text-sm"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Send
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
