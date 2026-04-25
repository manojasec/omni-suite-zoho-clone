import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "view");
  const cands = await prisma.candidate.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { applications: true } } },
  });
  const canCreate = can(ctx.role, "candidate", "create");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/app/recruit" className="text-xs text-muted-foreground hover:underline">← Recruit</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Candidates</h1>
        </div>
        {canCreate ? <Link href="/app/recruit/candidates/new"><Button>Add candidate</Button></Link> : null}
      </div>
      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Headline</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-right">Applications</th>
              <th className="px-3 py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {cands.map((c) => (
              <tr key={c.id} className="border-t hover:bg-accent">
                <td className="px-3 py-2">
                  <Link href={`/app/recruit/candidates/${c.id}`} className="font-medium hover:underline">{c.firstName} {c.lastName}</Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{c.email}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.headline ?? ""}</td>
                <td className="px-3 py-2 text-xs">{c.source ?? ""}</td>
                <td className="px-3 py-2 text-right tabular-nums">{c._count.applications}</td>
                <td className="px-3 py-2 text-right text-xs">{c.status === "ARCHIVED" ? <span className="rounded bg-muted px-2 py-0.5">Archived</span> : <span className="text-muted-foreground">Active</span>}</td>
              </tr>
            ))}
            {cands.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No candidates yet.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
