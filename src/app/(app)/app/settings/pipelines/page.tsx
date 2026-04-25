import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PipelinesSettingsPage() {
  const ctx = await requireSession();
  const pipelines = await prisma.pipeline.findMany({
    where: { workspaceId: ctx.workspaceId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pipelines</h1>
        <p className="text-sm text-muted-foreground">Configure sales stages and probabilities.</p>
      </div>
      {pipelines.map((p) => (
        <Card key={p.id}>
          <CardHeader><CardTitle>{p.name}{p.isDefault ? " (default)" : ""}</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {p.stages.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded border px-3 py-2">
                  <span><span className="text-muted-foreground">{s.order}.</span> {s.name}</span>
                  <span className="text-xs text-muted-foreground">{s.probability}%</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">Editing pipeline configuration ships in M2.</p>
    </div>
  );
}
