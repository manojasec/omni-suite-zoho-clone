import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { WORKFLOW_TRIGGERS } from "@/modules/automation/schemas";
import { createWorkflowAction } from "./actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  PAUSED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
};

export default async function AutomationListPage() {
  const ctx = await requireSession();
  const canCreate = can(ctx.role, "workflow", "create");

  const workflows = await prisma.workflow.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { steps: true, enrollments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Marketing Automation</h1>
        <p className="text-sm text-muted-foreground">
          Build drip workflows that send emails, wait, and tag contacts automatically.
        </p>
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Create a workflow</h2>
          <form action={createWorkflowAction} className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Welcome series" required />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger</Label>
              <Select id="trigger" name="trigger" defaultValue="MANUAL">
                {WORKFLOW_TRIGGERS.map((t) => (
                  <option key={t} value={t}>{t.replace("_", " ")}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Create workflow</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="border-b p-4 text-sm font-semibold">Workflows ({workflows.length})</div>
        <div className="divide-y">
          {workflows.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No workflows yet.</p>
          ) : null}
          {workflows.map((w) => (
            <Link
              key={w.id}
              href={`/app/automation/${w.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{w.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${statusColor[w.status]}`}>{w.status}</span>
                  <span className="rounded border px-2 py-0.5 text-xs">{w.trigger.replace("_", " ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {w._count.steps} step{w._count.steps === 1 ? "" : "s"} · {w._count.enrollments} enrolled
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {w.createdAt.toISOString().slice(0, 10)}
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
