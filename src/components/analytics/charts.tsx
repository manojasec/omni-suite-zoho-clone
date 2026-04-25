import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type Series = { label: string; value: number; sub?: string };

/** Stat card used across analytics dashboards. */
export function StatCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

/** Horizontal SVG bar chart — server-renderable, no client JS. */
export function BarList({
  title,
  series,
  formatValue = (v) => v.toLocaleString(),
  emptyHint = "No data yet.",
}: {
  title: string;
  series: Series[];
  formatValue?: (v: number) => string;
  emptyHint?: string;
}) {
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {series.length === 0 || max === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyHint}</p>
        ) : (
          <ul className="space-y-2">
            {series.map((s) => {
              const pct = Math.round((s.value / max) * 100);
              return (
                <li key={s.label} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatValue(s.value)}
                      {s.sub ? <span className="ml-1">· {s.sub}</span> : null}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${pct}%` }}
                      aria-label={`${s.label}: ${formatValue(s.value)}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact SVG line chart for time-series. Renders on the server.
 */
export function LineChart({
  title,
  points,
  formatValue = (v) => v.toLocaleString(),
}: {
  title: string;
  points: { label: string; value: number }[];
  formatValue?: (v: number) => string;
}) {
  const W = 480;
  const H = 140;
  const PAD = 24;
  const max = Math.max(1, ...points.map((p) => p.value));
  const stepX = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const path = points
    .map((p, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - (p.value / max) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {points.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img" aria-label={title}>
            <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="stroke-border" strokeWidth={1} />
            <path d={path} className="fill-none stroke-primary" strokeWidth={2} />
            {points.map((p, i) => {
              const x = PAD + i * stepX;
              const y = H - PAD - (p.value / max) * (H - PAD * 2);
              return (
                <g key={p.label}>
                  <circle cx={x} cy={y} r={2.5} className="fill-primary" />
                  <text
                    x={x}
                    y={H - 6}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
            <text x={PAD} y={14} className="fill-muted-foreground text-[10px]">
              max {formatValue(max)}
            </text>
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
