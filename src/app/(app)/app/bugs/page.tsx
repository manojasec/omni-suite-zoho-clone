import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createIssueProjectAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BugsHomePage() {
  const ctx = await requireSession();
  const projects = await prisma.issueProject.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { issues: true } },
    },
  });
  const open = await prisma.issue.groupBy({
    by: ["projectId", "status"],
    where: { workspaceId: ctx.workspaceId },
    _count: { _all: true },
  });
  const openByProject = new Map<string, number>();
  for (const o of open) {
    if (o.status === "OPEN" || o.status === "IN_PROGRESS" || o.status === "REOPENED") {
      openByProject.set(o.projectId, (openByProject.get(o.projectId) ?? 0) + o._count._all);
    }
  }

  const totals = await prisma.issue.groupBy({
    by: ["status"],
    where: { workspaceId: ctx.workspaceId },
    _count: { _all: true },
  });
  const tile = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0;

  const canCreateProject = can(ctx.role, "issueProject", "create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bug Tracker</h1>
        <p className="text-sm text-muted-foreground">Track bugs, features, tasks across all your engineering projects.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"] as const).map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{s.replace("_", " ")}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{tile(s)}</div>
          </Card>
        ))}
      </div>

      {canCreateProject ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New project</h2>
          <form action={createIssueProjectAction} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Project name *</Label>
                <Input id="name" name="name" required placeholder="Web app" />
              </div>
              <div>
                <Label htmlFor="key">Key (2–6 letters) *</Label>
                <Input id="key" name="key" required placeholder="WEB" maxLength={6} />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create project</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Project</th>
              <th className="px-4 py-2 font-medium">Key</th>
              <th className="px-4 py-2 font-medium tabular-nums">Total</th>
              <th className="px-4 py-2 font-medium tabular-nums">Active</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className={`border-t hover:bg-accent/30 ${p.archived ? "opacity-60" : ""}`}>
                <td className="px-4 py-2">
                  <Link href={`/app/bugs/projects/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                    {p.archived ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">archived</span> : null}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{p.key}</td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">{p._count.issues}</td>
                <td className="px-4 py-2 tabular-nums">{openByProject.get(p.id) ?? 0}</td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No projects yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
