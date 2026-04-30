import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MEETING_KINDS, MEETING_KIND_LABELS } from "@/modules/meetings/schemas";
import { createMeetingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "view");
  const canCreate = can(ctx.role, "meeting", "create");

  const meetings = await prisma.meeting.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { scheduledAt: "desc" },
    take: 200,
    include: { _count: { select: { attendees: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Meetings & webinars
        </h1>
        <p className="text-sm text-muted-foreground">
          Schedule team meetings and broadcast webinars to large audiences.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Schedule new</h2>
          <form action={createMeetingAction} className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="kind">Type</Label>
              <select
                id="kind"
                name="kind"
                defaultValue="MEETING"
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {MEETING_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {MEETING_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="scheduledAt">Date & time</Label>
              <Input
                id="scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                required
              />
            </div>
            <div>
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input
                id="durationMin"
                name="durationMin"
                type="number"
                defaultValue="30"
                min={5}
                max={720}
              />
            </div>
            <div>
              <Label htmlFor="attendeeLimit">Attendee limit</Label>
              <Input
                id="attendeeLimit"
                name="attendeeLimit"
                type="number"
                defaultValue="100"
                min={1}
                max={10000}
              />
            </div>
            <div className="sm:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" maxLength={2000} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Schedule</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {meetings.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No meetings scheduled yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {meetings.map((m) => (
            <Link
              key={m.id}
              href={`/app/meetings/${m.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {m.title}{" "}
                  <span className="text-xs text-muted-foreground">
                    {MEETING_KIND_LABELS[m.kind]}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {m.durationMin} min · {m._count.attendees} attendees
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {m.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
