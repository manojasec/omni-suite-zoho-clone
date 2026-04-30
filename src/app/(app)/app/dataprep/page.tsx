import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createDatasetAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function DataPrepListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "dataPrepDataset", "view");
  const canCreate = can(ctx.role, "dataPrepDataset", "create");

  const datasets = await prisma.dataPrepDataset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { _count: { select: { rules: true, runs: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data prep</h1>
        <p className="text-sm text-muted-foreground">
          Clean and shape data before loading it into reports or other modules.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">New dataset</h2>
          <form action={createDatasetAction} className="grid gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="sourceType">Source</Label>
              <select
                id="sourceType"
                name="sourceType"
                defaultValue="csv"
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="json">JSON</option>
                <option value="api">API</option>
              </select>
            </div>
            <div className="sm:col-span-4">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" maxLength={500} />
            </div>
            <div className="sm:col-span-4 flex justify-end">
              <Button type="submit">Create dataset</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {datasets.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No datasets yet. Create one above to start cleaning data.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {datasets.map((d) => (
            <Link
              key={d.id}
              href={`/app/dataprep/${d.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">
                  {d.sourceType.toUpperCase()} · {d._count.rules} rules ·{" "}
                  {d._count.runs} runs · {d.rowCount.toLocaleString()} rows
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {d.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
