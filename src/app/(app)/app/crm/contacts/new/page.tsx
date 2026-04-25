import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ContactForm } from "../contact-form";
import { createContactAction } from "../actions";

export default async function NewContactPage() {
  const ctx = await requireSession();
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New contact</h1>
        <p className="text-sm text-muted-foreground">Add someone to your CRM.</p>
      </div>
      <ContactForm
        action={createContactAction}
        initial={{ ownerId: ctx.userId }}
        companies={companies}
        owners={owners.map((m) => m.user)}
        submitLabel="Create contact"
      />
    </div>
  );
}
