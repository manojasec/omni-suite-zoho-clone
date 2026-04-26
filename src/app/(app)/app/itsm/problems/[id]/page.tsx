import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea, Select } from "@/components/ui/input";
import {
  PRIORITIES,
  PROBLEM_STATUS_LABELS,
  PROBLEM_TRANSITIONS,
} from "@/modules/itsm/schemas";
import {
  deleteProblemAction,
  resolveProblemAction,
  transitionProblemAction,
  updateProblemAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "problem", "view");

  const problem = await prisma.problem.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { asset: { select: { id: true, tag: true, name: true } } },
  });
  if (!problem) notFound();

  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { tag: "asc" },
    select: { id: true, tag: true, name: true },
  });

  const canEdit = can(ctx.role, "problem", "edit");
  const canDelete = can(ctx.role, "problem", "delete");
  const editable = problem.status !== "CLOSED";
  const transitions = PROBLEM_TRANSITIONS[problem.status] ?? [];

  const updateBound = updateProblemAction.bind(null, problem.id);
  const transitionBound = transitionProblemAction.bind(null, problem.id);
  const resolveBound = resolveProblemAction.bind(null, problem.id);
  const deleteBound = deleteProblemAction.bind(null, problem.id);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            PRB-{problem.number}: {problem.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {PROBLEM_STATUS_LABELS[problem.status]} · {problem.priority}
            {problem.resolvedAt
              ? ` · resolved ${problem.resolvedAt.toISOString().slice(0, 10)}`
              : ""}
          </p>
        </div>
        {canDelete ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      {transitions.length > 0 && canEdit ? (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm text-muted-foreground">Transition →</span>
          {transitions.map((t) => (
            <form key={t} action={transitionBound}>
              <input type="hidden" name="to" value={t} />
              <Button type="submit" size="sm" variant="outline">
                {PROBLEM_STATUS_LABELS[t]}
              </Button>
            </form>
          ))}
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <form action={updateBound} className="grid gap-3">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                defaultValue={problem.title}
                disabled={!canEdit || !editable}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  id="priority"
                  name="priority"
                  defaultValue={problem.priority}
                  disabled={!canEdit || !editable}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="assetId">Asset</Label>
                <Select
                  id="assetId"
                  name="assetId"
                  defaultValue={problem.assetId ?? ""}
                  disabled={!canEdit || !editable}
                >
                  <option value="">— None —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      [{a.tag}] {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={problem.description ?? ""}
                disabled={!canEdit || !editable}
              />
            </div>
            <div>
              <Label htmlFor="workaround">Workaround</Label>
              <Textarea
                id="workaround"
                name="workaround"
                rows={2}
                defaultValue={problem.workaround ?? ""}
                disabled={!canEdit || !editable}
              />
            </div>
            <div>
              <Label htmlFor="rootCause">Root cause</Label>
              <Textarea
                id="rootCause"
                name="rootCause"
                rows={2}
                defaultValue={problem.rootCause ?? ""}
                disabled={!canEdit || !editable}
              />
            </div>
            {canEdit && editable ? (
              <div className="flex justify-end">
                <Button type="submit">Save</Button>
              </div>
            ) : null}
          </form>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Resolution</h2>
          {problem.resolution ? (
            <p className="whitespace-pre-wrap text-sm">{problem.resolution}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not yet resolved.</p>
          )}
          {canEdit && editable && problem.status !== "RESOLVED" ? (
            <form action={resolveBound} className="mt-3 space-y-2">
              <Label htmlFor="resolution">Mark as resolved</Label>
              <Textarea id="resolution" name="resolution" rows={3} required />
              <div className="flex justify-end">
                <Button type="submit">Resolve</Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
