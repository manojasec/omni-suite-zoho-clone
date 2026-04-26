import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { publicRegisterAction } from "@/app/(app)/app/events/actions";

export const dynamic = "force-dynamic";

export default async function PublicEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await prisma.event.findFirst({
    where: { slug: slug.toLowerCase() },
    include: {
      sessions: { orderBy: { startsAt: "asc" } },
      _count: { select: { registrations: true } },
    },
  });
  if (!event) notFound();

  const closed = event.status === "DRAFT" || event.status === "CANCELLED" || event.status === "COMPLETED";
  const full = event.capacity != null && event._count.registrations >= event.capacity;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      {event.coverImageUrl ? (
        <img src={event.coverImageUrl} alt="" className="w-full rounded-lg border object-cover" />
      ) : null}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
        {event.summary ? <p className="mt-2 text-sm text-muted-foreground">{event.summary}</p> : null}
        <p className="mt-2 text-sm">
          <strong>{event.startsAt.toUTCString().slice(0, 22)}</strong> → {event.endsAt.toUTCString().slice(0, 22)}
        </p>
        <p className="text-sm text-muted-foreground">
          {event.isVirtual ? "Virtual event" : event.location ?? "Location TBA"}
        </p>
      </div>

      {event.description ? (
        <Card className="p-6">
          <p className="whitespace-pre-wrap text-sm">{event.description}</p>
        </Card>
      ) : null}

      {event.sessions.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-3">Agenda</h2>
          <ul className="space-y-2">
            {event.sessions.map((s) => (
              <li key={s.id} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground">
                  {s.startsAt.toUTCString().slice(17, 22)} → {s.endsAt.toUTCString().slice(17, 22)}
                  {s.speaker ? ` · ${s.speaker}` : ""}
                  {s.location ? ` · ${s.location}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {closed ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Registration is not currently open for this event.
        </Card>
      ) : (
        <Card className="p-6">
          <h2 className="text-base font-semibold mb-3">
            {full ? "Event is full — join the waitlist" : "Register"}
          </h2>
          <form action={publicRegisterAction.bind(null, slug)} className="space-y-3">
            <div>
              <Label htmlFor="name">Full name</Label>
              <Input id="name" name="name" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required maxLength={200} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" name="phone" maxLength={40} />
              </div>
              <div>
                <Label htmlFor="company">Company (optional)</Label>
                <Input id="company" name="company" maxLength={200} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Anything we should know?</Label>
              <Textarea id="notes" name="notes" rows={3} maxLength={500} />
            </div>
            <Button type="submit" className="w-full">
              {full ? "Join waitlist" : "Register"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
