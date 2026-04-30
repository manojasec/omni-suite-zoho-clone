import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  CATALYST_RUNTIMES,
  CATALYST_RUNTIME_LABELS,
  DEFAULT_NODE_CODE,
} from "@/modules/catalyst/schemas";
import { createFunctionAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewCatalystFunctionPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "create");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New function</h1>
      <Card className="p-4">
        <form action={createFunctionAction} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              name="slug"
              required
              maxLength={80}
              pattern="[a-z0-9-]+"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" maxLength={500} />
          </div>
          <div>
            <Label htmlFor="runtime">Runtime</Label>
            <select
              id="runtime"
              name="runtime"
              defaultValue="NODE_20"
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
              defaultValue="index.handler"
              maxLength={120}
            />
          </div>
          <div>
            <Label htmlFor="timeoutMs">Timeout (ms)</Label>
            <Input
              id="timeoutMs"
              name="timeoutMs"
              type="number"
              defaultValue="30000"
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
              defaultValue="128"
              min={64}
              max={4096}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="code">Code</Label>
            <textarea
              id="code"
              name="code"
              defaultValue={DEFAULT_NODE_CODE}
              required
              rows={12}
              className="w-full rounded border bg-background p-2 font-mono text-xs"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit">Create function</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
