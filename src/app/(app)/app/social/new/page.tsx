import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  SOCIAL_PLATFORM_LABELS,
  PLATFORM_LIMITS,
  type SocialPlatform,
} from "@/modules/social/schemas";
import { createSocialPostAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSocialPostPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "socialPost", "create");

  const accounts = await prisma.socialAccount.findMany({
    where: { workspaceId: ctx.workspaceId, active: true },
    orderBy: [{ platform: "asc" }, { handle: "asc" }],
  });

  if (accounts.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
        <Card className="p-6 text-sm text-muted-foreground">
          Connect at least one social account before scheduling posts.{" "}
          <Link href="/app/social/accounts" className="text-primary hover:underline">Connect an account →</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <p className="text-xs text-muted-foreground">
          <Link href="/app/social" className="hover:underline">← All posts</Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">New post</h1>
      </div>
      <Card className="p-4">
        <form action={createSocialPostAction} className="space-y-4">
          <div>
            <Label htmlFor="body">Post content</Label>
            <Textarea id="body" name="body" rows={5} required maxLength={8000} placeholder="What would you like to share?" />
            <p className="mt-1 text-xs text-muted-foreground">
              Limits: Twitter {PLATFORM_LIMITS.TWITTER}, LinkedIn {PLATFORM_LIMITS.LINKEDIN}, Threads/Mastodon {PLATFORM_LIMITS.THREADS}.
            </p>
          </div>
          <div>
            <Label htmlFor="mediaUrl">Media URL (optional)</Label>
            <Input id="mediaUrl" name="mediaUrl" type="url" maxLength={500} placeholder="https://..." />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Publish to</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {accounts.map((a) => (
                <label key={a.id} className="flex items-center gap-2 rounded border px-3 py-2 text-sm">
                  <input type="checkbox" name="accountIds" value={a.id} className="h-4 w-4" />
                  <span>
                    <span className="font-medium">@{a.handle}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {SOCIAL_PLATFORM_LABELS[a.platform as SocialPlatform]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="scheduledAt">Schedule for</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" />
              <p className="mt-1 text-xs text-muted-foreground">Leave empty to keep as draft.</p>
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="publishNow" className="h-4 w-4" />
                Publish immediately
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/social"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
