import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { pipelineCounts } from "@/modules/recruit/schemas";

export const dynamic = "force-dynamic";

export default async function RecruitHubPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "view");
  const wsId = ctx.workspaceId;
  const [openJobs, totalJobs, candidateCount, applications, upcoming] = await Promise.all([
    prisma.jobOpening.count({ where: { workspaceId: wsId, status: "OPEN" } }),
    prisma.jobOpening.count({ where: { workspaceId: wsId } }),
    prisma.candidate.count({ where: { workspaceId: wsId, status: "ACTIVE" } }),
    prisma.application.findMany({ where: { workspaceId: wsId }, select: { stage: true } }),
    prisma.interview.count({ where: { workspaceId: wsId, scheduledAt: { gte: new Date() } } }),
  ]);
  const counts = pipelineCounts(applications);

  const tiles = [
    { href: "/app/recruit/jobs", title: "Jobs", value: `${openJobs} open · ${totalJobs} total` },
    { href: "/app/recruit/candidates", title: "Candidates", value: `${candidateCount} active` },
    { href: "/app/recruit/pipeline", title: "Pipeline", value: `${counts.APPLIED + counts.SCREEN + counts.INTERVIEW + counts.OFFER} in flight` },
    { href: "/app/recruit/interviews", title: "Interviews", value: `${upcoming} upcoming` },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recruit</h1>
        <p className="text-sm text-muted-foreground">
          Job openings, candidate database, application pipeline, and interview scheduling.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href}><Card className="p-4 hover:bg-accent">
            <div className="text-xs uppercase text-muted-foreground">{t.title}</div>
            <div className="mt-1 text-lg font-semibold">{t.value}</div>
          </Card></Link>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Pipeline snapshot</h2>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7 text-center">
          {(["APPLIED", "SCREEN", "INTERVIEW", "OFFER", "HIRED", "REJECTED", "WITHDRAWN"] as const).map((s) => (
            <div key={s} className="rounded border bg-card p-3">
              <div className="text-2xl font-semibold tabular-nums">{counts[s]}</div>
              <div className="text-xs uppercase text-muted-foreground">{s}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
