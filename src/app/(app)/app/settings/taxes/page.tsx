import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function TaxesPage() {
  const ctx = await requireSession();
  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { currency: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Taxes</h1>
        <p className="text-sm text-muted-foreground">
          Configure tax rates applied to invoices. Workspace currency: {ws?.currency ?? "USD"}.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Tax rates</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Invoices currently support a free-form tax rate per line item. A managed tax rate library is
            planned — for now, enter rates manually on each invoice line.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
