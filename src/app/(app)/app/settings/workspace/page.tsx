import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceForm } from "./form";

export default async function WorkspaceSettingsPage() {
  const ctx = await requireSession();
  const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspaceId } });
  if (!ws) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground">General workspace configuration.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Name, currency, and timezone for {ws.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            initial={{ name: ws.name, currency: ws.currency, timezone: ws.timezone }}
            canEdit={ctx.role === "OWNER" || ctx.role === "ADMIN"}
          />
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Workspace slug: <code>{ws.slug}</code> · Plan: <code>{ws.plan}</code></p>
    </div>
  );
}
