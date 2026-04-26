import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  CREATOR_APP_STATUS_LABELS,
  CREATOR_APP_TRANSITIONS,
  formatDate,
} from "@/modules/creator/schemas";
import {
  createCreatorEntityAction,
  deleteCreatorAppAction,
  deleteCreatorEntityAction,
  transitionCreatorAppAction,
  updateCreatorAppAction,
} from "../actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-zinc-200 text-zinc-600",
};

export default async function CreatorAppDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "creatorApp", "view");

  const app = await prisma.creatorApp.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      entities: {
        orderBy: { position: "asc" },
        include: {
          _count: { select: { fields: true, records: true } },
        },
      },
    },
  });
  if (!app) notFound();

  const canUpdate = can(ctx.role, "creatorApp", "edit");
  const canDelete = can(ctx.role, "creatorApp", "delete");
  const transitions = CREATOR_APP_TRANSITIONS[app.status];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {app.icon ? <span className="mr-1">{app.icon}</span> : null}
            {app.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <code>/{app.slug}</code> · updated {formatDate(app.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded px-2 py-0.5 text-xs font-medium " +
              (statusColor[app.status] ?? "bg-zinc-100 text-zinc-700")
            }
          >
            {CREATOR_APP_STATUS_LABELS[app.status]}
          </span>
          {canUpdate
            ? transitions.map((t) => (
                <form
                  key={t}
                  action={transitionCreatorAppAction.bind(null, app.id)}
                >
                  <input type="hidden" name="status" value={t} />
                  <Button type="submit" size="sm" variant="outline">
                    {t === "PUBLISHED"
                      ? "Publish"
                      : t === "ARCHIVED"
                        ? "Archive"
                        : t === "DRAFT"
                          ? "Move to draft"
                          : t}
                  </Button>
                </form>
              ))
            : null}
          {canDelete && app.status !== "PUBLISHED" ? (
            <form action={deleteCreatorAppAction.bind(null, app.id)}>
              <Button type="submit" size="sm" variant="outline">
                Delete
              </Button>
            </form>
          ) : null}
          <Link
            href="/app/creator"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Entities</h2>
        {app.entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add an entity (table) to start collecting records.
          </p>
        ) : (
          <ul className="divide-y">
            {app.entities.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2"
              >
                <Link
                  href={`/app/creator/${app.id}/entities/${e.id}`}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <div className="text-sm font-medium">
                    {e.label}{" "}
                    <code className="text-xs text-muted-foreground">
                      {e.key}
                    </code>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e._count.fields} field
                    {e._count.fields === 1 ? "" : "s"} · {e._count.records}{" "}
                    record{e._count.records === 1 ? "" : "s"}
                  </div>
                </Link>
                {canUpdate ? (
                  <form action={deleteCreatorEntityAction.bind(null, e.id)}>
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
            action={createCreatorEntityAction.bind(null, app.id)}
            className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-3"
          >
            <div>
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                name="key"
                required
                maxLength={64}
                pattern="[a-z][a-z0-9_]*"
                placeholder="orders"
              />
            </div>
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" name="label" required maxLength={160} />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" maxLength={500} />
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" size="sm">
                Add entity
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      {canUpdate ? (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Settings</h2>
          <form
            action={updateCreatorAppAction.bind(null, app.id)}
            className="grid gap-3"
          >
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={app.name}
                  required
                  maxLength={160}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  defaultValue={app.slug}
                  required
                  maxLength={80}
                  pattern="[a-z][a-z0-9-]*"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                name="icon"
                defaultValue={app.icon ?? ""}
                maxLength={40}
              />
            </div>
            <div>
              <Label htmlFor="appDescription">Description</Label>
              <Textarea
                id="appDescription"
                name="description"
                defaultValue={app.description ?? ""}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
