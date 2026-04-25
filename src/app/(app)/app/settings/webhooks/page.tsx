import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { assertPlanFeature, getWorkspacePlan } from "@/modules/billing/limits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const EVENTS = [
  "contact.created", "contact.updated",
  "deal.created", "deal.stage_changed", "deal.won", "deal.lost",
  "invoice.sent", "invoice.paid",
  "ticket.created", "ticket.assigned", "ticket.resolved",
  "form.submitted",
];

export default async function WebhooksPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.webhooks", "view");
  const ws = await getWorkspacePlan(ctx.workspaceId);
  const featureAvailable = ws.definition.features.webhooks;
  // Best-effort soft check; do not throw on the page render.
  try {
    if (featureAvailable) await assertPlanFeature(ctx.workspaceId, "webhooks");
  } catch {
    // ignore
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outgoing webhooks</h1>
        <p className="text-sm text-muted-foreground">
          POST events to your endpoints in real time. Available on Starter plan and above.
        </p>
      </div>

      {!featureAvailable ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Webhooks require the Starter plan or higher. Visit <code>Settings → Billing</code> to upgrade.
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Available events</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {EVENTS.map((e) => (
              <code key={e} className="rounded bg-muted px-2 py-1 text-xs">{e}</code>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Configured endpoints</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Endpoint configuration UI is on the roadmap. Contact support to provision endpoints during beta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
