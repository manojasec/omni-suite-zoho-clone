import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "view");
  const jobs = await prisma.jobOpening.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { applications: true } } },
  });
  const canCreate = can(ctx.role, "jobOpening", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/recruit" className="text-xs text-muted-foreground hover:underline">← Recruit</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Job openings</h1>
        </div>
        {canCreate ? <Link href="/app/recruit/jobs/new"><Button>New job</Button></Link> : null}
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Department</th>
              <th className="px-3 py-2 text-left">Location</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Applications</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} className="border-t hover:bg-accent">
                <td className="px-3 py-2"><Link href={`/app/recruit/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link></td>
                <td className="px-3 py-2 text-muted-foreground">{j.department ?? ""}</td>
                <td className="px-3 py-2 text-muted-foreground">{j.location ?? ""}{j.remote ? " · Remote" : ""}</td>
                <td className="px-3 py-2 text-xs">{j.employment.replace("_", " ")}</td>
                <td className="px-3 py-2">
                  <span className={
                    j.status === "OPEN" ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" :
                    j.status === "CLOSED" ? "rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-800 dark:bg-rose-950 dark:text-rose-200" :
                    j.status === "ON_HOLD" ? "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200" :
                    "rounded bg-muted px-2 py-0.5 text-xs"
                  }>{j.status}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{j._count.applications}</td>
              </tr>
            ))}
            {jobs.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No jobs yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
