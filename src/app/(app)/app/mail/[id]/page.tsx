import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { MAIL_FOLDERS } from "@/modules/mail/schemas";
import {
  deleteThreadAction,
  markThreadReadAction,
  moveThreadAction,
  replyMailAction,
  toggleReadThreadAction,
  toggleStarThreadAction,
} from "../actions";

export const dynamic = "force-dynamic";

function asStringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s): s is string => typeof s === "string");
}

export default async function MailThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;

  const thread = await prisma.mailThread.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sentBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!thread) notFound();

  // Mark read on open (fire-and-forget; UI shows current state).
  if (thread.isUnread) {
    await prisma.mailThread.update({
      where: { id: thread.id },
      data: { isUnread: false },
    });
  }

  const canSend = can(ctx.role, "mailMessage", "send");
  const canEdit = can(ctx.role, "mailThread", "edit");
  const canDelete = can(ctx.role, "mailThread", "delete");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/mail" className="text-xs text-muted-foreground hover:underline">
          ← Mail
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{thread.subject}</h1>
          {thread.isStarred ? <span title="Starred">★</span> : null}
          <span className="rounded border px-2 py-0.5 text-xs">{thread.folder}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 md:col-span-2 space-y-4">
          {thread.messages.map((m) => {
            const to = asStringList(m.toAddresses);
            const cc = asStringList(m.ccAddresses);
            const isOutbound = m.direction === "OUTBOUND";
            return (
              <div key={m.id} className="rounded-md border p-4">
                <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                  <div>
                    <div>
                      <span className="font-medium text-foreground">
                        {m.fromName ?? m.fromAddress}
                      </span>
                      {m.fromName ? <span> &lt;{m.fromAddress}&gt;</span> : null}
                      {isOutbound ? (
                        <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          Sent
                        </span>
                      ) : (
                        <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          Received
                        </span>
                      )}
                    </div>
                    <div>To: {to.join(", ") || "—"}</div>
                    {cc.length ? <div>Cc: {cc.join(", ")}</div> : null}
                  </div>
                  <span>{m.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{m.body}</p>
              </div>
            );
          })}

          {canSend && thread.folder !== "TRASH" ? (
            <form action={replyMailAction.bind(null, thread.id)} className="space-y-2 border-t pt-3">
              <Label htmlFor="body">Reply</Label>
              <Textarea id="body" name="body" rows={5} required />
              <div className="flex justify-end">
                <Button type="submit">Send reply</Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card className="p-6 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Actions</h2>
          {canEdit ? (
            <>
              <form action={moveThreadAction.bind(null, thread.id)} className="space-y-2">
                <Label htmlFor="folder">Move to</Label>
                <Select id="folder" name="folder" defaultValue={thread.folder}>
                  {MAIL_FOLDERS.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
                <Button type="submit" variant="outline" size="sm">Move</Button>
              </form>
              <form action={toggleStarThreadAction.bind(null, thread.id)}>
                <Button type="submit" variant="outline" size="sm">
                  {thread.isStarred ? "Unstar" : "Star"}
                </Button>
              </form>
              <form action={toggleReadThreadAction.bind(null, thread.id)}>
                <Button type="submit" variant="outline" size="sm">
                  Mark as {thread.isUnread ? "read" : "unread"}
                </Button>
              </form>
              <form action={markThreadReadAction.bind(null, thread.id)}>
                <Button type="submit" variant="ghost" size="sm">Refresh</Button>
              </form>
            </>
          ) : null}
          {canDelete ? (
            <form action={deleteThreadAction.bind(null, thread.id)} className="border-t pt-2">
              <Button type="submit" variant="destructive" size="sm">Delete forever</Button>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
