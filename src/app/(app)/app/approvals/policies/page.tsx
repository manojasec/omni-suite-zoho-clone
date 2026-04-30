import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import {
  APPROVAL_RESOURCES,
  decodeApprovers,
} from "@/modules/approvals/schemas";
import {
  createApprovalPolicyAction,
  deleteApprovalPolicyAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function ApprovalPoliciesPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "approval", "manage");

  const [policies, members] = await Promise.all([
    prisma.approvalPolicy.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ resource: "asc" }, { createdAt: "desc" }],
    }),
    prisma.membership.findMany({
      where: { workspaceId: ctx.workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 200,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Approval policies
        </h1>
        <Link
          href="/app/approvals"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Back
        </Link>
      </div>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">New policy</h2>
        <form action={createApprovalPolicyAction} className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required maxLength={120} />
            </div>
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
              <Label htmlFor="threshold">Threshold (optional)</Label>
              <Input
                id="threshold"
                name="threshold"
                type="number"
                step="0.01"
                min={0}
              />
            </div>
            <div className="flex items-end gap-2">
              <input
                id="isActive"
                name="isActive"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <div>
            <Label htmlFor="approverIds">Approvers</Label>
            <Select
              id="approverIds"
              name="approverIds"
              multiple
              required
              size={Math.min(8, Math.max(3, members.length))}
            >
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name ?? m.user.email}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Button type="submit">Create policy</Button>
          </div>
        </form>
      </Card>

      {policies.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No policies yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {policies.map((p) => {
            const approvers = decodeApprovers(p.approverIds);
            const del = deleteApprovalPolicyAction.bind(null, p.id);
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 p-4 text-sm"
              >
                <div className="flex-1">
                  <div className="font-semibold">
                    {p.name}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {p.resource}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {p.threshold != null
                      ? `Threshold ≥ ${Number(p.threshold).toFixed(2)}`
                      : "Always applies"}{" "}
                    · {approvers.length} approver(s) ·{" "}
                    {p.isActive ? "active" : "inactive"}
                  </div>
                </div>
                <form action={del}>
                  <Button type="submit" size="sm" variant="ghost">
                    Delete
                  </Button>
                </form>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
