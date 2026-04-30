import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CHANNEL_KIND_LABELS } from "@/modules/cliq/schemas";
import { createChannelAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CliqPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "channel", "view");
  const canCreate = can(ctx.role, "channel", "create");

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      OR: [
        { kind: "PUBLIC" },
        { members: { some: { userId: ctx.userId } } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      _count: { select: { messages: true, members: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cliq</h1>
        <p className="text-sm text-muted-foreground">
          Real-time team chat across channels and direct messages.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">New channel</h2>
          <form action={createChannelAction} className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                pattern="[a-z0-9-]+"
                placeholder="general"
              />
            </div>
            <div>
              <Label htmlFor="kind">Visibility</Label>
              <select
                id="kind"
                name="kind"
                defaultValue="PUBLIC"
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" name="topic" maxLength={300} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Create</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {channels.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No channels yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {channels.map((c) => (
            <Link
              key={c.id}
              href={`/app/cliq/${c.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  #{c.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    {CHANNEL_KIND_LABELS[c.kind]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {c.topic || "No topic"} · {c._count.members} members ·{" "}
                  {c._count.messages} messages
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
