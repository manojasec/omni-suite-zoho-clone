import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MailFolder } from "@prisma/client";
import { MAIL_FOLDERS } from "@/modules/mail/schemas";
import { simulateInboundAction } from "./actions";

export const dynamic = "force-dynamic";

const folderLabels: Record<MailFolder, string> = {
  INBOX: "Inbox",
  SENT: "Sent",
  DRAFTS: "Drafts",
  ARCHIVE: "Archive",
  TRASH: "Trash",
};

export default async function MailListPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;
  const folderRaw = sp.folder?.toUpperCase();
  const folder: MailFolder = (MAIL_FOLDERS as readonly string[]).includes(folderRaw ?? "")
    ? (folderRaw as MailFolder)
    : "INBOX";

  const [threads, counts] = await Promise.all([
    prisma.mailThread.findMany({
      where: { workspaceId: ctx.workspaceId, folder },
      orderBy: [{ isStarred: "desc" }, { lastMessageAt: "desc" }],
      take: 100,
      include: { _count: { select: { messages: true } } },
    }),
    prisma.mailThread.groupBy({
      where: { workspaceId: ctx.workspaceId },
      by: ["folder"],
      _count: { _all: true },
    }),
  ]);

  const folderCount = (f: MailFolder) =>
    counts.find((c) => c.folder === f)?._count._all ?? 0;

  const inboxUnread = await prisma.mailThread.count({
    where: { workspaceId: ctx.workspaceId, folder: "INBOX", isUnread: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mail</h1>
          <p className="text-sm text-muted-foreground">
            Workspace inbox · {inboxUnread} unread
          </p>
        </div>
        <Link href="/app/mail/compose">
          <Button>Compose</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr]">
        <Card className="p-2">
          <nav className="space-y-1 text-sm">
            {MAIL_FOLDERS.map((f) => {
              const isActive = f === folder;
              return (
                <Link
                  key={f}
                  href={`/app/mail?folder=${f}`}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${
                    isActive ? "bg-muted font-medium" : "hover:bg-muted/50"
                  }`}
                >
                  <span>{folderLabels[f]}</span>
                  <span className="text-xs text-muted-foreground">{folderCount(f)}</span>
                </Link>
              );
            })}
          </nav>
        </Card>

        <Card>
          <div className="border-b p-4 text-sm font-semibold">{folderLabels[folder]}</div>
          <div className="divide-y">
            {threads.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No messages here.</p>
            ) : null}
            {threads.map((t) => {
              const participants = Array.isArray(t.participants)
                ? (t.participants as unknown[]).filter((p): p is string => typeof p === "string")
                : [];
              return (
                <Link
                  key={t.id}
                  href={`/app/mail/${t.id}`}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 ${
                    t.isUnread ? "font-medium" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {t.isStarred ? <span aria-label="Starred" title="Starred">★</span> : null}
                      {t.isUnread ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                      ) : null}
                      <span className="truncate">{t.subject}</span>
                      <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
                        {t.lastMessageAt.toISOString().slice(0, 10)}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {participants.slice(0, 3).join(", ")}
                      {participants.length > 3 ? ` +${participants.length - 3}` : ""}
                      {" — "}
                      {t.snippet || "(no preview)"}
                      {" · "}
                      {t._count.messages} msg
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Simulate inbound message</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            For demo/testing only. Adds a fake inbound message to the inbox.
          </p>
          <form action={simulateInboundAction} className="mt-3 grid gap-2 md:grid-cols-3">
            <div>
              <Label htmlFor="fromAddress">From</Label>
              <Input id="fromAddress" name="fromAddress" placeholder="acme@example.com" required />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="Question about pricing" />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="body">Body</Label>
              <Textarea id="body" name="body" rows={3} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" variant="outline" size="sm">Add to inbox</Button>
            </div>
          </form>
        </details>
      </Card>
    </div>
  );
}
