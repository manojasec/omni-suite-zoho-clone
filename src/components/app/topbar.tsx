import { signOutAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SearchTrigger } from "@/components/app/search-trigger";
import { NotificationsBell } from "@/components/app/notifications-bell";

type Membership = {
  id: string;
  workspace: { id: string; name: string; slug: string };
};

export function Topbar({
  email,
  name,
  memberships,
  activeWorkspaceId,
  activeWorkspaceName,
}: {
  email: string;
  name: string | null;
  memberships: Membership[];
  activeWorkspaceId: string;
  activeWorkspaceName: string;
}) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-4">
        <WorkspaceSwitcher
          memberships={memberships}
          activeId={activeWorkspaceId}
          activeName={activeWorkspaceName}
        />
        <SearchTrigger />
      </div>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <NotificationsBell />
        <div className="text-right text-sm leading-tight">
          <div className="font-medium">{name ?? email}</div>
          <div className="text-xs text-muted-foreground">{email}</div>
        </div>
        <form action={signOutAction}>
          <Button variant="outline" size="sm" type="submit">Sign out</Button>
        </form>
      </div>
    </header>
  );
}
