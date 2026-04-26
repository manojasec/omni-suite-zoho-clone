import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_PLATFORMS,
  SOCIAL_PLATFORM_LABELS,
  type SocialPlatform,
} from "@/modules/social/schemas";
import {
  connectSocialAccountAction,
  toggleSocialAccountAction,
  disconnectSocialAccountAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SocialAccountsPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialAccount", "view");

  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ active: "desc" }, { platform: "asc" }, { handle: "asc" }],
  });

  const canCreate = can(ctx.role, "socialAccount", "create");
  const canEdit = can(ctx.role, "socialAccount", "edit");
  const canDelete = can(ctx.role, "socialAccount", "delete");

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/app/social" className="hover:underline">← All posts</Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Connected accounts</h1>
        </div>
        {accounts.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No accounts connected yet.
          </Card>
        ) : (
          <Card className="p-0 overflow-hidden">
            <ul className="divide-y">
              {accounts.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {SOCIAL_PLATFORM_LABELS[a.platform as SocialPlatform]} · @{a.handle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.displayName ?? "No display name"} · {a.active ? "Active" : "Disabled"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit ? (
                      <form action={toggleSocialAccountAction.bind(null, a.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          {a.active ? "Disable" : "Enable"}
                        </Button>
                      </form>
                    ) : null}
                    {canDelete ? (
                      <form action={disconnectSocialAccountAction.bind(null, a.id)}>
                        <Button type="submit" variant="outline" size="sm" className="text-red-600">
                          Disconnect
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {canCreate ? (
        <Card className="p-4 self-start">
          <h2 className="font-semibold mb-3">Connect new account</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Mock connection — paste the handle and we&apos;ll simulate publishing.
          </p>
          <form action={connectSocialAccountAction} className="space-y-3">
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select id="platform" name="platform" defaultValue="TWITTER" required>
                {SOCIAL_PLATFORMS.map((p) => (
                  <option key={p} value={p}>{SOCIAL_PLATFORM_LABELS[p]}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="handle">Handle</Label>
              <Input id="handle" name="handle" required maxLength={120} placeholder="acme" />
            </div>
            <div>
              <Label htmlFor="displayName">Display name (optional)</Label>
              <Input id="displayName" name="displayName" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
              <Input id="avatarUrl" name="avatarUrl" type="url" maxLength={500} />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">Connect</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
