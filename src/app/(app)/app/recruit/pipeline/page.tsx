import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APPLICATION_STAGES, isValidStageTransition } from "@/modules/recruit/schemas";
import { moveApplicationStageAction } from "../actions";

export const dynamic = "force-dynamic";

const ACTIVE_STAGES = ["APPLIED", "SCREEN", "INTERVIEW", "OFFER"] as const;

export default async function PipelinePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "application", "view");
  const apps = await prisma.application.findMany({
    where: { workspaceId: ctx.workspaceId, stage: { in: [...ACTIVE_STAGES] } },
    orderBy: { appliedAt: "desc" },
    include: {
      candidate: { select: { firstName: true, lastName: true, email: true } },
      job: { select: { title: true } },
    },
  });
  const canMove = can(ctx.role, "application", "edit");

  const grouped = new Map<string, typeof apps>();
  for (const s of ACTIVE_STAGES) grouped.set(s, []);
  for (const a of apps) grouped.get(a.stage)?.push(a);

  return (
    <div className="space-y-4">
      <div>
        <Link href="/app/recruit" className="text-xs text-muted-foreground hover:underline">← Recruit</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Application pipeline</h1>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {ACTIVE_STAGES.map((stage) => {
          const list = grouped.get(stage) ?? [];
          return (
            <Card key={stage} className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase">{stage}</span>
                <span className="text-xs text-muted-foreground">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.map((a) => (
                  <div key={a.id} className="rounded border bg-card p-2 text-sm">
                    <Link href={`/app/recruit/applications/${a.id}`} className="font-medium hover:underline">
                      {a.candidate.firstName} {a.candidate.lastName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.job.title}</div>
                    {canMove ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {APPLICATION_STAGES.filter((s) => s !== a.stage && isValidStageTransition(a.stage, s)).map((s) => (
                          <form key={s} action={moveApplicationStageAction.bind(null, a.id, s)}>
                            <Button type="submit" size="sm" variant="outline" className="h-6 px-2 text-xs">
                              → {s}
                            </Button>
                          </form>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {list.length === 0 ? <div className="rounded border border-dashed p-2 text-center text-xs text-muted-foreground">Empty</div> : null}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
