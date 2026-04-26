import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SOURCE_CATALOG } from "@/modules/dashboards/schemas";

export const dynamic = "force-dynamic";

export default async function PivotsListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "view");
  const reports = await prisma.pivotReport.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Pivot tables</h1>
        <Link href="/app/reports/pivots/new"><Button>New pivot</Button></Link>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Rows</th>
              <th className="px-3 py-2 text-left">Cols</th>
              <th className="px-3 py-2 text-left">Metric</th>
              <th className="px-3 py-2 text-right">Updated</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link href={`/app/reports/pivots/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                </td>
                <td className="px-3 py-2">{SOURCE_CATALOG[r.source].label}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.rowField}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.colField ?? "—"}</td>
                <td className="px-3 py-2">{r.valueMetric}{r.valueField ? `(${r.valueField})` : ""}</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{r.updatedAt.toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {reports.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No pivot reports yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
