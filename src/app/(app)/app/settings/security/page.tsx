import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkspacePlan } from "@/modules/billing/limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.security", "view");
  const ws = await getWorkspacePlan(ctx.workspaceId);
  const memberCount = await prisma.membership.count({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
  });
  const recentLogins = await prisma.auditLog.findMany({
    where: { workspaceId: ctx.workspaceId, action: "login" },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
        <p className="text-sm text-muted-foreground">
          Sign-in policies, SSO, and recent activity for your workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Authentication</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Sign-in method" value="Email + password (Auth.js)" />
            <Row label="Active members" value={String(memberCount)} />
            <Row
              label="Single Sign-On (SAML/OIDC)"
              value={ws.definition.features.sso ? "Enabled on plan" : "Requires Enterprise plan"}
            />
            <Row
              label="Audit log"
              value={ws.definition.features.auditLog ? "Available" : "Requires Starter plan or higher"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent sign-ins</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {recentLogins.length === 0 ? (
              <p className="text-muted-foreground">No sign-in events recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentLogins.map((l) => (
                  <li key={l.id} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{l.ip ?? "—"}</span>
                    <span className="text-xs">{new Date(l.createdAt).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
