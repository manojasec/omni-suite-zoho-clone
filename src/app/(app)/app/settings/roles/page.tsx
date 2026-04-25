import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { ROLE_MATRIX, RESOURCES, ACTIONS } from "@/platform/permissions/matrix";
import type { SystemRole } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ROLES: SystemRole[] = ["OWNER", "ADMIN", "MANAGER", "SALES", "FINANCE", "AGENT", "MEMBER", "VIEWER"];

export default async function RolesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.users", "view");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Roles & permissions</h1>
        <p className="text-sm text-muted-foreground">
          Built-in role matrix. Custom roles are available on Professional and Enterprise plans.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Permission matrix</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Resource</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-2 py-2 text-left font-medium uppercase">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((res) => (
                <tr key={res} className="border-b">
                  <td className="px-3 py-2 font-mono text-[11px]">{res}</td>
                  {ROLES.map((role) => {
                    const allowed = ROLE_MATRIX[role][res] ?? [];
                    return (
                      <td key={role} className="px-2 py-2">
                        {allowed.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : allowed.length === ACTIONS.length ? (
                          <span className="text-emerald-600">all</span>
                        ) : (
                          <span className="text-[10px]">{allowed.join(",")}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
