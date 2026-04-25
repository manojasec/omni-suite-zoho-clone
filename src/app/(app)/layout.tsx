import { requireSession, listMemberships } from "@/lib/session";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { Breadcrumbs } from "@/components/app/breadcrumbs";
import { PermissionProvider } from "@/platform/permissions/client";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession();
  const memberships = await listMemberships();
  return (
    <PermissionProvider role={ctx.role}>
      <div className="flex min-h-screen">
        <Sidebar workspaceName={ctx.workspaceName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            email={ctx.email}
            name={ctx.name}
            memberships={memberships}
            activeWorkspaceId={ctx.workspaceId}
            activeWorkspaceName={ctx.workspaceName}
          />
          <div className="border-b bg-card/40 px-6 py-2">
            <Breadcrumbs />
          </div>
          <main className="flex-1 overflow-auto bg-muted/20 p-6">{children}</main>
        </div>
      </div>
    </PermissionProvider>
  );
}
