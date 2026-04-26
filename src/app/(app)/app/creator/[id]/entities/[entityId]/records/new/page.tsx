import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { createCreatorRecordAction } from "../../../../../actions";

export const dynamic = "force-dynamic";

export default async function NewRecordPage({
  params,
}: {
  params: Promise<{ id: string; entityId: string }>;
}) {
  const { id: appId, entityId } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorRecord", "create");

  const entity = await prisma.creatorEntity.findFirst({
    where: { id: entityId, app: { id: appId, workspaceId: ctx.workspaceId } },
    include: {
      app: { select: { id: true, name: true } },
      fields: { orderBy: { position: "asc" } },
    },
  });
  if (!entity) notFound();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            New {entity.label}
          </h1>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/app/creator/${entity.app.id}/entities/${entity.id}`}
              className="hover:underline"
            >
              ← Back to {entity.label}
            </Link>
          </p>
        </div>
      </div>

      <Card className="p-4">
        {entity.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add fields to this entity before creating records.
          </p>
        ) : (
          <form
            action={createCreatorRecordAction.bind(null, entity.id)}
            className="grid gap-3"
          >
            {entity.fields.map((f) => {
              const opts = Array.isArray(f.options)
                ? (f.options as string[])
                : [];
              return (
                <div key={f.id}>
                  <Label htmlFor={f.key}>
                    {f.label}
                    {f.required ? (
                      <span className="ml-1 text-rose-600">*</span>
                    ) : null}
                  </Label>
                  {f.kind === "TEXTAREA" ? (
                    <Textarea
                      id={f.key}
                      name={f.key}
                      rows={4}
                      required={f.required}
                    />
                  ) : f.kind === "SELECT" ? (
                    <Select id={f.key} name={f.key} required={f.required}>
                      <option value="">— Select —</option>
                      {opts.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  ) : f.kind === "BOOLEAN" ? (
                    <input
                      id={f.key}
                      name={f.key}
                      type="checkbox"
                      value="on"
                      className="h-4 w-4"
                    />
                  ) : (
                    <Input
                      id={f.key}
                      name={f.key}
                      required={f.required}
                      type={
                        f.kind === "NUMBER"
                          ? "number"
                          : f.kind === "DATE"
                            ? "date"
                            : f.kind === "EMAIL"
                              ? "email"
                              : f.kind === "URL"
                                ? "url"
                                : "text"
                      }
                      step={f.kind === "NUMBER" ? "any" : undefined}
                    />
                  )}
                  {f.helpText ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {f.helpText}
                    </p>
                  ) : null}
                </div>
              );
            })}
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Create record
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
