import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TicketForm } from "../ticket-form";
import { createTicketAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  const ctx = await requireSession();
  const [contacts, members] = await Promise.all([
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

  return (
    <div className="mx-auto max-w-3xl">
      <Card>
        <CardHeader><CardTitle>New ticket</CardTitle></CardHeader>
        <CardContent>
          <TicketForm
            action={createTicketAction}
            contacts={contacts.map((c) => ({
              id: c.id,
              name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || "—",
            }))}
            members={members.map((m) => ({
              id: m.user.id,
              name: m.user.name ?? m.user.email,
            }))}
            submitLabel="Create ticket"
          />
        </CardContent>
      </Card>
    </div>
  );
}
