import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_POST_STATUS_LABELS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPostStatus,
} from "@/modules/social/schemas";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<SocialPostStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-amber-100 text-amber-700",
};

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16);
}

export default async function SocialPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "view");

  const [posts, accountsCount] = await Promise.all([
    prisma.socialPost.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { targets: { include: { account: true } }, author: { select: { name: true, email: true } } },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.socialAccount.count({ where: { workspaceId: ctx.workspaceId, active: true } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Social</h1>
          <p className="text-sm text-muted-foreground">
            Compose, schedule, and publish posts across {accountsCount} connected account{accountsCount === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/social/accounts">
            <Button variant="outline">Accounts</Button>
          </Link>
          {can(ctx.role, "socialPost", "create") ? (
            <Link href="/app/social/new">
              <Button>New post</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {posts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No posts yet — create one to get started.
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <ul className="divide-y">
            {posts.map((p) => (
              <li key={p.id} className="px-4 py-3 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/app/social/${p.id}`} className="text-sm font-medium hover:underline">
                      {p.body.slice(0, 120)}{p.body.length > 120 ? "…" : ""}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={"inline-flex rounded px-1.5 py-0.5 " + STATUS_BADGE[p.status as SocialPostStatus]}>
                        {SOCIAL_POST_STATUS_LABELS[p.status as SocialPostStatus]}
                      </span>
                      <span>·</span>
                      <span>
                        {p.status === "PUBLISHED"
                          ? `Posted ${fmtDate(p.publishedAt)}`
                          : p.status === "SCHEDULED"
                          ? `Scheduled ${fmtDate(p.scheduledAt)}`
                          : `Created ${fmtDate(p.createdAt)}`}
                      </span>
                      <span>·</span>
                      <span>
                        {p.targets.map((t) => SOCIAL_PLATFORM_LABELS[t.account.platform as keyof typeof SOCIAL_PLATFORM_LABELS]).join(", ") || "no targets"}
                      </span>
                      <span>·</span>
                      <span>by {p.author?.name ?? p.author?.email ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
