import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { summarizeEvents, formatRate } from "@/modules/experiments/schemas";
import {
  startExperimentAction,
  pauseExperimentAction,
  completeExperimentAction,
  deleteExperimentAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  RUNNING: "bg-emerald-100 text-emerald-700",
  PAUSED: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "experiment", "view");
  const { id } = await params;

  const exp = await prisma.experiment.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { variants: { orderBy: { isControl: "desc" } } },
  });
  if (!exp) notFound();

  const events = await prisma.experimentEvent.findMany({
    where: { experimentId: id },
    select: { variantKey: true, kind: true },
  });
  const summary = summarizeEvents(events);
  const controlKey = exp.variants.find((v) => v.isControl)?.key;
  const controlRate = controlKey ? summary[controlKey]?.rate ?? 0 : 0;

  const canEdit = can(ctx.role, "experiment", "edit");
  const canDelete = can(ctx.role, "experiment", "delete");

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/experiments" className="hover:underline">← Experiments</Link>
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{exp.name}</h1>
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[exp.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {exp.status}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          /{exp.slug}
          {exp.primaryMetric ? ` · metric: ${exp.primaryMetric}` : ""}
        </p>
      </div>

      {exp.hypothesis ? (
        <Card className="p-3 text-sm">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Hypothesis</span>
          <p className="mt-1 whitespace-pre-wrap">{exp.hypothesis}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Variant</th>
              <th className="px-3 py-2 text-right">Weight</th>
              <th className="px-3 py-2 text-right">Views</th>
              <th className="px-3 py-2 text-right">Conversions</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Lift vs control</th>
            </tr>
          </thead>
          <tbody>
            {exp.variants.map((v) => {
              const s = summary[v.key] ?? { views: 0, conversions: 0, rate: 0 };
              const lift = controlRate > 0 ? (s.rate - controlRate) / controlRate : 0;
              const isControl = v.isControl;
              return (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="font-medium">{v.label}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{v.key}</span>
                    {isControl ? (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs">control</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{v.weight}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.views}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.conversions}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatRate(s.rate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {isControl ? "—" : controlRate > 0 ? formatRate(lift) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-2">Integration</h2>
        <p className="text-xs text-muted-foreground mb-2">
          Use these endpoints to bucket visitors and record events from your site or app.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`POST /api/experiments/${ctx.workspaceSlug}/${exp.slug}/assign
  body: { "visitorId": "<stable-id-min-8-chars>" }
  → { "variantKey": "control" | "variant_a" | …, "sticky": boolean }

POST /api/experiments/${ctx.workspaceSlug}/${exp.slug}/track
  body: { "visitorId": "...", "variantKey": "...", "kind": "VIEW" | "CONVERSION", "value": 0 }
  → { "ok": true }`}
        </pre>
      </Card>

      <div className="flex flex-wrap gap-2">
        {canEdit && exp.status !== "RUNNING" && exp.status !== "COMPLETED" ? (
          <form action={startExperimentAction.bind(null, exp.id)}>
            <Button type="submit">Start</Button>
          </form>
        ) : null}
        {canEdit && exp.status === "RUNNING" ? (
          <form action={pauseExperimentAction.bind(null, exp.id)}>
            <Button type="submit" variant="outline">Pause</Button>
          </form>
        ) : null}
        {canEdit && exp.status !== "COMPLETED" && exp.status !== "DRAFT" ? (
          <form action={completeExperimentAction.bind(null, exp.id)}>
            <Button type="submit" variant="outline">Complete</Button>
          </form>
        ) : null}
        {canDelete ? (
          <form action={deleteExperimentAction.bind(null, exp.id)} className="ml-auto">
            <Button type="submit" variant="outline">Delete</Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
