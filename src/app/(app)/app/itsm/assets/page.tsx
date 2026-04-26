import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ASSET_STATUS_LABELS } from "@/modules/itsm/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  IN_USE: "bg-emerald-100 text-emerald-700",
  IN_STORAGE: "bg-zinc-100 text-zinc-700",
  RETIRED: "bg-amber-100 text-amber-700",
  LOST: "bg-rose-100 text-rose-700",
};

export default async function AssetsListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "asset", "view");

  const assets = await prisma.asset.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ status: "asc" }, { tag: "asc" }],
    include: {
      assignedTo: { select: { firstName: true, lastName: true } },
    },
  });
  const canCreate = can(ctx.role, "asset", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">IT assets</h1>
          <p className="text-sm text-muted-foreground">
            Hardware and software inventory tracked by tag, owner, and lifecycle status.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/itsm/assets/new">
            <Button>New asset</Button>
          </Link>
        ) : null}
      </div>

      {assets.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No assets yet — create your first asset to begin tracking.
        </Card>
      ) : (
        <Card className="divide-y">
          {assets.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/itsm/assets/${a.id}`}
                  className="font-medium hover:underline"
                >
                  [{a.tag}] {a.name}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {a.category}
                  {a.location ? ` · ${a.location}` : ""}
                  {a.assignedTo
                    ? ` · ${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                    : ""}
                </p>
              </div>
              <span
                className={
                  "rounded px-2 py-0.5 text-xs font-medium " +
                  (statusColor[a.status] ?? "bg-zinc-100 text-zinc-700")
                }
              >
                {ASSET_STATUS_LABELS[a.status]}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
