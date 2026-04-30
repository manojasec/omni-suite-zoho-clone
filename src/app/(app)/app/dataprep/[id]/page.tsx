import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  DATA_PREP_RULE_KINDS,
  DATA_PREP_RULE_LABELS,
} from "@/modules/dataprep/schemas";
import {
  addRuleAction,
  deleteRuleAction,
  deleteDatasetAction,
  runDatasetAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function DatasetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "view");
  const canEdit = can(ctx.role, "dataPrepDataset", "edit");
  const canDelete = can(ctx.role, "dataPrepDataset", "delete");

  const dataset = await prisma.dataPrepDataset.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      rules: { orderBy: { position: "asc" } },
      runs: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!dataset) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dataset.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dataset.description || `${dataset.sourceType.toUpperCase()} dataset`}
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit ? (
            <form action={runDatasetAction.bind(null, dataset.id)}>
              <Button type="submit">Run pipeline</Button>
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteDatasetAction.bind(null, dataset.id)}>
              <Button type="submit" variant="ghost">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Status</div>
          <div className="text-lg font-semibold">{dataset.status}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Rows</div>
          <div className="text-lg font-semibold">
            {dataset.rowCount.toLocaleString()}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Rules</div>
          <div className="text-lg font-semibold">{dataset.rules.length}</div>
        </Card>
      </div>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Cleaning rules</h2>
        {dataset.rules.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No rules added yet. Add a transformation step below.
          </p>
        ) : (
          <ol className="space-y-2 text-sm">
            {dataset.rules.map((r, i) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded border px-3 py-2"
              >
                <span>
                  <span className="text-xs text-muted-foreground">
                    {i + 1}.
                  </span>{" "}
                  {DATA_PREP_RULE_LABELS[r.kind]}
                  {r.column ? ` — column ${r.column}` : ""}
                </span>
                {canEdit ? (
                  <form
                    action={deleteRuleAction.bind(null, dataset.id, r.id)}
                  >
                    <Button type="submit" size="sm" variant="ghost">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ol>
        )}

        {canEdit ? (
          <form
            action={addRuleAction.bind(null, dataset.id)}
            className="grid gap-3 sm:grid-cols-3"
          >
            <div>
              <Label htmlFor="kind">Rule</Label>
              <select
                id="kind"
                name="kind"
                className="h-9 w-full rounded border bg-background px-2 text-sm"
                defaultValue="TRIM"
              >
                {DATA_PREP_RULE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DATA_PREP_RULE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="column">Column (optional)</Label>
              <Input id="column" name="column" maxLength={120} />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" size="sm">
                Add rule
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">Recent runs</h2>
        {dataset.runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No runs yet. Click "Run pipeline" above to apply your rules.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {dataset.runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span>
                  {r.startedAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
                  {r.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {r.rowsBefore.toLocaleString()} →{" "}
                  {r.rowsAfter.toLocaleString()} rows · {r.rulesApplied} rules
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
