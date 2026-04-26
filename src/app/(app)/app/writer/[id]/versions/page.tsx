import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/modules/writer/schemas";
import { restoreWriterDocVersionAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function WriterDocVersionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "writerDoc", "view");

  const doc = await prisma.writerDoc.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });
  if (!doc) notFound();

  const canEdit = can(ctx.role, "writerDoc", "edit");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {doc.title} · versions
          </h1>
          <p className="text-sm text-muted-foreground">
            {doc.versions.length} snapshot
            {doc.versions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href={`/app/writer/${doc.id}`}>
          <Button size="sm" variant="outline">
            ← Back to doc
          </Button>
        </Link>
      </div>

      {doc.versions.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No version snapshots yet. Saving content changes creates one.
        </Card>
      ) : (
        <Card className="divide-y">
          {doc.versions.map((v) => (
            <div
              key={v.id}
              className="flex flex-wrap items-start justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  v{v.version} · {v.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(v.createdAt)}
                </div>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-xs">
                  {v.content.slice(0, 600)}
                  {v.content.length > 600 ? "…" : ""}
                </pre>
              </div>
              {canEdit ? (
                <form
                  action={restoreWriterDocVersionAction.bind(null, doc.id)}
                >
                  <input type="hidden" name="versionId" value={v.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Restore
                  </Button>
                </form>
              ) : null}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
