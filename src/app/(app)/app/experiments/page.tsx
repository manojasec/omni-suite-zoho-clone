import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  RUNNING: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

export default async function ExperimentsListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "view");

  const experiments = await prisma.experiment.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { variants: true, assignments: true, events: true } },
    },
  });
  const canCreate = can(ctx.role, "experiment", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Experiments</h1>
          <p className="text-sm text-muted-foreground">
            A/B tests for landing pages, sites, and product flows.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/experiments/new">
            <Button>New experiment</Button>
          </Link>
        ) : null}
      </div>

      {experiments.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No experiments yet — create one to start measuring variants.
        </Card>
      ) : (
        <Card className="divide-y">
          {experiments.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <Link href={`/app/experiments/${e.id}`} className="font-medium hover:underline">
                  {e.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  /{e.slug} · {e._count.variants} variants · {e._count.assignments} visitors ·{" "}
                  {e._count.events} events
                </p>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[e.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {e.status}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
