import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

async function updateProfileAction(fd: FormData) {
  "use server";
  const ctx = await requireSession();
  const parsed = z.object({ name: z.string().min(1).max(80) }).safeParse({
    name: fd.get("name") ?? "",
  });
  if (!parsed.success) return;
  await prisma.user.update({
    where: { id: ctx.userId },
    data: { name: parsed.data.name },
  });
  revalidatePath("/app/settings/profile");
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const ctx = await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">Your personal account settings.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Account</CardTitle></CardHeader>
        <CardContent>
          <form action={updateProfileAction} className="space-y-4 text-sm">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={ctx.email} disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" name="name" defaultValue={ctx.name ?? ""} maxLength={80} required />
            </div>
            <div className="space-y-1">
              <Label>Role in {ctx.workspaceName}</Label>
              <Input value={ctx.role} disabled />
            </div>
            <Button type="submit" size="sm">Save</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
