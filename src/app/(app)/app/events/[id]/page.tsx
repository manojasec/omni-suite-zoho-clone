import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  REGISTRATION_STATUS_LABELS,
} from "@/modules/events/schemas";
import {
  updateEventAction,
  deleteEventAction,
  createEventSessionAction,
  deleteEventSessionAction,
  updateRegistrationStatusAction,
  deleteRegistrationAction,
  checkInByCodeAction,
} from "../actions";

function toLocal(dt: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    dt.getFullYear() +
    "-" + pad(dt.getMonth() + 1) +
    "-" + pad(dt.getDate()) +
    "T" + pad(dt.getHours()) +
    ":" + pad(dt.getMinutes())
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "event", "view");
  const { id } = await params;
  const event = await prisma.event.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      sessions: { orderBy: { startsAt: "asc" } },
      registrations: { orderBy: { registeredAt: "desc" }, take: 200 },
      _count: { select: { registrations: true } },
    },
  });
  if (!event) notFound();

  const canEdit = can(ctx.role, "event", "edit");
  const canDelete = can(ctx.role, "event", "delete");
  const canEditReg = can(ctx.role, "eventRegistration", "edit");
  const canDeleteReg = can(ctx.role, "eventRegistration", "delete");

  const stats = {
    total: event._count.registrations,
    attended: event.registrations.filter((r) => r.status === "ATTENDED").length,
    waitlisted: event.registrations.filter((r) => r.status === "WAITLISTED").length,
    cancelled: event.registrations.filter((r) => r.status === "CANCELLED").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="text-sm text-muted-foreground">
            {EVENT_STATUS_LABELS[event.status]} · {event.startsAt.toISOString().replace("T", " ").slice(0, 16)} → {event.endsAt.toISOString().replace("T", " ").slice(0, 16)} · {event.isVirtual ? "Virtual" : event.location ?? "—"}
          </p>
          {event.status === "PUBLISHED" ? (
            <p className="text-xs text-muted-foreground mt-1">
              Public page: <Link href={`/e/${event.slug}`} className="text-primary hover:underline">/e/{event.slug}</Link>
            </p>
          ) : null}
        </div>
        {canDelete ? (
          <form action={deleteEventAction.bind(null, event.id)}>
            <Button type="submit" variant="outline" size="sm" className="text-red-600">Delete</Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Registrations</p><p className="text-2xl font-semibold">{stats.total}{event.capacity ? ` / ${event.capacity}` : ""}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Attended</p><p className="text-2xl font-semibold">{stats.attended}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Waitlisted</p><p className="text-2xl font-semibold">{stats.waitlisted}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Cancelled</p><p className="text-2xl font-semibold">{stats.cancelled}</p></Card>
      </div>

      {canEditReg ? (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Check in by ticket code</h2>
          <form action={checkInByCodeAction.bind(null, event.id)} className="flex gap-2">
            <Input name="code" placeholder="ABCDE-12345" maxLength={40} className="max-w-xs" />
            <Button type="submit" variant="outline">Check in</Button>
          </form>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-3">Event details</h2>
          <form action={updateEventAction.bind(null, event.id)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" defaultValue={event.title} required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" defaultValue={event.slug} required maxLength={120} />
              </div>
            </div>
            <div>
              <Label htmlFor="summary">Summary</Label>
              <Input id="summary" name="summary" defaultValue={event.summary ?? ""} maxLength={500} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={4} defaultValue={event.description ?? ""} maxLength={10000} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="startsAt">Starts at</Label>
                <Input id="startsAt" name="startsAt" type="datetime-local" defaultValue={toLocal(event.startsAt)} required />
              </div>
              <div>
                <Label htmlFor="endsAt">Ends at</Label>
                <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={toLocal(event.endsAt)} required />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" defaultValue={event.location ?? ""} maxLength={300} />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity</Label>
                <Input id="capacity" name="capacity" type="number" min={1} defaultValue={event.capacity ?? ""} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="isVirtual" defaultChecked={event.isVirtual} /> Virtual event
              </label>
              <div>
                <Label htmlFor="meetingUrl">Meeting URL</Label>
                <Input id="meetingUrl" name="meetingUrl" defaultValue={event.meetingUrl ?? ""} maxLength={500} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={event.status}>
                  {EVENT_STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS_LABELS[s]}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="coverImageUrl">Cover image URL</Label>
                <Input id="coverImageUrl" name="coverImageUrl" defaultValue={event.coverImageUrl ?? ""} maxLength={500} />
              </div>
            </div>
            <Button type="submit" variant="outline">Save changes</Button>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Sessions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Speaker</th>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {event.sessions.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-3 py-2 font-medium">{s.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.speaker ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {s.startsAt.toISOString().replace("T", " ").slice(0, 16)} → {s.endsAt.toISOString().slice(11, 16)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{s.location ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {canEdit ? (
                    <form action={deleteEventSessionAction.bind(null, event.id, s.id)}>
                      <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">Remove</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {event.sessions.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No sessions yet.</td></tr>
            ) : null}
          </tbody>
        </table>
        {canEdit ? (
          <form action={createEventSessionAction.bind(null, event.id)} className="grid gap-3 border-t bg-muted/40 px-4 py-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label htmlFor="s-title">Title</Label>
              <Input id="s-title" name="title" required maxLength={200} />
            </div>
            <div>
              <Label htmlFor="s-speaker">Speaker</Label>
              <Input id="s-speaker" name="speaker" maxLength={160} />
            </div>
            <div>
              <Label htmlFor="s-startsAt">Starts</Label>
              <Input id="s-startsAt" name="startsAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="s-endsAt">Ends</Label>
              <Input id="s-endsAt" name="endsAt" type="datetime-local" required />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" variant="outline" className="w-full">Add session</Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Registrations</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Ticket</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Registered</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {event.registrations.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.name}</div>
                  {r.company ? <p className="text-xs text-muted-foreground">{r.company}</p> : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.ticketCode}</td>
                <td className="px-3 py-2">
                  {canEditReg ? (
                    <form action={async (fd: FormData) => {
                      "use server";
                      const next = String(fd.get("status") ?? "REGISTERED") as
                        | "REGISTERED" | "CONFIRMED" | "ATTENDED" | "CANCELLED" | "WAITLISTED";
                      await updateRegistrationStatusAction(event.id, r.id, next);
                    }}>
                      <Select name="status" defaultValue={r.status} className="text-xs">
                        {Object.entries(REGISTRATION_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </Select>
                      <button type="submit" className="text-[10px] text-muted-foreground hover:text-foreground mt-1">Save</button>
                    </form>
                  ) : (
                    REGISTRATION_STATUS_LABELS[r.status]
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.registeredAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="px-3 py-2 text-right">
                  {canDeleteReg ? (
                    <form action={deleteRegistrationAction.bind(null, event.id, r.id)}>
                      <button type="submit" className="text-xs text-muted-foreground hover:text-red-600">Remove</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {event.registrations.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No registrations yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
