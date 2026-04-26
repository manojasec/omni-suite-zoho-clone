import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { runWidget } from "@/modules/dashboards/runtime";
import { WidgetCard } from "@/modules/dashboards/widget-card";
import {
  SOURCE_CATALOG,
  WIDGET_KINDS,
  WIDGET_METRICS,
  WIDGET_SOURCES,
} from "@/modules/dashboards/schemas";
import {
  addWidgetAction,
  deleteDashboardAction,
  deleteWidgetAction,
  moveWidgetAction,
  updateDashboardAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function DashboardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "view");
  const { id } = await params;
  const dash = await prisma.dashboard.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { widgets: { orderBy: { position: "asc" } } },
  });
  if (!dash) notFound();
  const canEdit = can(ctx.role, "dashboard", "edit");
  const canDelete = can(ctx.role, "dashboard", "delete");
  const canAddWidget = can(ctx.role, "dashboardWidget", "create");
  const canDeleteWidget = can(ctx.role, "dashboardWidget", "delete");
  const canEditWidget = can(ctx.role, "dashboardWidget", "edit");

  const results = await Promise.all(dash.widgets.map((w) => runWidget(w, ctx.workspaceId)));

  return (
    <div className="space-y-4">
      <Link href="/app/reports/dashboards" className="text-xs text-muted-foreground hover:underline">← Dashboards</Link>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dash.name}</h1>
          {dash.description ? <p className="text-sm text-muted-foreground">{dash.description}</p> : null}
        </div>
        {canDelete ? (
          <form action={deleteDashboardAction.bind(null, dash.id)}>
            <Button type="submit" variant="outline" size="sm">Delete</Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {dash.widgets.map((w, idx) => (
          <div key={w.id} className="space-y-1">
            <WidgetCard widget={w} result={results[idx]} />
            {(canDeleteWidget || canEditWidget) ? (
              <div className="flex gap-1 text-xs">
                {canEditWidget ? (
                  <>
                    <form action={moveWidgetAction.bind(null, w.id, "up")}>
                      <Button type="submit" variant="outline" size="sm" className="h-6 px-2">↑</Button>
                    </form>
                    <form action={moveWidgetAction.bind(null, w.id, "down")}>
                      <Button type="submit" variant="outline" size="sm" className="h-6 px-2">↓</Button>
                    </form>
                  </>
                ) : null}
                {canDeleteWidget ? (
                  <form action={deleteWidgetAction.bind(null, w.id)}>
                    <Button type="submit" variant="outline" size="sm" className="h-6 px-2">Remove</Button>
                  </form>
                ) : null}
                <span className="ml-auto text-muted-foreground">
                  {w.source} · {w.metric}{w.metricField ? `(${w.metricField})` : ""}
                </span>
              </div>
            ) : null}
          </div>
        ))}
        {dash.widgets.length === 0 ? (
          <p className="text-sm text-muted-foreground md:col-span-2 lg:col-span-3">No widgets yet. Add one below.</p>
        ) : null}
      </div>

      {canAddWidget ? (
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">Add widget</h2>
          <form action={addWidgetAction.bind(null, dash.id)} className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="kind">Visualization</Label>
              <Select id="kind" name="kind" defaultValue="KPI">
                {WIDGET_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="source">Data source</Label>
              <Select id="source" name="source" defaultValue="DEAL">
                {WIDGET_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_CATALOG[s].label}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="metric">Metric</Label>
              <Select id="metric" name="metric" defaultValue="COUNT">
                {WIDGET_METRICS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="metricField">Metric field (for SUM/AVG)</Label>
              <Input id="metricField" name="metricField" placeholder="e.g. value, total, amount" />
            </div>
            <div>
              <Label htmlFor="groupBy">Group by (for BAR/PIE/TABLE)</Label>
              <Input id="groupBy" name="groupBy" placeholder="e.g. status, stageId, ownerId" />
            </div>
            <div>
              <Label htmlFor="rangeDays">Range (days)</Label>
              <Input id="rangeDays" name="rangeDays" type="number" min={1} max={3650} defaultValue={30} />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Add widget</Button>
            </div>
          </form>
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Allowed fields per source</summary>
            <table className="mt-2 w-full text-xs">
              <thead><tr className="text-left"><th>Source</th><th>Group by</th><th>Metric fields</th></tr></thead>
              <tbody>
                {WIDGET_SOURCES.map((s) => (
                  <tr key={s} className="border-t">
                    <td className="py-1">{s}</td>
                    <td className="py-1">{SOURCE_CATALOG[s].groupBy.join(", ") || "—"}</td>
                    <td className="py-1">{SOURCE_CATALOG[s].metricFields.join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Settings</h2>
          <form action={updateDashboardAction.bind(null, dash.id)} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required defaultValue={dash.name} maxLength={160} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={3} maxLength={500} defaultValue={dash.description ?? ""} />
            </div>
            <div className="flex justify-end"><Button type="submit" variant="outline">Save</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
