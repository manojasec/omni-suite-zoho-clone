import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  COMPONENT_STATES,
  componentStateColor,
  deriveOverallStatus,
  formatComponentState,
  formatIncidentImpact,
  formatIncidentState,
  INCIDENT_IMPACTS,
  INCIDENT_STATES,
  overallHeadline,
  type ComponentState,
} from "@/modules/status/schemas";
import {
  createComponentAction,
  createIncidentAction,
  deleteComponentAction,
  setComponentStateAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function StatusAdminPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "view");
  const canEdit = can(ctx.role, "statusPage", "edit");
  const canDelete = can(ctx.role, "statusPage", "delete");
  const canCreate = can(ctx.role, "statusPage", "create");

  const [workspace, components, incidents] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { slug: true },
    }),
    prisma.statusComponent.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    prisma.statusIncident.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { startedAt: "desc" },
      take: 25,
      select: {
        id: true,
        title: true,
        state: true,
        impact: true,
        startedAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  const overall = deriveOverallStatus(components.map((c) => c.state as ComponentState));
  const publicUrl = `/status/${workspace?.slug ?? ""}`;
  const activeIncidents = incidents.filter((i) => i.state !== "RESOLVED");
  const pastIncidents = incidents.filter((i) => i.state === "RESOLVED");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status Page</h1>
          <p className="text-sm text-muted-foreground">
            Public uptime and incident communication for your customers.
          </p>
        </div>
        <Link href={publicUrl} target="_blank" rel="noreferrer">
          <Button>View public page</Button>
        </Link>
      </div>

      <Card className="p-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Public URL: </span>
          <code className="rounded bg-muted px-1.5 py-0.5">{publicUrl}</code>
        </div>
        <div className="mt-3">
          <span
            className={`inline-block rounded px-3 py-1 text-sm font-medium ${componentStateColor(overall)}`}
          >
            {overallHeadline(overall)}
          </span>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Components ({components.length})
          </h2>
        </div>
        <Card className="divide-y p-0">
          {components.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No components yet. Add one below.
            </p>
          ) : (
            components.map((c) => (
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
                {canEdit ? (
                  <form action={setComponentStateAction.bind(null, c.id)} className="flex gap-2">
                    <Select name="state" defaultValue={c.state}>
                      {COMPONENT_STATES.map((s) => (
                        <option key={s} value={s}>
                          {formatComponentState(s)}
                        </option>
                      ))}
                    </Select>
                    <Button type="submit" variant="outline" size="sm">
                      Save
                    </Button>
                  </form>
                ) : null}
                {canDelete ? (
                  <form action={deleteComponentAction.bind(null, c.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </div>
            ))
          )}
        </Card>

        {canCreate ? (
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Add component</h3>
            <form action={createComponentAction} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="comp-name">Name</Label>
                  <Input id="comp-name" name="name" required maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="comp-state">Initial state</Label>
                  <Select id="comp-state" name="state" defaultValue="OPERATIONAL">
                    {COMPONENT_STATES.map((s) => (
                      <option key={s} value={s}>
                        {formatComponentState(s)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="comp-desc">Description</Label>
                <Input id="comp-desc" name="description" maxLength={500} />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Add component</Button>
              </div>
            </form>
          </Card>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Active incidents ({activeIncidents.length})
        </h2>
        {activeIncidents.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">
            No active incidents.
          </Card>
        ) : (
          <ul className="space-y-2">
            {activeIncidents.map((i) => (
              <li key={i.id}>
                <Link href={`/app/status/incidents/${i.id}`}>
                  <Card className="p-4 transition hover:border-foreground/30">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{i.title}</div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatIncidentState(i.state)} ·{" "}
                          {formatIncidentImpact(i.impact)} · started{" "}
                          {i.startedAt.toISOString().slice(0, 16).replace("T", " ")}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {canCreate ? (
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Open new incident</h3>
            <form action={createIncidentAction} className="space-y-3">
              <div>
                <Label htmlFor="inc-title">Title</Label>
                <Input id="inc-title" name="title" required maxLength={200} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="inc-state">State</Label>
                  <Select id="inc-state" name="state" defaultValue="INVESTIGATING">
                    {INCIDENT_STATES.map((s) => (
                      <option key={s} value={s}>
                        {formatIncidentState(s)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="inc-impact">Impact</Label>
                  <Select id="inc-impact" name="impact" defaultValue="MINOR">
                    {INCIDENT_IMPACTS.map((i) => (
                      <option key={i} value={i}>
                        {formatIncidentImpact(i)}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="inc-body">Initial update</Label>
                <Textarea id="inc-body" name="body" rows={4} required maxLength={5000} />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Open incident</Button>
              </div>
            </form>
          </Card>
        ) : null}
      </section>

      {pastIncidents.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Past incidents
          </h2>
          <Card className="divide-y p-0">
            {pastIncidents.map((i) => (
              <Link
                key={i.id}
                href={`/app/status/incidents/${i.id}`}
                className="block p-4 hover:bg-muted/50"
              >
                <div className="text-sm font-semibold">{i.title}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Resolved · {formatIncidentImpact(i.impact)} ·{" "}
                  {(i.resolvedAt ?? i.startedAt).toISOString().slice(0, 10)}
                </p>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
