import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  componentStateColor,
  deriveOverallStatus,
  formatComponentState,
  formatIncidentImpact,
  formatIncidentState,
  overallHeadline,
  type ComponentState,
  type IncidentState,
} from "@/modules/status/schemas";

export const dynamic = "force-dynamic";

export default async function PublicStatusPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true },
  });
  if (!workspace) notFound();

  const [components, activeIncidents, pastIncidents] = await Promise.all([
    prisma.statusComponent.findMany({
      where: { workspaceId: workspace.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.statusIncident.findMany({
      where: { workspaceId: workspace.id, state: { not: "RESOLVED" } },
      orderBy: { startedAt: "desc" },
      include: { updates: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    prisma.statusIncident.findMany({
      where: { workspaceId: workspace.id, state: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        impact: true,
        startedAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  const overall = deriveOverallStatus(components.map((c) => c.state as ComponentState));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {workspace.name}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">System status</h1>
      </header>

      <Card className={`mb-8 p-6 ${componentStateColor(overall)}`}>
        <p className="text-lg font-semibold">{overallHeadline(overall)}</p>
        <p className="mt-1 text-xs opacity-80">
          Last updated {new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
        </p>
      </Card>

      {activeIncidents.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Active incidents
          </h2>
          <div className="space-y-3">
            {activeIncidents.map((i) => (
              <Card key={i.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-base font-semibold">{i.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatIncidentState(i.state as IncidentState)} ·{" "}
                      {formatIncidentImpact(i.impact)} · started{" "}
                      {i.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                </div>
                <ol className="mt-3 space-y-3 border-l-2 border-muted pl-4">
                  {i.updates.map((u) => (
                    <li key={u.id}>
                      <div className="text-xs text-muted-foreground">
                        {formatIncidentState(u.state as IncidentState)} ·{" "}
                        {u.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{u.body}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Components
        </h2>
        {components.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No components configured yet.
          </Card>
        ) : (
          <Card className="divide-y p-0">
            {components.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{c.name}</div>
                  {c.description ? (
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  ) : null}
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${componentStateColor(c.state as ComponentState)}`}
                >
                  {formatComponentState(c.state as ComponentState)}
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>

      {pastIncidents.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Incident history
          </h2>
          <Card className="divide-y p-0">
            {pastIncidents.map((i) => (
              <div key={i.id} className="p-4">
                <div className="text-sm font-semibold">{i.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Resolved · {formatIncidentImpact(i.impact)} ·{" "}
                  {(i.resolvedAt ?? i.startedAt).toISOString().slice(0, 10)}
                </p>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
