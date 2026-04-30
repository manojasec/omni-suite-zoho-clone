import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { APPROVAL_RESOURCES } from "@/modules/approvals/schemas";
import { createApprovalRequestAction } from "../actions";

export default async function NewApprovalPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "create");

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          New approval request
        </h1>
      </div>
      <Card className="p-4">
        <form action={createApprovalRequestAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="resource">Resource</Label>
              <Select id="resource" name="resource" required defaultValue="expense">
                {APPROVAL_RESOURCES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="resourceId">Resource ID</Label>
              <Input id="resourceId" name="resourceId" required maxLength={40} />
            </div>
          </div>
          <div>
            <Label htmlFor="amount">Amount (optional)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min={0}
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" name="reason" rows={4} maxLength={2000} />
          </div>
          <div className="flex gap-2">
            <Button type="submit">Submit request</Button>
            <Link href="/app/approvals">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
