import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label, Select, Textarea } from "@/components/ui/input";
import {
  formatIncidentImpact,
  formatIncidentState,
  INCIDENT_STATES,
  type IncidentState,
} from "@/modules/status/schemas";
import { postIncidentUpdateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "statusPage", "view");
  const canEdit = can(ctx.role, "statusPage", "edit");

  const incident = await prisma.statusIncident.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { updates: { orderBy: { createdAt: "desc" } } },
  });
  if (!incident) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/status" className="text-xs text-muted-foreground hover:underline">
          ← Status page
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{incident.title}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatIncidentState(incident.state)} · {formatIncidentImpact(incident.impact)} ·
          started {incident.startedAt.toISOString().slice(0, 16).replace("T", " ")}
          {incident.resolvedAt
            ? ` · resolved ${incident.resolvedAt.toISOString().slice(0, 16).replace("T", " ")}`
            : ""}
        </p>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Updates
        </h2>
        <ol className="space-y-4">
          {incident.updates.map((u) => (
            <li key={u.id} className="border-l-2 border-muted pl-4">
              <div className="text-xs text-muted-foreground">
                {formatIncidentState(u.state as IncidentState)} ·{" "}
                {u.createdAt.toISOString().slice(0, 16).replace("T", " ")}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{u.body}</p>
            </li>
          ))}
        </ol>
      </Card>

      {canEdit ? (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Post update</h2>
          <form action={postIncidentUpdateAction.bind(null, incident.id)} className="space-y-3">
            <div>
              <Label htmlFor="upd-state">State</Label>
              <Select id="upd-state" name="state" defaultValue={incident.state}>
                {INCIDENT_STATES.map((s) => (
                  <option key={s} value={s}>
                    {formatIncidentState(s)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="upd-body">Body</Label>
              <Textarea id="upd-body" name="body" rows={4} required maxLength={5000} />
            </div>
            <div className="flex justify-end">
              <Button type="submit">Post update</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
