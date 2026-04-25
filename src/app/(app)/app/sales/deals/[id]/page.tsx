import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DealForm } from "../deal-form";
import { updateDealAction, deleteDealAction } from "../actions";
import { DealStatusPanel } from "../deal-status-panel";
import { ActivityComposer } from "@/app/(app)/app/crm/activities/activity-composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();

  const deal = await prisma.deal.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      stage: true,
      pipeline: true,
      contact: true,
      company: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!deal) notFound();

  const [pipelines, stages, contacts, companies, memberships, activities] = await Promise.all([
    prisma.pipeline.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.stage.findMany({
      where: { pipeline: { workspaceId: ctx.workspaceId } },
      orderBy: { order: "asc" },
      select: { id: true, name: true, pipelineId: true },
    }),
    prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.company.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true },
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.activity.findMany({
      where: { workspaceId: ctx.workspaceId, dealId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { author: { select: { name: true, email: true } } },
    }),
  ]);

  const update = updateDealAction.bind(null, id);
  const remove = deleteDealAction.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/sales/deals" className="text-sm text-muted-foreground hover:underline">
            ← All deals
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{deal.name}</h1>
          <p className="text-sm text-muted-foreground">
            {Number(deal.value).toLocaleString()} {deal.currency} · {deal.pipeline.name} / {deal.stage.name}
          </p>
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm">Delete</Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <DealForm
          action={update}
          initial={{
            name: deal.name,
            value: deal.value.toString(),
            currency: deal.currency,
            pipelineId: deal.pipelineId,
            stageId: deal.stageId,
            contactId: deal.contactId,
            companyId: deal.companyId,
            ownerId: deal.ownerId,
            expectedCloseAt: deal.expectedCloseAt?.toISOString() ?? null,
          }}
          pipelines={pipelines}
          stages={stages}
          contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
          companies={companies}
          owners={memberships.map((m) => m.user)}
          submitLabel="Save changes"
        />

        <DealStatusPanel
          dealId={deal.id}
          status={deal.status}
          lostReason={deal.lostReason}
        />
      </div>

      <ActivityComposer dealId={deal.id} />

      <Card>
        <CardHeader><CardTitle>Activity ({activities.length})</CardTitle></CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activities yet.</p>
          ) : (
            <ul className="divide-y">
              {activities.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {a.type} · {a.author?.name ?? a.author?.email ?? "system"}
                    </span>
                    <span>{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{a.subject}</p>
                  {a.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
