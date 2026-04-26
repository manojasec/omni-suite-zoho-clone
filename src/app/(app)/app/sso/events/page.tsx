import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import {
  SSO_LOGIN_KIND_LABELS,
  formatDate,
} from "@/modules/sso/schemas";

export const dynamic = "force-dynamic";

const kindColor: Record<string, string> = {
  LOGIN_SUCCESS: "bg-emerald-100 text-emerald-700",
  LOGIN_FAILED: "bg-rose-100 text-rose-700",
  PROVISION: "bg-blue-100 text-blue-700",
};

export default async function SsoEventsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoLoginEvent", "view");

  const events = await prisma.ssoLoginEvent.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { occurredAt: "desc" },
    take: 200,
    include: { provider: { select: { id: true, name: true } } },
  });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Login events</h1>
        <p className="text-sm text-muted-foreground">
          Latest 200 SSO sign-in attempts across all providers in this workspace.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No login events recorded yet.
        </Card>
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(e.occurredAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{e.email}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/app/sso/${e.provider.id}`}
                        className="hover:underline"
                      >
                        {e.provider.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs font-medium " +
                          (kindColor[e.kind] ?? "bg-zinc-100 text-zinc-700")
                        }
                      >
                        {SSO_LOGIN_KIND_LABELS[e.kind]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.ipAddress ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.reason ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
