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
  ISSUE_STATUSES,
  ISSUE_TYPES,
  canTransition,
} from "@/modules/bugs/schemas";
import {
  addIssueCommentAction,
  assignIssueAction,
  changeIssueStatusAction,
  deleteIssueAction,
  updateIssueAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const priorityColor: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIUM: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

const statusColor: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  RESOLVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CLOSED: "bg-muted text-muted-foreground",
  REOPENED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const issue = await prisma.issue.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      project: { select: { id: true, name: true, key: true } },
      reporter: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });
  if (!issue) notFound();

  const memberships = await prisma.membership.findMany({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { user: { email: "asc" } },
  });

  const canEdit = can(ctx.role, "issue", "edit");
  const canAssign = can(ctx.role, "issue", "assign");
  const canDelete = can(ctx.role, "issue", "delete");
  const canComment = can(ctx.role, "issueComment", "create");

  const allowedNextStatuses = ISSUE_STATUSES.filter((s) => canTransition(issue.status, s));

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/bugs/projects/${issue.project.id}`} className="text-xs text-muted-foreground hover:underline">
          ← {issue.project.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-muted-foreground">{issue.project.key}-{issue.number}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{issue.title}</h1>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded px-2 py-0.5 ${statusColor[issue.status]}`}>{issue.status.replace("_", " ")}</span>
          <span className={`rounded px-2 py-0.5 ${priorityColor[issue.priority]}`}>{issue.priority}</span>
          <span className="rounded border px-2 py-0.5">{issue.type}</span>
          <span className="rounded border px-2 py-0.5">{issue.severity}</span>
          {issue.tags ? issue.tags.split(",").map((t) => (
            <span key={t} className="rounded border px-2 py-0.5 text-muted-foreground">#{t}</span>
          )) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6 md:col-span-2 space-y-4">
          {issue.description ? (
            <div>
              <div className="text-xs uppercase text-muted-foreground">Description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{issue.description}</p>
            </div>
          ) : null}
          {issue.stepsToReproduce ? (
            <div>
              <div className="text-xs uppercase text-muted-foreground">Steps to reproduce</div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{issue.stepsToReproduce}</p>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {issue.expected ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground">Expected</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{issue.expected}</p>
              </div>
            ) : null}
            {issue.actual ? (
              <div>
                <div className="text-xs uppercase text-muted-foreground">Actual</div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{issue.actual}</p>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6 space-y-3 text-sm">
          <h2 className="text-sm font-semibold">Details</h2>
          <div><span className="text-muted-foreground">Reporter: </span>{issue.reporter.name ?? issue.reporter.email}</div>
          <div><span className="text-muted-foreground">Assignee: </span>{issue.assignee ? (issue.assignee.name ?? issue.assignee.email) : "—"}</div>
          {issue.environment ? <div><span className="text-muted-foreground">Environment: </span>{issue.environment}</div> : null}
          {issue.version ? <div><span className="text-muted-foreground">Version: </span>{issue.version}</div> : null}
          {issue.dueDate ? <div><span className="text-muted-foreground">Due: </span>{issue.dueDate.toISOString().slice(0, 10)}</div> : null}
          {issue.resolvedAt ? <div><span className="text-muted-foreground">Resolved: </span>{issue.resolvedAt.toISOString().slice(0, 10)}</div> : null}
          {issue.closedAt ? <div><span className="text-muted-foreground">Closed: </span>{issue.closedAt.toISOString().slice(0, 10)}</div> : null}
          <div className="text-xs text-muted-foreground">Created {issue.createdAt.toISOString().slice(0, 10)}</div>

          {canEdit && allowedNextStatuses.length > 1 ? (
            <form action={changeIssueStatusAction.bind(null, issue.id)} className="space-y-2 pt-2 border-t">
              <Label htmlFor="status">Move to</Label>
              <Select id="status" name="status" defaultValue={issue.status}>
                {allowedNextStatuses.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">Update status</Button>
            </form>
          ) : null}

          {canAssign ? (
            <form action={assignIssueAction.bind(null, issue.id)} className="space-y-2 pt-2 border-t">
              <Label htmlFor="assigneeId">Reassign</Label>
              <Select id="assigneeId" name="assigneeId" defaultValue={issue.assigneeId ?? ""}>
                <option value="">Unassigned</option>
                {memberships.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>
                ))}
              </Select>
              <Button type="submit" variant="outline" size="sm">Assign</Button>
            </form>
          ) : null}

          {canDelete ? (
            <form action={deleteIssueAction.bind(null, issue.id)} className="pt-2 border-t">
              <Button type="submit" variant="destructive" size="sm">Delete issue</Button>
            </form>
          ) : null}
        </Card>
      </div>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Edit issue</h2>
          <form action={updateIssueAction.bind(null, issue.id)} className="space-y-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" defaultValue={issue.title} required />
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select id="type" name="type" defaultValue={issue.type}>
                  {ISSUE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select id="priority" name="priority" defaultValue={issue.priority}>
                  {ISSUE_PRIORITIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select id="severity" name="severity" defaultValue={issue.severity}>
                  {ISSUE_SEVERITIES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select id="status" name="status" defaultValue={issue.status}>
                  {ISSUE_STATUSES.filter((s) => canTransition(issue.status, s)).map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} defaultValue={issue.description ?? ""} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="environment">Environment</Label>
                <Input id="environment" name="environment" defaultValue={issue.environment ?? ""} />
              </div>
              <div>
                <Label htmlFor="version">Version</Label>
                <Input id="version" name="version" defaultValue={issue.version ?? ""} />
              </div>
              <div>
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" defaultValue={issue.dueDate?.toISOString().slice(0, 10) ?? ""} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="stepsToReproduce">Steps to reproduce</Label>
                <Textarea id="stepsToReproduce" name="stepsToReproduce" rows={3} defaultValue={issue.stepsToReproduce ?? ""} />
              </div>
              <div>
                <Label htmlFor="expected">Expected</Label>
                <Textarea id="expected" name="expected" rows={3} defaultValue={issue.expected ?? ""} />
              </div>
              <div>
                <Label htmlFor="actual">Actual</Label>
                <Textarea id="actual" name="actual" rows={3} defaultValue={issue.actual ?? ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="assigneeId">Assignee</Label>
              <Select id="assigneeId" name="assigneeId" defaultValue={issue.assigneeId ?? ""}>
                <option value="">Unassigned</option>
                {memberships.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.name ?? m.user.email}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" name="tags" defaultValue={issue.tags ?? ""} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="outline">Save changes</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Comments ({issue.comments.length})</h2>
        <div className="space-y-3">
          {issue.comments.map((c) => (
            <div key={c.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.author.name ?? c.author.email}</span>
                <span>{c.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
          ))}
          {issue.comments.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">No comments yet.</p>
          ) : null}
        </div>
        {canComment ? (
          <form action={addIssueCommentAction.bind(null, issue.id)} className="mt-4 space-y-2">
            <Label htmlFor="body">Add a comment</Label>
            <Textarea id="body" name="body" rows={3} required />
            <div className="flex justify-end">
              <Button type="submit">Post comment</Button>
            </div>
          </form>
        ) : null}
      </Card>
    </div>
  );
}
