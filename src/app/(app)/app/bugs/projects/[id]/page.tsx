import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import {
  ISSUE_PRIORITIES,
  ISSUE_SEVERITIES,
  ISSUE_TYPES,
} from "@/modules/bugs/schemas";
import {
  archiveIssueProjectAction,
  createIssueAction,
  updateIssueProjectAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const priorityColor: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

const COLUMNS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const proj = await prisma.issueProject.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!proj) notFound();

  const issues = await prisma.issue.findMany({
    where: { workspaceId: ctx.workspaceId, projectId: id },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    include: {
      assignee: { select: { name: true, email: true } },
    },
    take: 500,
  });

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { email: "asc" } },
  });

  const canEditProject = can(ctx.role, "issueProject", "edit");
  const canCreateIssue = can(ctx.role, "issue", "create");

  const byColumn: Record<string, typeof issues> = { OPEN: [], IN_PROGRESS: [], RESOLVED: [], CLOSED: [] };
  for (const i of issues) {
    const col = i.status === "REOPENED" ? "OPEN" : i.status;
    (byColumn[col] ?? byColumn.OPEN!).push(i);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/bugs" className="text-xs text-muted-foreground hover:underline">← All projects</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{proj.name} <span className="text-muted-foreground font-mono text-base">[{proj.key}]</span></h1>
          {proj.description ? <p className="text-sm text-muted-foreground">{proj.description}</p> : null}
        </div>
        {canEditProject ? (
          <form action={archiveIssueProjectAction.bind(null, proj.id)}>
            <Button type="submit" variant="outline" size="sm">{proj.archived ? "Unarchive" : "Archive"}</Button>
          </form>
        ) : null}
      </div>

      {canCreateIssue && !proj.archived ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Report an issue</h2>
          <form action={createIssueAction} className="space-y-3">
            <input type="hidden" name="projectId" value={proj.id} />
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required placeholder="Short summary" />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue="BUG">
                  {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" name="priority" defaultValue="MEDIUM">
                  {ISSUE_PRIORITIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select id="severity" name="severity" defaultValue="MINOR">
                  {ISSUE_SEVERITIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="assigneeId">Assignee</Label>
                <Select id="assigneeId" name="assigneeId" defaultValue="">
                  <option value="">Unassigned</option>
                  {memberships.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="environment">Environment</Label>
                <Input id="environment" name="environment" placeholder="Chrome 120 / macOS" />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" name="version" placeholder="1.4.2" />
              </div>
              <div>
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="stepsToReproduce">Steps to reproduce</Label>
                <Textarea id="stepsToReproduce" name="stepsToReproduce" rows={3} />
              </div>
              <div>
                <Label htmlFor="expected">Expected</Label>
                <Textarea id="expected" name="expected" rows={3} />
              </div>
              <div>
                <Label htmlFor="actual">Actual</Label>
                <Textarea id="actual" name="actual" rows={3} />
              </div>
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" name="tags" placeholder="frontend, regression" />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create issue</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {canEditProject ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Project settings</h2>
          <form action={updateIssueProjectAction.bind(null, proj.id)} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="p_name">Name</Label>
                <Input id="p_name" name="name" defaultValue={proj.name} required />
              </div>
              <div>
                <Label htmlFor="p_key">Key</Label>
                <Input id="p_key" name="key" defaultValue={proj.key} maxLength={6} required />
              </div>
            </div>
            <div>
              <Label htmlFor="p_description">Description</Label>
              <Textarea id="p_description" name="description" defaultValue={proj.description ?? ""} rows={2} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline">Save</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-semibold">Board</h2>
        <div className="grid gap-3 md:grid-cols-4">
          {COLUMNS.map((col) => (
            <Card key={col} className="p-3">
              <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>{col.replace("_", " ")}</span>
                <span className="tabular-nums">{(byColumn[col] ?? []).length}</span>
              </div>
              <div className="space-y-2">
                {(byColumn[col] ?? []).map((i) => (
                  <Link key={i.id} href={`/app/bugs/issues/${i.id}`}
                    className="block rounded-md border bg-background p-2 hover:bg-accent">
                    <div className="text-xs font-mono text-muted-foreground">{proj.key}-{i.number}</div>
                    <div className="text-sm font-medium">{i.title}</div>
                    <div className="mt-1 flex items-center justify-between text-[10px]">
                      <span className={`rounded px-1.5 py-0.5 ${priorityColor[i.priority]}`}>{i.priority}</span>
                      <span className="text-muted-foreground">{i.assignee ? (i.assignee.name ?? i.assignee.email).split("@")[0] : "—"}</span>
                    </div>
                  </Link>
                ))}
                {(byColumn[col] ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">Empty</div>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
