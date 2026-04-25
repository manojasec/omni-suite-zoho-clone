import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/record";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function updateBrandingAction(fd: FormData) {
  "use server";
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.workspace", "edit");
  const parsed = z
    .object({
      logoUrl: z.string().url().optional().or(z.literal("")),
      accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use #RRGGBB").optional().or(z.literal("")),
    })
    .safeParse({
      logoUrl: fd.get("logoUrl") ?? "",
      accentColor: fd.get("accentColor") ?? "",
    });
  if (!parsed.success) return;
  await prisma.workspace.update({
    where: { id: ctx.workspaceId },
    data: {
      logoUrl: parsed.data.logoUrl || null,
      accentColor: parsed.data.accentColor || null,
    },
  });
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorId: ctx.userId,
    action: "update",
    resource: "workspace",
    resourceId: ctx.workspaceId,
    diff: { branding: parsed.data },
  });
  revalidatePath("/app/settings/branding");
}

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.workspace", "view");
  const canEdit = can(ctx.role, "settings.workspace", "edit");
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { logoUrl: true, accentColor: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-sm text-muted-foreground">Workspace logo and accent color.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
        <CardContent>
          <form action={updateBrandingAction} className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                name="logoUrl"
                type="url"
                defaultValue={ws?.logoUrl ?? ""}
                placeholder="https://example.com/logo.png"
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="accentColor">Accent color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="accentColor"
                  name="accentColor"
                  defaultValue={ws?.accentColor ?? ""}
                  placeholder="#0F172A"
                  pattern="^#[0-9a-fA-F]{6}$"
                  disabled={!canEdit}
                />
                {ws?.accentColor ? (
                  <span
                    className="h-8 w-8 shrink-0 rounded border"
                    style={{ backgroundColor: ws.accentColor }}
                    aria-hidden
                  />
                ) : null}
              </div>
            </div>
            <Button type="submit" size="sm" disabled={!canEdit}>Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
