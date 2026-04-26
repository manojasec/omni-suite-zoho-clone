import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { PivotForm } from "../pivot-form";
import { createPivotReportAction } from "../actions";

export default async function NewPivotReportPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "pivotReport", "create");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">New pivot table</h1>
      <Card className="p-6">
        <PivotForm action={createPivotReportAction} submitLabel="Create" />
      </Card>
    </div>
  );
}
