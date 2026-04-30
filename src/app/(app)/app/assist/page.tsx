import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createSessionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AssistListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "view");
  const canCreate = can(ctx.role, "assistSession", "create");

  const sessions = await prisma.assistSession.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      customerName: true,
      topic: true,
      status: true,
      createdAt: true,
      durationSec: true,
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Remote assist</h1>
        <p className="text-sm text-muted-foreground">
          Help customers in real time with chat, screen-share, and remote
          control sessions.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Start a session</h2>
          <form action={createSessionAction} className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="customerName">Customer name</Label>
              <Input
                id="customerName"
                name="customerName"
                required
                maxLength={160}
              />
            </div>
            <div>
              <Label htmlFor="customerEmail">Email (optional)</Label>
              <Input
                id="customerEmail"
                name="customerEmail"
                type="email"
                maxLength={190}
              />
            </div>
            <div>
              <Label htmlFor="customerPhone">Phone (optional)</Label>
              <Input id="customerPhone" name="customerPhone" maxLength={40} />
            </div>
            <div>
              <Label htmlFor="topic">Topic (optional)</Label>
              <Input id="topic" name="topic" maxLength={300} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Create session</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {sessions.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No remote-assist sessions yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/app/assist/${s.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {s.customerName}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.code}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.topic ? `${s.topic} · ` : ""}
                  {s.createdAt.toISOString().slice(0, 19).replace("T", " ")}
                  {s.durationSec ? ` · ${Math.round(s.durationSec / 60)}m` : ""}
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {s.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
