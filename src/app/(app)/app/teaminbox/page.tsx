import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createInboxAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function TeamInboxListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "sharedInbox", "view");
  const canCreate = can(ctx.role, "sharedInbox", "create");

  const inboxes = await prisma.sharedInbox.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: {
        select: { threads: true, members: true },
      },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team Inbox</h1>
        <p className="text-sm text-muted-foreground">
          Shared inboxes with assignment, status, and internal notes.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">New shared inbox</h2>
          <form action={createInboxAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                name="address"
                type="email"
                required
                maxLength={190}
                placeholder="support@example.com"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {inboxes.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No shared inboxes yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {inboxes.map((i) => (
            <Link
              key={i.id}
              href={`/app/teaminbox/${i.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">
                  {i.address} · {i._count.threads} threads ·{" "}
                  {i._count.members} members
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
