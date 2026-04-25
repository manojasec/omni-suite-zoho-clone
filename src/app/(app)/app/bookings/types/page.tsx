import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { headers } from "next/headers";
import { createBookingTypeAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function BookingTypesPage() {
  const ctx = await requireSession();
  const types = await prisma.bookingType.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: { _count: { select: { bookings: true } } },
  });
  const canCreate = can(ctx.role, "bookingType", "create");

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Booking pages</h1>
        <p className="text-sm text-muted-foreground">Configure event types and share their public links.</p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New booking page</h2>
          <form action={createBookingTypeAction} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input id="name" name="name" required placeholder="Discovery call" />
              </div>
              <div>
                <Label htmlFor="publicSlug">Public slug *</Label>
                <Input id="publicSlug" name="publicSlug" required placeholder="discovery-call" />
              </div>
              <div>
                <Label htmlFor="durationMins">Duration (minutes) *</Label>
                <Input id="durationMins" name="durationMins" type="number" min={5} max={480} defaultValue={30} required />
              </div>
              <div>
                <Label htmlFor="bufferMins">Buffer (minutes)</Label>
                <Input id="bufferMins" name="bufferMins" type="number" min={0} max={120} defaultValue={0} />
              </div>
              <div>
                <Label htmlFor="color">Color</Label>
                <Input id="color" name="color" type="color" defaultValue="#0F172A" />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} placeholder="What to expect on this call." />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create booking page</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Duration</th>
              <th className="px-4 py-2 font-medium">Public link</th>
              <th className="px-4 py-2 font-medium tabular-nums">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id} className={`border-t hover:bg-accent/30 ${t.archived ? "opacity-60" : ""}`}>
                <td className="px-4 py-2">
                  <Link href={`/app/bookings/types/${t.id}`} className="font-medium hover:underline inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.name}
                    {t.archived ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">archived</span> : null}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{t.durationMins}m</td>
                <td className="px-4 py-2">
                  <a href={`${origin}/book/${t.publicSlug}`} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:underline break-all">
                    {origin}/book/{t.publicSlug}
                  </a>
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{t._count.bookings}</td>
              </tr>
            ))}
            {types.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No booking pages yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
