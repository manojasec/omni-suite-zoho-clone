import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  SSO_LOGIN_KIND_LABELS,
  SSO_PROTOCOL_LABELS,
  SSO_PROVIDER_STATUS_LABELS,
  formatDate,
  summarizeProvidersByStatus,
} from "@/modules/sso/schemas";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-zinc-100 text-zinc-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DISABLED: "bg-rose-100 text-rose-700",
};

export default async function SsoListPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "view");

  const [providers, recentEvents] = await Promise.all([
    prisma.ssoProvider.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    prisma.ssoLoginEvent.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { occurredAt: "desc" },
      take: 8,
      include: { provider: { select: { name: true } } },
    }),
  ]);

  const summary = summarizeProvidersByStatus(providers);
  const canCreate = can(ctx.role, "ssoProvider", "create");

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Single sign-on</h1>
          <p className="text-sm text-muted-foreground">
            OneAuth identity providers. Active providers route logins by email domain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/sso/events">
            <Button variant="outline">Login events</Button>
          </Link>
          {canCreate ? (
            <Link href="/app/sso/new">
              <Button>New provider</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Active</div>
          <div className="mt-1 text-2xl font-semibold">{summary.ACTIVE}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Draft</div>
          <div className="mt-1 text-2xl font-semibold">{summary.DRAFT}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Disabled</div>
          <div className="mt-1 text-2xl font-semibold">{summary.DISABLED}</div>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        {providers.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No identity providers configured yet.
          </Card>
        ) : (
          <Card className="divide-y">
            {providers.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/app/sso/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {SSO_PROTOCOL_LABELS[p.protocol]}
                    {p.domain ? ` · @${p.domain}` : " · no domain"} ·{" "}
                    {p.defaultRole}
                  </p>
                </div>
                <span
                  className={
                    "rounded px-2 py-0.5 text-xs font-medium " +
                    (statusColor[p.status] ?? "bg-zinc-100 text-zinc-700")
                  }
                >
                  {SSO_PROVIDER_STATUS_LABELS[p.status]}
                </span>
              </div>
            ))}
          </Card>
        )}

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">Recent events</h2>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No login events yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {recentEvents.map((e) => (
                <li key={e.id} className="border-b pb-1 last:border-0">
                  <div className="font-medium">{e.email}</div>
                  <div className="text-muted-foreground">
                    {SSO_LOGIN_KIND_LABELS[e.kind]} · {e.provider.name} ·{" "}
                    {formatDate(e.occurredAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Link
              href="/app/sso/events"
              className="text-xs text-muted-foreground hover:underline"
            >
              View all events →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
