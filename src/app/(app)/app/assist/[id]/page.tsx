import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ASSIST_EVENT_LABELS } from "@/modules/assist/schemas";
import {
  cancelSessionAction,
  deleteSessionAction,
  endSessionAction,
  grantControlAction,
  postChatAction,
  startSessionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function AssistSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "assistSession", "view");
  const canEdit = can(ctx.role, "assistSession", "edit");
  const canDelete = can(ctx.role, "assistSession", "delete");

  const sess = await prisma.assistSession.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      events: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!sess) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {sess.customerName}
          </h1>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">{sess.code}</span>
            {sess.topic ? ` · ${sess.topic}` : ""}
            {sess.customerEmail ? ` · ${sess.customerEmail}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && sess.status === "PENDING" ? (
            <>
              <form action={startSessionAction.bind(null, sess.id)}>
                <Button type="submit" size="sm">
                  Start
                </Button>
              </form>
              <form action={cancelSessionAction.bind(null, sess.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            </>
          ) : null}
          {canEdit && sess.status === "ACTIVE" ? (
            <>
              <form action={grantControlAction.bind(null, sess.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  Grant control
                </Button>
              </form>
              <form action={endSessionAction.bind(null, sess.id)}>
                <Button type="submit" size="sm">
                  End session
                </Button>
              </form>
            </>
          ) : null}
          {canDelete ? (
            <form action={deleteSessionAction.bind(null, sess.id)}>
              <Button type="submit" variant="ghost">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Status</div>
          <div className="text-lg font-semibold">{sess.status}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Started</div>
          <div className="text-sm font-semibold">
            {sess.startedAt
              ? sess.startedAt.toISOString().slice(0, 19).replace("T", " ")
              : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Duration
          </div>
          <div className="text-sm font-semibold">
            {sess.durationSec
              ? `${Math.floor(sess.durationSec / 60)}m ${sess.durationSec % 60}s`
              : "—"}
          </div>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Activity</h2>
        {sess.events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {sess.events.map((e) => (
              <li key={e.id} className="rounded border px-3 py-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{ASSIST_EVENT_LABELS[e.kind]}</span>
                  <span>
                    {e.createdAt.toISOString().slice(11, 19)}
                  </span>
                </div>
                {e.body ? <div className="mt-1 text-sm">{e.body}</div> : null}
              </li>
            ))}
          </ol>
        )}

        {canEdit && sess.status === "ACTIVE" ? (
          <form
            action={postChatAction.bind(null, sess.id)}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="body">Message</Label>
              <Input id="body" name="body" required maxLength={1000} />
            </div>
            <Button type="submit" size="sm">
              Send
            </Button>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
