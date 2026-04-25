import { requireSession, hasMinRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "./invite-form";

export const dynamic = "force-dynamic";

export default async function UsersSettingsPage() {
  const ctx = await requireSession();
  const canManage = hasMinRole(ctx.role, "ADMIN");

  const [memberships, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId: ctx.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Members of {ctx.workspaceName}</p>
      </div>

      {canManage ? (
        <Card>
          <CardHeader><CardTitle>Invite a teammate</CardTitle></CardHeader>
          <CardContent><InviteForm /></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Members ({memberships.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Role</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id} className="border-b">
                  <td className="px-4 py-2 font-medium">{m.user.name ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{m.user.email}</td>
                  <td className="px-4 py-2">{m.role}</td>
                  <td className="px-4 py-2">{m.status}</td>
                  <td className="px-4 py-2 text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {invitations.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Pending invitations ({invitations.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Email</th>
                  <th className="px-4 py-2 text-left">Role</th>
                  <th className="px-4 py-2 text-left">Expires</th>
                  <th className="px-4 py-2 text-left">Invite link</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="px-4 py-2">{inv.email}</td>
                    <td className="px-4 py-2">{inv.role}</td>
                    <td className="px-4 py-2 text-muted-foreground">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2"><code className="text-xs">/invitations/{inv.token}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
