import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ContactForm } from "../contact-form";
import { updateContactAction, deleteContactAction } from "../actions";
import { ActivityComposer } from "../../activities/activity-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const contact = await prisma.contact.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      company: true,
      owner: { select: { id: true, name: true, email: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!contact) notFound();

  const [companies, owners] = await Promise.all([
    prisma.company.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
      select: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const update = updateContactAction.bind(null, id);
  const remove = deleteContactAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/crm/contacts" className="text-sm text-muted-foreground hover:underline">
            ← All contacts
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {contact.firstName} {contact.lastName ?? ""}
          </h1>
          <p className="text-sm text-muted-foreground">{contact.email ?? "No email"}</p>
          {contact.owner ? (
            <p className="text-xs text-muted-foreground">
              Owner: {contact.owner.name ?? contact.owner.email}
            </p>
          ) : null}
          {(() => {
            const tags = Array.isArray(contact.tags) ? (contact.tags as string[]) : [];
            return tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
            ) : null;
          })()}
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <ContactForm
        action={update}
        initial={{
          ...contact,
          tags: Array.isArray(contact.tags) ? (contact.tags as string[]) : [],
        }}
        companies={companies}
        owners={owners.map((m) => m.user)}
        submitLabel="Save changes"
      />

      <ActivityComposer contactId={contact.id} />

      <Card>
        <CardHeader><CardTitle>Activity timeline</CardTitle></CardHeader>
        <CardContent>
          {contact.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {contact.activities.map((a) => (
                <li key={a.id} className="border-l-2 border-muted pl-3">
                  <div className="text-sm font-medium">{a.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.type} · {new Date(a.createdAt).toLocaleString()}
                    {a.author ? ` · ${a.author.name ?? a.author.email}` : ""}
                  </div>
                  {a.body ? <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
