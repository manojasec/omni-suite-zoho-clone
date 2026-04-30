import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { MEETING_KIND_LABELS } from "@/modules/meetings/schemas";
import {
  addAttendeeAction,
  cancelMeetingAction,
  deleteMeetingAction,
  endMeetingAction,
  postMeetingChatAction,
  startMeetingAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "meeting", "view");
  const canEdit = can(ctx.role, "meeting", "edit");
  const canDelete = can(ctx.role, "meeting", "delete");

  const meeting = await prisma.meeting.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      attendees: { orderBy: { role: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  if (!meeting) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {meeting.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {MEETING_KIND_LABELS[meeting.kind]} ·{" "}
            <span className="font-mono">{meeting.joinCode}</span> ·{" "}
            {meeting.scheduledAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && meeting.status === "SCHEDULED" ? (
            <>
              <form action={startMeetingAction.bind(null, meeting.id)}>
                <Button type="submit" size="sm">
                  Start
                </Button>
              </form>
              <form action={cancelMeetingAction.bind(null, meeting.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  Cancel
                </Button>
              </form>
            </>
          ) : null}
          {canEdit && meeting.status === "LIVE" ? (
            <form action={endMeetingAction.bind(null, meeting.id)}>
              <Button type="submit" size="sm">
                End
              </Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteMeetingAction.bind(null, meeting.id)}>
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
          <div className="text-lg font-semibold">{meeting.status}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Duration
          </div>
          <div className="text-lg font-semibold">{meeting.durationMin} min</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Capacity
          </div>
          <div className="text-lg font-semibold">{meeting.attendeeLimit}</div>
        </Card>
      </div>

      {meeting.description ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold">Description</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {meeting.description}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">
          Attendees ({meeting.attendees.length})
        </h2>
        <ul className="space-y-1 text-sm">
          {meeting.attendees.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border px-3 py-2"
            >
              <span>
                {a.name}
                {a.email ? (
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    · {a.email}
                  </span>
                ) : null}
              </span>
              <span className="rounded bg-muted px-2 py-0.5 text-xs">
                {a.role}
              </span>
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form
            action={addAttendeeAction.bind(null, meeting.id)}
            className="grid gap-2 sm:grid-cols-3"
          >
            <Input name="name" placeholder="Name" required maxLength={160} />
            <Input
              name="email"
              type="email"
              placeholder="Email"
              maxLength={190}
            />
            <select
              name="role"
              defaultValue="ATTENDEE"
              className="h-9 rounded border bg-background px-2 text-sm"
            >
              <option value="ATTENDEE">Attendee</option>
              <option value="PRESENTER">Presenter</option>
              <option value="HOST">Host</option>
            </select>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" size="sm">
                Add attendee
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Chat</h2>
        {meeting.messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {meeting.messages.map((msg) => (
              <li key={msg.id} className="rounded border px-3 py-2">
                <div className="text-xs text-muted-foreground">
                  {msg.authorName} ·{" "}
                  {msg.createdAt.toISOString().slice(11, 19)}
                </div>
                <div>{msg.body}</div>
              </li>
            ))}
          </ul>
        )}
        {canEdit && meeting.status === "LIVE" ? (
          <form
            action={postMeetingChatAction.bind(null, meeting.id)}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Label htmlFor="body">Message</Label>
              <Input id="body" name="body" required maxLength={2000} />
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
