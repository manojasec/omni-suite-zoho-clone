import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  CREATOR_FIELD_KINDS,
  CREATOR_FIELD_KIND_LABELS,
  formatDate,
  formatRecordValue,
  type FieldDef,
} from "@/modules/creator/schemas";
import {
  createCreatorFieldAction,
  deleteCreatorFieldAction,
  deleteCreatorRecordAction,
} from "../../../actions";

export const dynamic = "force-dynamic";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string; entityId: string }>;
}) {
  const { id: appId, entityId } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "view");

  const entity = await prisma.creatorEntity.findFirst({
    where: { id: entityId, app: { id: appId, workspaceId: ctx.workspaceId } },
    include: {
      app: { select: { id: true, name: true, slug: true } },
      fields: { orderBy: { position: "asc" } },
      records: {
        orderBy: { createdAt: "desc" },
        take: 100,
      },
    },
  });
  if (!entity) notFound();

  const canUpdate = can(ctx.role, "creatorApp", "edit");
  const canCreateRecord = can(ctx.role, "creatorRecord", "create");
  const canDeleteRecord = can(ctx.role, "creatorRecord", "delete");

  const fieldDefs: FieldDef[] = entity.fields.map((f) => ({
    key: f.key,
    label: f.label,
    kind: f.kind,
    required: f.required,
    options: Array.isArray(f.options) ? (f.options as string[]) : null,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {entity.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/creator/${entity.app.id}`}
              className="hover:underline"
            >
              {entity.app.name}
            </Link>{" "}
            · <code>{entity.key}</code>
          </p>
        </div>
        {canCreateRecord && fieldDefs.length > 0 ? (
          <Link
            href={`/app/creator/${entity.app.id}/entities/${entity.id}/records/new`}
          >
            <Button size="sm">New record</Button>
          </Link>
        ) : null}
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Fields</h2>
        {entity.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add fields to define the shape of records.
          </p>
        ) : (
          <ul className="divide-y">
            {entity.fields.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {f.label}{" "}
                    <code className="text-xs text-muted-foreground">
                      {f.key}
                    </code>{" "}
                    {f.required ? (
                      <span className="text-xs text-rose-600">required</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {CREATOR_FIELD_KIND_LABELS[f.kind]}
                    {Array.isArray(f.options) && f.options.length > 0
                      ? ` · ${(f.options as string[]).length} options`
                      : ""}
                    {f.helpText ? ` · ${f.helpText}` : ""}
                  </div>
                </div>
                {canUpdate ? (
                  <form action={deleteCreatorFieldAction.bind(null, f.id)}>
                    <Button type="submit" size="sm" variant="outline">
                      Delete
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canUpdate ? (
          <form
            action={createCreatorFieldAction.bind(null, entity.id)}
            className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-2"
          >
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                name="key"
                required
                maxLength={64}
                pattern="[a-z][a-z0-9_]*"
              />
            </div>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="kind">Type</Label>
              <Select id="kind" name="kind" required>
                {CREATOR_FIELD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CREATOR_FIELD_KIND_LABELS[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <input
                id="required"
                name="required"
                type="checkbox"
                value="on"
                className="h-4 w-4"
              />
              <Label htmlFor="required" className="!mt-0">
                Required
              </Label>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="helpText">Help text</Label>
              <Input id="helpText" name="helpText" maxLength={300} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="options">
                Options (one per line, only for Select)
              </Label>
              <textarea
                id="options"
                name="options"
                rows={3}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" size="sm">
                Add field
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">
          Records ({entity.records.length})
        </h2>
        {entity.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No records yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Created</th>
                  {fieldDefs.map((f) => (
                    <th key={f.key} className="py-2 pr-3">
                      {f.label}
                    </th>
                  ))}
                  {canDeleteRecord ? <th className="py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {entity.records.map((r) => {
                  const data = (r.data ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 text-xs text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </td>
                      {fieldDefs.map((f) => (
                        <td key={f.key} className="py-2 pr-3">
                          {formatRecordValue(f, data[f.key])}
                        </td>
                      ))}
                      {canDeleteRecord ? (
                        <td className="py-2">
                          <form
                            action={deleteCreatorRecordAction.bind(null, r.id)}
                          >
                            <Button type="submit" size="sm" variant="outline">
                              Delete
                            </Button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
