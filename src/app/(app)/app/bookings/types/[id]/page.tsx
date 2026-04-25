import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { fromMinutes } from "@/modules/bookings/schemas";
import {
  archiveBookingTypeAction,
  updateAvailabilityAction,
  updateBookingTypeAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function BookingTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const bt = await prisma.bookingType.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" } },
      _count: { select: { bookings: true } },
    },
  });
  if (!bt) notFound();
  const canEdit = can(ctx.role, "bookingType", "edit");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const publicUrl = `${proto}://${host}/book/${bt.publicSlug}`;

  const byDay: Record<number, { start: string; end: string } | undefined> = {};
  for (const a of bt.availability) {
    byDay[a.dayOfWeek] = {
      start: fromMinutes(a.startMinutes),
      end: fromMinutes(a.endMinutes),
    };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/bookings/types" className="text-xs text-muted-foreground hover:underline">← Back to booking pages</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{bt.name}</h1>
          <a href={publicUrl} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:underline break-all">
            {publicUrl}
          </a>
        </div>
        {canEdit ? (
          <form action={archiveBookingTypeAction.bind(null, bt.id)}>
            <Button type="submit" variant="outline" size="sm">{bt.archived ? "Unarchive" : "Archive"}</Button>
          </form>
        ) : null}
      </div>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Details</h2>
        <form action={updateBookingTypeAction.bind(null, bt.id)} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" required defaultValue={bt.name} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="publicSlug">Public slug *</Label>
              <Input id="publicSlug" name="publicSlug" required defaultValue={bt.publicSlug} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="durationMins">Duration (minutes) *</Label>
              <Input id="durationMins" name="durationMins" type="number" min={5} max={480} required defaultValue={bt.durationMins} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="bufferMins">Buffer (minutes)</Label>
              <Input id="bufferMins" name="bufferMins" type="number" min={0} max={120} defaultValue={bt.bufferMins} disabled={!canEdit} />
            </div>
            <div>
              <Label htmlFor="color">Color</Label>
              <Input id="color" name="color" type="color" defaultValue={bt.color} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={2} defaultValue={bt.description ?? ""} disabled={!canEdit} />
          </div>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" variant="outline">Save details</Button>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="mb-1 text-sm font-semibold">Weekly availability</h2>
        <p className="mb-3 text-xs text-muted-foreground">Times are interpreted in UTC.</p>
        <form action={updateAvailabilityAction.bind(null, bt.id)} className="space-y-2">
          {DAYS.map((label, dow) => {
            const row = byDay[dow];
            const enabled = !!row;
            return (
              <div key={dow} className="flex items-center gap-3 rounded-md border p-2">
                <label className="flex w-24 items-center gap-2 text-sm">
                  <input type="checkbox" name={`day_${dow}_enabled`} defaultChecked={enabled} disabled={!canEdit} />
                  {label}
                </label>
                <Input name={`day_${dow}_start`} type="time" defaultValue={row?.start ?? "09:00"} disabled={!canEdit} className="w-32" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input name={`day_${dow}_end`} type="time" defaultValue={row?.end ?? "17:00"} disabled={!canEdit} className="w-32" />
              </div>
            );
          })}
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" variant="outline">Save availability</Button>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground">Total bookings</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{bt._count.bookings}</div>
      </Card>
    </div>
  );
}
