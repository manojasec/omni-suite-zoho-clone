import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createDashboardAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDashboardPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "dashboard", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/reports/dashboards" className="text-xs text-muted-foreground hover:underline">← Dashboards</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New dashboard</h1>
      <Card className="p-6">
        <form action={createDashboardAction} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={160} placeholder="e.g. Sales overview" />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={500} />
          </div>
          <div className="flex justify-end"><Button type="submit">Create</Button></div>
        </form>
      </Card>
    </div>
  );
}
