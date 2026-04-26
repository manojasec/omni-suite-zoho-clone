import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SurveysPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "view");
  const surveys = await prisma.survey.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { questions: true, responses: true } } },
  });
  const canCreate = can(ctx.role, "survey", "create");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
          <p className="text-sm text-muted-foreground">Multi-question surveys with ratings, choices, and analytics.</p>
        </div>
        {canCreate ? <Link href="/app/surveys/new"><Button>New survey</Button></Link> : null}
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Questions</th>
              <th className="px-3 py-2 text-right">Responses</th>
              <th className="px-3 py-2 text-left">Updated</th>
            </tr>
          </thead>
          <tbody>
            {surveys.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-3 py-2"><Link href={`/app/surveys/${s.id}`} className="font-medium hover:underline">{s.title}</Link></td>
                <td className="px-3 py-2 text-xs">{s.status}</td>
                <td className="px-3 py-2 text-right">{s._count.questions}</td>
                <td className="px-3 py-2 text-right">{s._count.responses}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {surveys.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No surveys yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
