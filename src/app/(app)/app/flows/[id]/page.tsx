import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  FLOW_NODE_KINDS,
  FLOW_NODE_KIND_LABELS,
  FLOW_RUN_STATUS_LABELS,
  FLOW_STATUS_LABELS,
  FLOW_TRANSITIONS,
  FLOW_TRIGGERS,
  FLOW_TRIGGER_LABELS,
  formatDate,
  validateFlowGraph,
} from "@/modules/flows/schemas";
import { FlowCanvas } from "@/modules/flows/flow-canvas";
import {
  createFlowEdgeAction,
  createFlowNodeAction,
  deleteFlowAction,
  deleteFlowEdgeAction,
  deleteFlowNodeAction,
  startFlowRunAction,
  transitionFlowAction,
  updateFlowAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "flow", "view");

  const flow = await prisma.flow.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      nodes: { orderBy: { key: "asc" } },
      edges: { orderBy: { fromKey: "asc" } },
      runs: {
        orderBy: { startedAt: "desc" },
        take: 5,
      },
    },
  });
  if (!flow) notFound();

  const issues = validateFlowGraph(flow.nodes, flow.edges);
  const canEdit = can(ctx.role, "flow", "edit");
  const canDelete = can(ctx.role, "flow", "delete");
  const canRun = can(ctx.role, "flowRun", "create");
  const isLocked = flow.status === "ACTIVE" || flow.status === "ARCHIVED";

  const updateBound = updateFlowAction.bind(null, flow.id);
  const transitionBound = transitionFlowAction.bind(null, flow.id);
  const deleteBound = deleteFlowAction.bind(null, flow.id);
  const createNodeBound = createFlowNodeAction.bind(null, flow.id);
  const createEdgeBound = createFlowEdgeAction.bind(null, flow.id);
  const startRunBound = startFlowRunAction.bind(null, flow.id);

  const transitions = FLOW_TRANSITIONS[flow.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{flow.name}</h1>
          <p className="text-sm text-muted-foreground">
            {FLOW_TRIGGER_LABELS[flow.trigger]} · {FLOW_STATUS_LABELS[flow.status]} ·
            v{flow.version} · updated {formatDate(flow.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit
            ? transitions.map((t) => (
                <form key={t} action={transitionBound}>
                  <input type="hidden" name="to" value={t} />
                  <Button type="submit" size="sm" variant="outline">
                    {t === "ACTIVE"
                      ? "Activate"
                      : t === "PAUSED"
                        ? "Pause"
                        : t === "ARCHIVED"
                          ? "Archive"
                          : t}
                  </Button>
                </form>
              ))
            : null}
          {canRun && flow.status === "ACTIVE" ? (
            <form action={startRunBound}>
              <Button type="submit" size="sm">
                Start run
              </Button>
            </form>
          ) : null}
          {canDelete && flow.status !== "ACTIVE" ? (
            <form action={deleteBound}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {issues.length > 0 ? (
        <Card className="border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">
            {issues.length} validation{" "}
            {issues.length === 1 ? "issue" : "issues"} — flow cannot activate.
          </div>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {issues.map((i, idx) => (
              <li key={idx}>{i.message}</li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          Graph validates. {flow.nodes.length} nodes · {flow.edges.length} edges.
        </Card>
      )}

      <FlowCanvas nodes={flow.nodes} edges={flow.edges} />

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Nodes</h2>
          {flow.nodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes.</p>
          ) : (
            <ul className="divide-y text-sm">
              {flow.nodes.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{n.label}</div>
                    <div className="text-xs text-muted-foreground">
                      <code>{n.key}</code> · {FLOW_NODE_KIND_LABELS[n.kind]}
                    </div>
                  </div>
                  {canEdit && !isLocked ? (
                    <form action={deleteFlowNodeAction.bind(null, n.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        ×
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit && !isLocked ? (
            <form
              action={createNodeBound}
              className="mt-4 grid gap-2 border-t pt-4"
            >
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="key">Key</Label>
                  <Input id="key" name="key" required placeholder="approve_invoice" />
                </div>
                <div>
                  <Label htmlFor="kind">Kind</Label>
                  <Select id="kind" name="kind" defaultValue="TASK">
                    {FLOW_NODE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {FLOW_NODE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="label">Label</Label>
                <Input id="label" name="label" required maxLength={160} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add node
                </Button>
              </div>
            </form>
          ) : null}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Edges</h2>
          {flow.edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No edges.</p>
          ) : (
            <ul className="divide-y text-sm">
              {flow.edges.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <code className="text-xs">{e.fromKey}</code>{" "}
                    <span className="text-muted-foreground">→</span>{" "}
                    <code className="text-xs">{e.toKey}</code>
                    {e.branch ? (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">
                        {e.branch}
                      </span>
                    ) : null}
                  </div>
                  {canEdit && !isLocked ? (
                    <form action={deleteFlowEdgeAction.bind(null, e.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        ×
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {canEdit && !isLocked ? (
            <form
              action={createEdgeBound}
              className="mt-4 grid gap-2 border-t pt-4"
            >
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <Label htmlFor="fromKey">From</Label>
                  <Select id="fromKey" name="fromKey" required>
                    {flow.nodes.map((n) => (
                      <option key={n.id} value={n.key}>
                        {n.key}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="toKey">To</Label>
                  <Select id="toKey" name="toKey" required>
                    {flow.nodes.map((n) => (
                      <option key={n.id} value={n.key}>
                        {n.key}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="branch">Branch label</Label>
                  <Input id="branch" name="branch" placeholder="yes / no" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  Add edge
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Recent runs</h2>
        {flow.runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {flow.runs.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <Link
                  href={`/app/flows/runs/${r.id}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  Run started {formatDate(r.startedAt)}{" "}
                  <span className="ml-2 text-xs text-muted-foreground">
                    @ {r.currentNodeKey ?? "—"}
                  </span>
                </Link>
                <span className="rounded bg-muted px-2 py-0.5 text-xs">
                  {FLOW_RUN_STATUS_LABELS[r.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Settings</h2>
        <form action={updateBound} className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={flow.name}
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={flow.description ?? ""}
              rows={3}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="trigger">Trigger</Label>
            <Select
              id="trigger"
              name="trigger"
              defaultValue={flow.trigger}
              disabled={!canEdit}
            >
              {FLOW_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {FLOW_TRIGGER_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>
          {canEdit ? (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
      </Card>
    </div>
  );
}
