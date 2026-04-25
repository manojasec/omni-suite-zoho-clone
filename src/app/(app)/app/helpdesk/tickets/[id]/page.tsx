import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketForm } from "../ticket-form";
import { updateTicketAction, deleteTicketAction } from "../actions";
import { TicketReplyForm } from "../ticket-reply-form";
import { TicketStatusActions } from "../ticket-status-actions";

const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-800",
  ON_HOLD: "bg-zinc-200 text-zinc-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-zinc-200 text-zinc-700",
};

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();

  const [ticket, contacts, members] = await Promise.all([
    prisma.ticket.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: {
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignee: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
      take: 500,
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  if (!ticket) notFound();

  const update = updateTicketAction.bind(null, id);
  const remove = deleteTicketAction.bind(null, id);
  const requesterName = ticket.requester
    ? `${ticket.requester.firstName ?? ""} ${ticket.requester.lastName ?? ""}`.trim() || ticket.requester.email || "—"
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/helpdesk/tickets" className="text-sm text-muted-foreground hover:underline">
            ← All tickets
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{ticket.number}</span>
            <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[ticket.status]}`}>
              {ticket.status}
            </span>
            {ticket.priority} · {ticket.channel}
            {requesterName ? ` · from ${requesterName}` : ""}
            {ticket.firstResponseAt ? ` · 1st reply ${new Date(ticket.firstResponseAt).toLocaleString()}` : " · awaiting first reply"}
          </p>
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {ticket.description ? (
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  <div className="mb-1 text-xs uppercase text-muted-foreground">Original request</div>
                  <p className="whitespace-pre-wrap">{ticket.description}</p>
                </div>
              ) : null}
              {ticket.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet.</p>
              ) : (
                <ul className="space-y-3">
                  {ticket.messages.map((m) => (
                    <li
                      key={m.id}
                      className={`rounded-md border p-3 text-sm ${m.isInternal ? "bg-amber-50 border-amber-200" : "bg-background"}`}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {m.isInternal ? "Internal note" : "Reply"} · {m.authorType}
                        </span>
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <TicketReplyForm ticketId={ticket.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
            <CardContent>
              <TicketStatusActions ticketId={ticket.id} status={ticket.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Properties</CardTitle></CardHeader>
            <CardContent>
              <TicketForm
                action={update}
                hideStatus
                submitLabel="Save changes"
                initial={{
                  subject: ticket.subject,
                  description: ticket.description,
                  status: ticket.status,
                  priority: ticket.priority,
                  requesterContactId: ticket.requesterContactId,
                  assigneeId: ticket.assigneeId,
                  channel: ticket.channel,
                  tags: Array.isArray(ticket.tags) ? (ticket.tags as string[]) : [],
                }}
                contacts={contacts.map((c) => ({
                  id: c.id,
                  name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "—",
                }))}
                members={members.map((m) => ({
                  id: m.user.id,
                  name: m.user.name ?? m.user.email,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
