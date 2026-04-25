import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import {
  WORKFLOW_STATUSES,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_TRIGGERS,
} from "@/modules/automation/schemas";
import {
  addWorkflowStepAction,
  deleteWorkflowAction,
  deleteWorkflowStepAction,
  enrollContactAction,
  exitEnrollmentAction,
  runDueEnrollmentsAction,
  updateWorkflowAction,
  updateWorkflowStatusAction,
} from "../actions";

export const dynamic = "force-dynamic";

const stepBadge: Record<string, string> = {
  WAIT_DAYS: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  SEND_EMAIL: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  ADD_TAG: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

function describeStep(s: {
  type: string;
  waitDays: number | null;
  emailSubject: string | null;
  tag: string | null;
}): string {
  if (s.type === "WAIT_DAYS") return `Wait ${s.waitDays ?? 0} day${s.waitDays === 1 ? "" : "s"}`;
  if (s.type === "SEND_EMAIL") return `Send email: ${s.emailSubject ?? "(untitled)"}`;
  if (s.type === "ADD_TAG") return `Add tag: ${s.tag ?? ""}`;
  return s.type;
}

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;

  const wf = await prisma.workflow.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      steps: { orderBy: { order: "asc" } },
      enrollments: {
        orderBy: { startedAt: "desc" },
        take: 100,
      },
    },
  });
  if (!wf) notFound();

  // Hydrate enrollment contacts in one query.
  const contactIds = wf.enrollments.map((e) => e.contactId);
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, workspaceId: ctx.workspaceId },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const eligibleContacts = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const canEdit = can(ctx.role, "workflow", "edit");
  const canManage = can(ctx.role, "workflow", "manage");
  const canDelete = can(ctx.role, "workflow", "delete");
  const canEnroll = can(ctx.role, "workflowEnrollment", "create");

  const active = wf.enrollments.filter((e) => e.status === "ACTIVE").length;
  const completed = wf.enrollments.filter((e) => e.status === "COMPLETED").length;
  const exited = wf.enrollments.filter((e) => e.status === "EXITED").length;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/automation" className="text-xs text-muted-foreground hover:underline">
          ← Workflows
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{wf.name}</h1>
          <span className="rounded border px-2 py-0.5 text-xs">{wf.status}</span>
          <span className="rounded border px-2 py-0.5 text-xs">{wf.trigger.replace("_", " ")}</span>
        </div>
        {wf.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{wf.description}</p>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Active</div><div className="text-2xl font-semibold">{active}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Completed</div><div className="text-2xl font-semibold">{completed}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Exited</div><div className="text-2xl font-semibold">{exited}</div></Card>
      </div>

      {canManage ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={updateWorkflowStatusAction.bind(null, wf.id)} className="flex items-center gap-2">
              <Label htmlFor="status" className="text-xs">Status</Label>
              <Select id="status" name="status" defaultValue={wf.status} className="w-40">
                {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Button type="submit" variant="outline" size="sm">Update</Button>
            </form>
            <form action={runDueEnrollmentsAction.bind(null, wf.id)}>
              <Button type="submit" variant="outline" size="sm">Run due steps now</Button>
            </form>
          </div>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Steps ({wf.steps.length})</h2>
        <ol className="space-y-2">
          {wf.steps.map((s, idx) => (
            <li key={s.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                <span className={`rounded px-2 py-0.5 text-xs ${stepBadge[s.type]}`}>{s.type.replace("_", " ")}</span>
                <span>{describeStep(s)}</span>
              </div>
              {canEdit ? (
                <form action={deleteWorkflowStepAction.bind(null, wf.id, s.id)}>
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              ) : null}
            </li>
          ))}
          {wf.steps.length === 0 ? (
            <li className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              No steps yet. Add a step below to start building your workflow.
            </li>
          ) : null}
        </ol>

        {canEdit ? (
          <form action={addWorkflowStepAction.bind(null, wf.id)} className="mt-4 grid gap-3 border-t pt-4 md:grid-cols-4">
            <div>
              <Label htmlFor="type">Step type</Label>
              <Select id="type" name="type" defaultValue="SEND_EMAIL">
                {WORKFLOW_STEP_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="waitDays">Wait (days)</Label>
              <Input id="waitDays" name="waitDays" type="number" min={1} max={365} placeholder="for WAIT_DAYS" />
            </div>
            <div>
              <Label htmlFor="tag">Tag</Label>
              <Input id="tag" name="tag" placeholder="for ADD_TAG" />
            </div>
            <div>
              <Label htmlFor="emailSubject">Email subject</Label>
              <Input id="emailSubject" name="emailSubject" placeholder="for SEND_EMAIL" />
            </div>
            <div className="md:col-span-4">
              <Label htmlFor="emailHtml">Email HTML</Label>
              <Textarea id="emailHtml" name="emailHtml" rows={4} placeholder="<p>Hello {{firstName}}</p>" />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" variant="outline">Add step</Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="p-6">
        <h2 className="mb-3 text-sm font-semibold">Enrollments ({wf.enrollments.length})</h2>

        {canEnroll && wf.steps.length > 0 ? (
          <form action={enrollContactAction.bind(null, wf.id)} className="mb-4 flex items-end gap-2">
            <div className="flex-1">
              <Label htmlFor="contactId">Enroll a contact</Label>
              <Select id="contactId" name="contactId" defaultValue="">
                <option value="" disabled>Select a contact…</option>
                {eligibleContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName ?? ""} {c.email ? `(${c.email})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">Enroll</Button>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 px-2">Contact</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2">Step</th>
                <th className="py-2 px-2">Next run</th>
                <th className="py-2 px-2">Started</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {wf.enrollments.map((e) => {
                const c = contactMap.get(e.contactId);
                return (
                  <tr key={e.id}>
                    <td className="py-2 px-2">
                      {c ? `${c.firstName} ${c.lastName ?? ""}`.trim() : "(deleted)"}
                      {c?.email ? <div className="text-xs text-muted-foreground">{c.email}</div> : null}
                    </td>
                    <td className="py-2 px-2">{e.status}</td>
                    <td className="py-2 px-2">
                      {e.currentStep + 1}/{wf.steps.length}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {e.status === "ACTIVE" ? e.nextRunAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="py-2 px-2 text-xs text-muted-foreground">
                      {e.startedAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2 px-2 text-right">
                      {e.status === "ACTIVE" && canEnroll ? (
                        <form action={exitEnrollmentAction.bind(null, wf.id, e.id)}>
                          <Button type="submit" variant="ghost" size="sm">Exit</Button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {wf.enrollments.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No enrollments yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Settings</h2>
          <form action={updateWorkflowAction.bind(null, wf.id)} className="grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={wf.name} required />
            </div>
            <div>
              <Label htmlFor="trigger">Trigger</Label>
              <Select id="trigger" name="trigger" defaultValue={wf.trigger}>
                {WORKFLOW_TRIGGERS.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </Select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={wf.description ?? ""} />
            </div>
            <div className="md:col-span-3 flex justify-end gap-2">
              <Button type="submit" variant="outline">Save changes</Button>
            </div>
          </form>
          {canDelete ? (
            <form action={deleteWorkflowAction.bind(null, wf.id)} className="mt-3 border-t pt-3">
              <Button type="submit" variant="destructive" size="sm">Delete workflow</Button>
            </form>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
