import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiKeyCreator } from "./api-key-creator";
import { DeleteKeyButton } from "./delete-key-button";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.apiKeys", "view");
  const canCreate = can(ctx.role, "settings.apiKeys", "create");
  const canDelete = can(ctx.role, "settings.apiKeys", "delete");

  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Programmatic access to your workspace. Keys are shown once on creation — store them safely.
        </p>
      </div>

      {canCreate ? (
        <Card>
          <CardHeader><CardTitle>Create new key</CardTitle></CardHeader>
          <CardContent><ApiKeyCreator /></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Existing keys</CardTitle></CardHeader>
        <CardContent className="p-0">
          {keys.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Prefix</th>
                  <th className="px-3 py-2 text-left">Scopes</th>
                  <th className="px-3 py-2 text-left">Last used</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  {canDelete ? <th className="px-3 py-2"></th> : null}
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b">
                    <td className="px-3 py-2">{k.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">omni_{k.prefix}…</td>
                    <td className="px-3 py-2 text-xs">{(Array.isArray(k.scopes) ? (k.scopes as string[]) : []).join(", ")}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    {canDelete ? (
                      <td className="px-3 py-2 text-right">
                        <DeleteKeyButton id={k.id} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
