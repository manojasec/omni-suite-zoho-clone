import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const ctx = await requireSession();
  const memberCount = await prisma.membership.count({
    where: { workspaceId: ctx.workspaceId, status: "ACTIVE" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">
          Group members into teams to scope assignments, dashboards, and notifications.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Workspace members</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Active members:</span>{" "}
            <span className="font-medium">{memberCount}</span>
          </p>
          <p className="text-muted-foreground">
            Manage individual members in <code>Settings → Users</code>. Team groupings are coming in a
            future release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
