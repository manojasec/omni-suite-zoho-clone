import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { deleteConversationAction, postMessageAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function AIDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "aiConversation", "view");
  const canEdit = can(ctx.role, "aiConversation", "edit");
  const canDelete = can(ctx.role, "aiConversation", "delete");

  const conversation = await prisma.aIConversation.findFirst({
    where: { id, workspaceId: ctx.workspaceId, userId: ctx.userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{conversation.title}</h1>
          <p className="text-xs text-muted-foreground">
            {conversation.messages.length} messages
          </p>
        </div>
        {canDelete ? (
          <form action={deleteConversationAction.bind(null, id)}>
            <Button type="submit" size="sm" variant="ghost">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      <Card className="space-y-3 p-4">
        {conversation.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="space-y-2">
            {conversation.messages.map((m) => (
              <li
                key={m.id}
                className={`rounded border px-3 py-2 text-sm ${
                  m.role === "ASSISTANT"
                    ? "bg-muted/40"
                    : m.role === "SYSTEM"
                      ? "bg-yellow-50/50 border-yellow-300"
                      : ""
                }`}
              >
                <div className="text-xs text-muted-foreground">{m.role}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canEdit ? (
        <Card className="space-y-3 p-4">
          <form action={postMessageAction.bind(null, id)} className="space-y-2">
            <div>
              <Label htmlFor="content">Your message</Label>
              <textarea
                id="content"
                name="content"
                required
                rows={3}
                maxLength={8000}
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
