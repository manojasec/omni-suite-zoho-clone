import { Card } from "@/components/ui/card";
import { BarList, LineChart, StatCard } from "@/components/analytics/charts";
import type { DashboardWidget } from "@prisma/client";
import type { WidgetResult } from "@/modules/dashboards/runtime";

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function WidgetCard({ widget, result }: { widget: DashboardWidget; result: WidgetResult }) {
  if (result.kind === "ERROR") {
    return (
      <Card className="p-4 border-red-200">
        <div className="text-sm font-semibold">{widget.title}</div>
        <p className="mt-2 text-xs text-red-600">Error: {result.error}</p>
      </Card>
    );
  }

  if (result.kind === "KPI") {
    return (
      <StatCard
        title={widget.title}
        value={fmt(result.total)}
        hint={`${widget.metric.toLowerCase()}${widget.metricField ? ` of ${widget.metricField}` : ""} · last ${result.rangeDays}d`}
      />
    );
  }

  if (result.kind === "LINE") {
    return (
      <LineChart
        title={widget.title}
        points={result.series.map((s) => ({ label: s.date.slice(5), value: s.value }))}
        formatValue={fmt}
      />
    );
  }

  if (widget.kind === "TABLE") {
    return (
      <Card className="p-0 overflow-hidden">
        <div className="border-b bg-muted px-3 py-2 text-sm font-semibold">{widget.title}</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1 text-left">{widget.groupBy}</th>
              <th className="px-3 py-1 text-right">{widget.metric}</th>
            </tr>
          </thead>
          <tbody>
            {result.buckets.map((b) => (
              <tr key={b.key} className="border-t">
                <td className="px-3 py-1.5">{b.label}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmt(b.value)}</td>
              </tr>
            ))}
            {result.buckets.length === 0 ? <tr><td colSpan={2} className="px-3 py-3 text-center text-muted-foreground">No data.</td></tr> : null}
          </tbody>
        </table>
      </Card>
    );
  }

  // BAR | PIE both shown via BarList for simplicity
  return (
    <BarList
      title={widget.title}
      series={result.buckets.map((b) => ({ label: b.label, value: b.value }))}
      formatValue={fmt}
    />
  );
}
