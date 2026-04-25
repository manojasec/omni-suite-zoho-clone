import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DealForm } from "../deal-form";
import { createDealAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string; contactId?: string; companyId?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;

  const [pipelines, stages, contacts, companies, memberships] = await Promise.all([
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
  ]);

  if (pipelines.length === 0) redirect("/app/sales/pipeline");

  const pipelineId = sp.pipelineId && pipelines.some((p) => p.id === sp.pipelineId)
    ? sp.pipelineId
    : pipelines[0].id;

  const firstStage = stages.find((s) => s.pipelineId === pipelineId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New deal</h1>
        <p className="text-sm text-muted-foreground">Track a new opportunity through your pipeline.</p>
      </div>
      <DealForm
        action={createDealAction}
        initial={{
          pipelineId,
          stageId: firstStage?.id,
          ownerId: ctx.userId,
          contactId: sp.contactId ?? null,
          companyId: sp.companyId ?? null,
          currency: "USD",
        }}
        pipelines={pipelines}
        stages={stages}
        contacts={contacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName ?? ""}`.trim() }))}
        companies={companies}
        owners={memberships.map((m) => m.user)}
        submitLabel="Create deal"
      />
    </div>
  );
}
