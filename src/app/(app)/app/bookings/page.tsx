import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { can } from "@/platform/permissions";
import {
  cancelBookingAction,
  markCompletedAction,
  markNoShowAction,
} from "./actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-muted text-muted-foreground",
  NO_SHOW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const status = params.status?.toUpperCase();
  const valid = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"];

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && valid.includes(status)
      ? { status: status as "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW" }
      : {}),
  };

  const [bookings, totals] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { startsAt: "desc" },
      take: 200,
      include: { bookingType: { select: { name: true, color: true } } },
    }),
    prisma.booking.groupBy({
      by: ["status"],
      where: { workspaceId: ctx.workspaceId },
      _count: { _all: true },
    }),
  ]);
  const tile = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0;
  const canEdit = can(ctx.role, "booking", "edit");

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">Appointments scheduled across your booking pages.</p>
        </div>
        <Link href="/app/bookings/types" className="text-sm font-medium hover:underline">
          Manage booking pages →
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{s.replace("_", " ")}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{tile(s)}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/app/bookings" className={`rounded-full border px-3 py-1 ${!status ? "bg-primary text-primary-foreground" : ""}`}>All</Link>
        {valid.map((s) => (
          <Link key={s} href={`/app/bookings?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : ""}`}>
            {s.replace("_", " ")}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Attendee</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-t hover:bg-accent/30 align-top">
                <td className="px-4 py-2 tabular-nums">
                  <Link href={`/app/bookings/${b.id}`} className="font-medium hover:underline">
                    {b.startsAt.toISOString().replace("T", " ").slice(0, 16)} UTC
                  </Link>
                </td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: b.bookingType.color }} />
                    {b.bookingType.name}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div>{b.attendeeName}</div>
                  <div className="text-xs text-muted-foreground">{b.attendeeEmail}</div>
                </td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[b.status]}`}>{b.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-2 text-right">
                  {canEdit && b.status === "SCHEDULED" ? (
                    <div className="inline-flex gap-1">
                      <form action={markCompletedAction.bind(null, b.id)}>
                        <Button type="submit" variant="outline" size="sm">Complete</Button>
                      </form>
                      <form action={markNoShowAction.bind(null, b.id)}>
                        <Button type="submit" variant="outline" size="sm">No-show</Button>
                      </form>
                      <form action={cancelBookingAction.bind(null, b.id)}>
                        <Button type="submit" variant="ghost" size="sm">Cancel</Button>
                      </form>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {bookings.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No bookings yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
