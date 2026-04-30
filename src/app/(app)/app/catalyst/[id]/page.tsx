import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  CATALYST_RUNTIMES,
  CATALYST_RUNTIME_LABELS,
} from "@/modules/catalyst/schemas";
import {
  deleteFunctionAction,
  invokeFunctionAction,
  setFunctionStatusAction,
  updateFunctionAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function CatalystFunctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "view");
  const canEdit = can(ctx.role, "catalystFunction", "edit");
  const canDelete = can(ctx.role, "catalystFunction", "delete");

  const fn = await prisma.catalystFunction.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      invocations: { orderBy: { startedAt: "desc" }, take: 10 },
    },
  });
  if (!fn) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fn.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">
            /{fn.slug} · {fn.runtime} · {fn.handler}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <>
              {fn.status !== "ACTIVE" ? (
                <form
                  action={setFunctionStatusAction.bind(null, fn.id, "ACTIVE")}
                >
                  <Button type="submit" size="sm">
                    Activate
                  </Button>
                </form>
              ) : (
                <form
                  action={setFunctionStatusAction.bind(null, fn.id, "DISABLED")}
                >
                  <Button type="submit" size="sm" variant="ghost">
                    Disable
                  </Button>
                </form>
              )}
            </>
          ) : null}
          {canDelete ? (
            <form action={deleteFunctionAction.bind(null, fn.id)}>
              <Button type="submit" variant="ghost">
                Delete
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Status</div>
          <div className="text-lg font-semibold">{fn.status}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">
            Invocations
          </div>
          <div className="text-lg font-semibold">{fn.invokeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Errors</div>
          <div className="text-lg font-semibold">{fn.errorCount}</div>
        </Card>
      </div>

      {canEdit ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Invoke (test)</h2>
          <form
            action={invokeFunctionAction.bind(null, fn.id)}
            className="space-y-2"
          >
            <Label htmlFor="payload">Payload (JSON)</Label>
            <textarea
              id="payload"
              name="payload"
              rows={4}
              placeholder='{"hello":"world"}'
              className="w-full rounded border bg-background p-2 font-mono text-xs"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={fn.status !== "ACTIVE"}>
                Invoke
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {canEdit ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Edit function</h2>
          <form
            action={updateFunctionAction.bind(null, fn.id)}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={fn.name}
                required
                maxLength={160}
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                defaultValue={fn.slug}
                required
                maxLength={80}
                pattern="[a-z0-9-]+"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                name="description"
                defaultValue={fn.description ?? ""}
                maxLength={500}
              />
            </div>
            <div>
              <Label htmlFor="runtime">Runtime</Label>
              <select
                id="runtime"
                name="runtime"
                defaultValue={fn.runtime}
                className="h-9 w-full rounded border bg-background px-2 text-sm"
              >
                {CATALYST_RUNTIMES.map((r) => (
                  <option key={r} value={r}>
                    {CATALYST_RUNTIME_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="handler">Handler</Label>
              <Input
                id="handler"
                name="handler"
                defaultValue={fn.handler}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="timeoutMs">Timeout (ms)</Label>
              <Input
                id="timeoutMs"
                name="timeoutMs"
                type="number"
                defaultValue={fn.timeoutMs}
                min={100}
                max={900000}
              />
            </div>
            <div>
              <Label htmlFor="memoryMb">Memory (MB)</Label>
              <Input
                id="memoryMb"
                name="memoryMb"
                type="number"
                defaultValue={fn.memoryMb}
                min={64}
                max={4096}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="code">Code</Label>
              <textarea
                id="code"
                name="code"
                defaultValue={fn.code}
                required
                rows={12}
                className="w-full rounded border bg-background p-2 font-mono text-xs"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold">Recent invocations</h2>
        {fn.invocations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No invocations yet.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {fn.invocations.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between rounded border px-3 py-2"
              >
                <span>
                  {i.startedAt.toISOString().slice(0, 19).replace("T", " ")} ·{" "}
                  {i.status}
                </span>
                <span className="text-xs text-muted-foreground">
                  {i.durationMs}ms
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
