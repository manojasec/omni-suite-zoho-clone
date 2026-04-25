import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "interview", "view");
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    prisma.interview.findMany({
      where: { workspaceId: ctx.workspaceId, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      include: { application: { include: { candidate: true, job: true } } },
      take: 100,
    }),
    prisma.interview.findMany({
      where: { workspaceId: ctx.workspaceId, scheduledAt: { lt: now } },
      orderBy: { scheduledAt: "desc" },
      include: { application: { include: { candidate: true, job: true } } },
      take: 50,
    }),
  ]);

  const fmt = (d: Date) => d.toISOString().replace("T", " ").slice(0, 16);

  function Table({ rows, empty }: { rows: typeof upcoming; empty: string }) {
    return (
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">When</th>
              <th className="px-3 py-2 text-left">Kind</th>
              <th className="px-3 py-2 text-left">Candidate</th>
              <th className="px-3 py-2 text-left">Job</th>
              <th className="px-3 py-2 text-left">Interviewer</th>
              <th className="px-3 py-2 text-left">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((iv) => (
              <tr key={iv.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2">
                  <Link href={`/app/recruit/applications/${iv.applicationId}`} className="hover:underline">{fmt(iv.scheduledAt)}</Link>
                </td>
                <td className="px-3 py-2 text-xs">{iv.kind}</td>
                <td className="px-3 py-2">{iv.application.candidate.firstName} {iv.application.candidate.lastName}</td>
                <td className="px-3 py-2 text-muted-foreground">{iv.application.job.title}</td>
                <td className="px-3 py-2 text-muted-foreground">{iv.interviewer ?? ""}</td>
                <td className="px-3 py-2 text-xs">{iv.outcome}</td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{empty}</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
        <p className="text-sm text-muted-foreground">All scheduled interviews across the workspace.</p>
      </div>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Upcoming ({upcoming.length})</h2>
        <Table rows={upcoming} empty="No upcoming interviews." />
      </section>
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Past</h2>
        <Table rows={past} empty="No past interviews." />
      </section>
    </div>
  );
}
