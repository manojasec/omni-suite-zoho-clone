import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  SHARED_THREAD_STATUSES,
  SHARED_THREAD_STATUS_LABELS,
} from "@/modules/teaminbox/schemas";
import { createThreadAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InboxDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ inboxId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { inboxId } = await params;
  const { status } = await searchParams;
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "view");
  const canEdit = can(ctx.role, "sharedInbox", "edit");

  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: inboxId, workspaceId: ctx.workspaceId },
    select: { id: true, name: true, address: true },
  });
  if (!inbox) notFound();

  const filter =
    status === "OPEN" ||
    status === "PENDING" ||
    status === "CLOSED"
      ? status
      : undefined;

  const threads = await prisma.sharedThread.findMany({
    where: { inboxId, ...(filter ? { status: filter } : {}) },
    orderBy: { lastMessageAt: "desc" },
    take: 200,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{inbox.name}</h1>
        <p className="text-xs text-muted-foreground">{inbox.address}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/teaminbox/${inboxId}`}
          className={`rounded border px-3 py-1 text-xs ${
            !filter ? "bg-accent" : ""
          }`}
        >
          All
        </Link>
        {SHARED_THREAD_STATUSES.map((st) => (
          <Link
            key={st}
            href={`/app/teaminbox/${inboxId}?status=${st}`}
            className={`rounded border px-3 py-1 text-xs ${
              filter === st ? "bg-accent" : ""
            }`}
          >
            {SHARED_THREAD_STATUS_LABELS[st]}
          </Link>
        ))}
      </div>

      {canEdit ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Log incoming email</h2>
          <form action={createThreadAction} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="inboxId" value={inboxId} />
            <div>
              <Label htmlFor="fromName">From name</Label>
              <Input id="fromName" name="fromName" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="fromEmail">From email</Label>
              <Input
                id="fromEmail"
                name="fromEmail"
                type="email"
                required
                maxLength={190}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" required maxLength={300} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="body">Body</Label>
              <textarea
                id="body"
                name="body"
                required
                rows={4}
                className="w-full rounded border bg-background p-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" size="sm">
                Create thread
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {threads.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No threads.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {threads.map((t) => (
            <Link
              key={t.id}
              href={`/app/teaminbox/${inboxId}/${t.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{t.subject}</div>
                <div className="text-xs text-muted-foreground">
                  {t.fromName} ·{" "}
                  {t.lastMessageAt.toISOString().slice(0, 16).replace("T", " ")}{" "}
                  · {t._count.messages} msgs
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {t.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
