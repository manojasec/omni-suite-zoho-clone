import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { can } from "@/platform/permissions";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { PipelineBoard } from "./pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ pipelineId?: string }>;
}) {
  const ctx = await requireSession();
  const sp = await searchParams;

  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, isDefault: true },
  });

  if (pipelines.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">No pipelines yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Run the seed script to create the default sales pipeline.
        </p>
      </div>
    );
  }

  const activeId =
    sp.pipelineId && pipelines.some((p) => p.id === sp.pipelineId)
      ? sp.pipelineId
      : pipelines[0].id;

  const [stages, deals] = await Promise.all([
    prisma.stage.findMany({
      where: { pipelineId: activeId },
      orderBy: { order: "asc" },
      select: { id: true, name: true, probability: true },
    }),
    prisma.deal.findMany({
      where: { workspaceId: ctx.workspaceId, pipelineId: activeId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        name: true,
        value: true,
        currency: true,
        status: true,
        stageId: true,
        owner: { select: { name: true, email: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const cards = deals.map((d) => ({
    id: d.id,
    name: d.name,
    value: d.value.toString(),
    currency: d.currency,
    status: d.status,
    stageId: d.stageId,
    ownerName: d.owner ? d.owner.name ?? d.owner.email : null,
    contactName: d.contact ? `${d.contact.firstName} ${d.contact.lastName ?? ""}`.trim() : null,
  }));

  const totalOpen = cards
    .filter((c) => c.status === "OPEN")
    .reduce((acc, d) => acc + Number(d.value), 0);

  const canEdit = can(ctx.role, "deal", "edit");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Open total: {totalOpen.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>
        <Link href={`/app/sales/deals/new?pipelineId=${activeId}`}>
          <Button><Plus className="h-4 w-4" /> New deal</Button>
        </Link>
      </div>

      {pipelines.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {pipelines.map((p) => {
            const active = p.id === activeId;
            return (
              <Link
                key={p.id}
                href={`/app/sales/pipeline?pipelineId=${p.id}`}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-accent"
                }`}
              >
                {p.name}
              </Link>
            );
          })}
        </div>
      ) : null}

      <PipelineBoard stages={stages} initialDeals={cards} canEdit={canEdit} />
    </div>
  );
}
