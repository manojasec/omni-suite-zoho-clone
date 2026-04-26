import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EVENT_STATUSES, EVENT_STATUS_LABELS } from "@/modules/events/schemas";

export const dynamic = "force-dynamic";

export default async function EventsListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "view");
  const sp = await searchParams;
  const status = sp.status && sp.status !== "all" ? (sp.status as (typeof EVENT_STATUSES)[number]) : undefined;
  const q = (sp.q ?? "").trim();

  const events = await prisma.event.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status ? { status } : {}),
      ...(q
        ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }, { location: { contains: q } }] }
        : {}),
    },
    orderBy: [{ startsAt: "desc" }],
    include: { _count: { select: { registrations: true, sessions: true } } },
    take: 200,
  });

  const canCreate = can(ctx.role, "event", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        {canCreate ? <Link href="/app/events/new"><Button>New event</Button></Link> : null}
      </div>

      <Card className="p-4">
        <form className="grid gap-3 md:grid-cols-4">
          <div>
            <Label htmlFor="q">Search</Label>
            <Input id="q" name="q" defaultValue={q} placeholder="Title, slug, location..." />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue={status ?? "all"}>
              <option value="all">All statuses</option>
              {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}
            </Select>
          </div>
          <div className="flex items-end"><Button type="submit" variant="outline">Apply</Button></div>
        </form>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Starts</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-right">Sessions</th>
              <th className="px-3 py-2 text-right">Registrations</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/app/events/${e.id}`} className="font-medium hover:underline">{e.title}</Link>
                  <p className="text-xs text-muted-foreground">/e/{e.slug}</p>
                </td>
                <td className="px-3 py-2">{EVENT_STATUS_LABELS[e.status]}</td>
                <td className="px-3 py-2 text-muted-foreground">{e.startsAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {e.isVirtual ? "Virtual" : e.location ?? "—"}
                </td>
                <td className="px-3 py-2 text-right">{e._count.sessions}</td>
                <td className="px-3 py-2 text-right">
                  {e._count.registrations}{e.capacity ? ` / ${e.capacity}` : ""}
                </td>
              </tr>
            ))}
            {events.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No events match your filters.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
