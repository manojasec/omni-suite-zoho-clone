import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { runPivot } from "@/modules/pivots/runtime";
import { SOURCE_CATALOG } from "@/modules/dashboards/schemas";
import { PivotForm } from "../pivot-form";
import { deletePivotReportAction, updatePivotReportAction } from "../actions";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default async function PivotReportPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "view");
  const { id } = await params;
  const report = await prisma.pivotReport.findFirst({ where: { id, workspaceId: ctx.workspaceId } });
  if (!report) notFound();

  const result = await runPivot(report, ctx.workspaceId).catch((e) => ({
    error: e instanceof Error ? e.message : "Failed to run",
  }));

  const canEdit = can(ctx.role, "pivotReport", "edit");
  const canDelete = can(ctx.role, "pivotReport", "delete");

  return (
    <div className="space-y-4">
      <Link href="/app/reports/pivots" className="text-xs text-muted-foreground hover:underline">← Pivot tables</Link>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{report.name}</h1>
          {report.description ? <p className="text-sm text-muted-foreground">{report.description}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {SOURCE_CATALOG[report.source].label} · last {report.rangeDays}d ·
            rows: <code>{report.rowField}</code>
            {report.colField ? <> · cols: <code>{report.colField}</code></> : null} ·
            {" "}{report.valueMetric}{report.valueField ? `(${report.valueField})` : ""}
          </p>
        </div>
        {canDelete ? (
          <form action={deletePivotReportAction.bind(null, report.id)}>
            <Button type="submit" variant="destructive" size="sm">Delete</Button>
          </form>
        ) : null}
      </div>

      <Card className="p-0 overflow-x-auto">
        {"error" in result ? (
          <div className="p-6 text-sm text-red-600">Error: {result.error}</div>
        ) : result.rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No data in the selected range.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">{report.rowField}</th>
                {result.hasColField ? (
                  result.cols.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right">{c.key}</th>
                  ))
                ) : (
                  <th className="px-3 py-2 text-right">{report.valueMetric}</th>
                )}
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.key}</td>
                  {result.hasColField ? (
                    result.cols.map((c) => (
                      <td key={c.key} className="px-3 py-2 text-right tabular-nums">
                        {fmt(result.cells[r.key]?.[c.key] ?? 0)}
                      </td>
                    ))
                  ) : (
                    <td className="px-3 py-2 text-right tabular-nums">
                      {fmt(result.cells[r.key]?._total ?? 0)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(r.total)}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/50">
                <td className="px-3 py-2 font-semibold">Total</td>
                {result.hasColField ? (
                  result.cols.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(c.total)}</td>
                  ))
                ) : (
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(result.grandTotal)}</td>
                )}
                <td className="px-3 py-2 text-right font-bold tabular-nums">{fmt(result.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Edit</h2>
          <PivotForm
            action={updatePivotReportAction.bind(null, report.id)}
            submitLabel="Save changes"
            defaults={{
              name: report.name,
              description: report.description,
              source: report.source,
              rowField: report.rowField,
              colField: report.colField,
              valueMetric: report.valueMetric,
              valueField: report.valueField,
              rangeDays: report.rangeDays,
            }}
          />
        </Card>
      ) : null}
    </div>
  );
}
