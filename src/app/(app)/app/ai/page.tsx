import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createConversationAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AIListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "aiConversation", "view");
  const canCreate = can(ctx.role, "aiConversation", "create");

  const conversations = await prisma.aIConversation.findMany({
    where: { workspaceId: ctx.workspaceId, userId: ctx.userId },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI assistant</h1>
        <p className="text-sm text-muted-foreground">
          Chat with the workspace assistant. Replies are stubbed until a model is wired up.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">New conversation</h2>
          <form action={createConversationAction} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="title" className="sr-only">
                Title
              </Label>
              <Input id="title" name="title" required maxLength={200} placeholder="What would you like to ask?" />
            </div>
            <Button type="submit">Start</Button>
          </form>
        </Card>
      ) : null}

      {conversations.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No conversations yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {conversations.map((c) => (
            <Link
              key={c.id}
              href={`/app/ai/${c.id}`}
              className="flex items-center justify-between p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c._count.messages} messages ·{" "}
                  {c.updatedAt.toISOString().slice(0, 16).replace("T", " ")}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
