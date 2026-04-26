import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EVENT_TYPE_LABELS,
  scoreBucket,
  scoreBucketClass,
  sumPoints,
} from "@/modules/scoring/schemas";
import { recordManualEventAction, deleteEventAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ContactScorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreEvent", "view");
  const { id } = await params;

  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!contact) notFound();

  const events = await prisma.leadScoreEvent.findMany({
    where: { workspaceId: ctx.workspaceId, contactId: id },
    include: { rule: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = sumPoints(events);
  const canRecord = can(ctx.role, "leadScoreEvent", "create");
  const canDelete = can(ctx.role, "leadScoreEvent", "delete");

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/scoring" className="hover:underline">← Lead scoring</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {contact.firstName}
          {contact.lastName ? " " + contact.lastName : ""}
        </h1>
        <p className="text-sm text-muted-foreground">{contact.email ?? "—"}</p>
      </div>

      <Card className="p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Total score</p>
          <p className="text-3xl font-semibold tabular-nums">{total}</p>
        </div>
        <span
          className={
            "inline-flex items-center gap-2 rounded px-3 py-1 text-sm font-medium " +
            scoreBucketClass(total)
          }
        >
          {scoreBucket(total)}
        </span>
      </Card>

      {canRecord ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Adjust score manually</h2>
          <form action={recordManualEventAction} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end">
            <input type="hidden" name="contactId" value={contact.id} />
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" maxLength={300} placeholder="Why?" />
            </div>
            <div>
              <Label htmlFor="points">Points</Label>
              <Input id="points" name="points" type="number" defaultValue={5} required />
            </div>
            <Button type="submit">Record</Button>
          </form>
        </Card>
      ) : null}

      <Card className="divide-y">
        {events.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No score events recorded.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3">
              <div className="text-sm">
                <span className="font-medium">{EVENT_TYPE_LABELS[e.eventType]}</span>
                {e.rule ? <span className="text-muted-foreground"> · via {e.rule.name}</span> : null}
                {e.reason ? <p className="text-xs text-muted-foreground">{e.reason}</p> : null}
                <p className="text-xs text-muted-foreground">{e.createdAt.toISOString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={
                    "tabular-nums text-sm font-medium " +
                    (e.points >= 0 ? "text-emerald-600" : "text-rose-600")
                  }
                >
                  {e.points >= 0 ? `+${e.points}` : e.points}
                </span>
                {canDelete ? (
                  <form action={deleteEventAction.bind(null, e.id)}>
                    <Button type="submit" size="sm" variant="outline">Remove</Button>
                  </form>
                ) : null}
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
