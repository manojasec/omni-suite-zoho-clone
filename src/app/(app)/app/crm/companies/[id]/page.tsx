import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { CompanyForm } from "../company-form";
import { updateCompanyAction, deleteCompanyAction } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const company = await prisma.company.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      contacts: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, firstName: true, lastName: true, email: true, lifecycleStage: true },
      },
      deals: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, name: true, value: true, currency: true, status: true },
      },
    },
  });
  if (!company) notFound();

  const update = updateCompanyAction.bind(null, id);
  const remove = deleteCompanyAction.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/crm/companies" className="text-sm text-muted-foreground hover:underline">
            ← All companies
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{company.name}</h1>
          {company.domain ? (
            <p className="text-sm text-muted-foreground">{company.domain}</p>
          ) : null}
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <CompanyForm action={update} initial={company} submitLabel="Save changes" />

      <Card>
        <CardHeader><CardTitle>Contacts ({company.contacts.length})</CardTitle></CardHeader>
        <CardContent>
          {company.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
          ) : (
            <ul className="divide-y">
              {company.contacts.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link href={`/app/crm/contacts/${c.id}`} className="text-sm hover:underline">
                    {c.firstName} {c.lastName ?? ""}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {c.email ?? "—"} · {c.lifecycleStage}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Deals ({company.deals.length})</CardTitle></CardHeader>
        <CardContent>
          {company.deals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deals yet.</p>
          ) : (
            <ul className="divide-y">
              {company.deals.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <Link href={`/app/sales/deals/${d.id}`} className="text-sm hover:underline">
                    {d.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {d.value.toString()} {d.currency} · {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
