import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string; action?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "auditLog", "view");
  const { resource, action } = await searchParams;

  const logs = await prisma.auditLog.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(resource ? { resource } : {}),
      ...(action ? { action } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter((v): v is string => Boolean(v))));
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Recent activity in your workspace. Filter via the URL: <code>?resource=deal&action=update</code>.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No audit events.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">When</th>
                  <th className="px-3 py-2 text-left">Actor</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">Resource</th>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Diff</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const actor = l.actorId ? actorMap.get(l.actorId) : null;
                  return (
                    <tr key={l.id} className="border-b align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {actor ? (actor.name ?? actor.email) : <span className="text-muted-foreground">system</span>}
                      </td>
                      <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{l.action}</span></td>
                      <td className="px-3 py-2 text-xs">{l.resource}</td>
                      <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{l.resourceId ?? "—"}</td>
                      <td className="px-3 py-2">
                        {l.diff ? (
                          <pre className="max-w-xs whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
                            {JSON.stringify(l.diff, null, 0)}
                          </pre>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
