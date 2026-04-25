import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { computeSlots, parseISODate } from "@/modules/bookings/slots";
import { publicCreateBookingAction } from "@/app/(app)/app/bookings/actions";

export const dynamic = "force-dynamic";

function todayISO(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const bt = await prisma.bookingType.findUnique({
    where: { publicSlug: slug },
    include: {
      availability: { orderBy: { dayOfWeek: "asc" } },
      host: { select: { name: true } },
    },
  });
  if (!bt || bt.archived) notFound();

  const dateStr = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayISO();
  const date = parseISODate(dateStr) ?? parseISODate(todayISO())!;
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);

  const existing = await prisma.booking.findMany({
    where: {
      bookingTypeId: bt.id,
      status: "SCHEDULED",
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    select: { startsAt: true, endsAt: true },
  });

  const slots = computeSlots(
    bt.availability.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startMinutes: a.startMinutes,
      endMinutes: a.endMinutes,
    })),
    existing,
    {
      date: dayStart,
      durationMins: bt.durationMins,
      bufferMins: bt.bufferMins,
    },
  );

  // Build a 14-day strip starting today.
  const today = parseISODate(todayISO())!;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() + i * 24 * 60 * 60_000);
    const iso = d.toISOString().slice(0, 10);
    const dow = d.getUTCDay();
    const hasWindow = bt.availability.some((a) => a.dayOfWeek === dow);
    return {
      iso,
      label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }),
      enabled: hasWindow,
      active: iso === dateStr,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{bt.name}</h1>
        <p className="text-sm text-muted-foreground">
          {bt.durationMins}-minute meeting{bt.host.name ? ` with ${bt.host.name}` : ""} · all times UTC
        </p>
        {bt.description ? <p className="mt-3 whitespace-pre-wrap text-sm">{bt.description}</p> : null}
      </div>

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Pick a date</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {days.map((d) => (
              <Link
                key={d.iso}
                href={d.enabled ? `/book/${slug}?date=${d.iso}` : `/book/${slug}`}
                aria-disabled={!d.enabled}
                className={`rounded-md border px-3 py-2 text-center text-xs ${
                  d.active ? "bg-primary text-primary-foreground" : "bg-background"
                } ${d.enabled ? "" : "pointer-events-none opacity-40"}`}
              >
                {d.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold">Available times on {dateStr}</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No availability on this day. Pick another date.</p>
          ) : (
            <form action={publicCreateBookingAction.bind(null, slug)} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {slots.map((s, i) => {
                  const iso = s.toISOString();
                  return (
                    <label key={iso} className="cursor-pointer rounded-md border px-3 py-2 text-center text-xs hover:bg-accent has-[:checked]:bg-primary has-[:checked]:text-primary-foreground">
                      <input
                        type="radio"
                        name="startsAt"
                        value={iso}
                        defaultChecked={i === 0}
                        className="sr-only"
                        required
                      />
                      {iso.slice(11, 16)}
                    </label>
                  );
                })}
              </div>

              <div className="grid gap-3 md:grid-cols-2 pt-4 border-t">
                <div>
                  <Label htmlFor="attendeeName">Your name *</Label>
                  <Input id="attendeeName" name="attendeeName" required />
                </div>
                <div>
                  <Label htmlFor="attendeeEmail">Email *</Label>
                  <Input id="attendeeEmail" name="attendeeEmail" type="email" required />
                </div>
                <div>
                  <Label htmlFor="attendeePhone">Phone</Label>
                  <Input id="attendeePhone" name="attendeePhone" type="tel" />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Anything we should know?</Label>
                <Textarea id="notes" name="notes" rows={3} />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Book this time</Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
