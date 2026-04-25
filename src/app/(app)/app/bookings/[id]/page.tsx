import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/input";
import { can } from "@/platform/permissions";
import {
  cancelBookingAction,
  markCompletedAction,
  markNoShowAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const b = await prisma.booking.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      bookingType: { select: { name: true, color: true, durationMins: true } },
      host: { select: { name: true, email: true } },
    },
  });
  if (!b) notFound();
  const canEdit = can(ctx.role, "booking", "edit");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/bookings" className="text-xs text-muted-foreground hover:underline">← Back to bookings</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{b.attendeeName}</h1>
          <span className={`rounded px-2 py-0.5 text-xs ${statusColor[b.status]}`}>{b.status.replace("_", " ")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {b.startsAt.toISOString().replace("T", " ").slice(0, 16)} – {b.endsAt.toISOString().slice(11, 16)} UTC ({b.bookingType.durationMins}m)
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6 space-y-2 text-sm">
          <h2 className="text-sm font-semibold">Attendee</h2>
          <div><span className="text-muted-foreground">Name: </span>{b.attendeeName}</div>
          <div><span className="text-muted-foreground">Email: </span><a href={`mailto:${b.attendeeEmail}`} className="hover:underline">{b.attendeeEmail}</a></div>
          {b.attendeePhone ? <div><span className="text-muted-foreground">Phone: </span>{b.attendeePhone}</div> : null}
          {b.notes ? (
            <div className="pt-2">
              <div className="text-muted-foreground text-xs uppercase">Notes</div>
              <p className="whitespace-pre-wrap">{b.notes}</p>
            </div>
          ) : null}
        </Card>

        <Card className="p-6 space-y-2 text-sm">
          <h2 className="text-sm font-semibold">Event</h2>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.bookingType.color }} />
            {b.bookingType.name}
          </div>
          <div><span className="text-muted-foreground">Host: </span>{b.host.name ?? b.host.email}</div>
          {b.location ? <div><span className="text-muted-foreground">Location: </span>{b.location}</div> : null}
          {b.cancelledAt ? (
            <div className="pt-2">
              <div className="text-muted-foreground text-xs uppercase">Cancellation</div>
              <p className="text-xs">{b.cancelledAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              {b.cancelReason ? <p className="whitespace-pre-wrap">{b.cancelReason}</p> : null}
            </div>
          ) : null}
        </Card>
      </div>

      {canEdit && b.status === "SCHEDULED" ? (
        <Card className="p-6 space-y-4">
          <h2 className="text-sm font-semibold">Update status</h2>
          <div className="flex flex-wrap gap-2">
            <form action={markCompletedAction.bind(null, b.id)}>
              <Button type="submit" variant="outline">Mark completed</Button>
            </form>
            <form action={markNoShowAction.bind(null, b.id)}>
              <Button type="submit" variant="outline">Mark no-show</Button>
            </form>
          </div>
          <form action={cancelBookingAction.bind(null, b.id)} className="space-y-2 pt-2 border-t">
            <Label htmlFor="reason">Cancel with reason</Label>
            <Textarea id="reason" name="reason" rows={2} placeholder="Optional reason shared in audit log." />
            <div>
              <Button type="submit" variant="destructive">Cancel booking</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
