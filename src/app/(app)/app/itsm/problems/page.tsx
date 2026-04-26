import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PROBLEM_STATUS_LABELS } from "@/modules/itsm/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700",
  INVESTIGATING: "bg-blue-100 text-blue-700",
  KNOWN_ERROR: "bg-rose-100 text-rose-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-zinc-100 text-zinc-700",
};

const priorityColor: Record<string, string> = {
  LOW: "text-emerald-700",
  MEDIUM: "text-amber-700",
  HIGH: "text-rose-700",
  URGENT: "text-rose-900 font-semibold",
};

export default async function ProblemsListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "view");

  const problems = await prisma.problem.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { number: "desc" },
    include: { asset: { select: { tag: true, name: true } } },
  });
  const canCreate = can(ctx.role, "problem", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Problems</h1>
          <p className="text-sm text-muted-foreground">
            Root-cause investigations with workarounds and resolutions.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/itsm/problems/new">
            <Button>New problem</Button>
          </Link>
        ) : null}
      </div>

      {problems.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No problems yet.
        </Card>
      ) : (
        <Card className="divide-y">
          {problems.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/itsm/problems/${p.id}`}
                  className="font-medium hover:underline"
                >
                  PRB-{p.number}: {p.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.asset ? `[${p.asset.tag}] ${p.asset.name}` : "No asset linked"}
                </p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className={"text-xs " + (priorityColor[p.priority] ?? "")}>
                  {p.priority}
                </span>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[p.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {PROBLEM_STATUS_LABELS[p.status]}
                </span>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
