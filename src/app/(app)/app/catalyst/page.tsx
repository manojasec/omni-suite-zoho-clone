import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CatalystListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "catalystFunction", "view");
  const canCreate = can(ctx.role, "catalystFunction", "create");

  const fns = await prisma.catalystFunction.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      runtime: true,
      status: true,
      invokeCount: true,
      errorCount: true,
      lastInvokedAt: true,
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catalyst</h1>
          <p className="text-sm text-muted-foreground">
            Lightweight serverless functions for automating internal workflows.
          </p>
        </div>
        {canCreate ? (
          <Link href="/app/catalyst/new">
            <Button>New function</Button>
          </Link>
        ) : null}
      </div>

      {fns.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No functions yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {fns.map((f) => (
            <Link
              key={f.id}
              href={`/app/catalyst/${f.id}`}
              className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
            >
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {f.name}{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    /{f.slug}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {f.runtime} · {f.invokeCount} invocations · {f.errorCount}{" "}
                  errors
                </div>
              </div>
              <span className="rounded bg-muted px-2 py-1 text-xs">
                {f.status}
              </span>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
