import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { getWorkspacePlan } from "@/modules/billing/limits";
import { ORDERED_PLANS } from "@/modules/billing/plans";
import { isStripeEnabled } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingActions } from "./billing-actions";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.billing", "view");
  const canEdit = can(ctx.role, "settings.billing", "edit");
  const stripeOn = isStripeEnabled();
  const ws = await getWorkspacePlan(ctx.workspaceId);
  const { status } = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace subscription, plan, and feature limits.
        </p>
      </div>

      {status === "success" ? (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          Checkout complete. Your plan will be updated within seconds.
        </div>
      ) : null}
      {status === "cancel" ? (
        <div className="rounded-md border bg-muted p-3 text-sm">Checkout canceled.</div>
      ) : null}
      {!stripeOn ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Stripe is not configured. Set <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>, and{" "}
          <code>STRIPE_PRICE_*</code> env vars to enable subscription billing.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold">{ws.definition.label}</span>
            {ws.subscriptionStatus ? (
              <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase">
                {ws.subscriptionStatus}
              </span>
            ) : null}
          </div>
          {ws.trialEndsAt && new Date(ws.trialEndsAt) > new Date() ? (
            <p className="text-muted-foreground">
              Trial ends on {new Date(ws.trialEndsAt).toLocaleDateString()}.
            </p>
          ) : null}
          {ws.currentPeriodEnd ? (
            <p className="text-muted-foreground">
              Current period ends {new Date(ws.currentPeriodEnd).toLocaleDateString()}.
            </p>
          ) : null}
          {canEdit && stripeOn && ws.stripeCustomerId ? (
            <BillingActions mode="portal" />
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ORDERED_PLANS.map((p) => {
          const isCurrent = p.key === ws.plan;
          return (
            <Card key={p.key} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle className="flex items-baseline justify-between gap-2">
                  <span>{p.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {p.priceMonthly === 0 ? "Free" : `$${p.priceMonthly}/mo`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">{p.description}</p>
                <ul className="space-y-1 text-xs">
                  <li>Up to {fmt(p.limits.users)} users</li>
                  <li>{fmt(p.limits.contacts)} contacts</li>
                  <li>{fmt(p.limits.deals)} deals</li>
                  <li>{fmt(p.limits.invoices)} invoices/yr</li>
                  <li>{fmt(p.limits.projects)} projects</li>
                  <li>{fmt(p.limits.tickets)} tickets</li>
                  <li>{fmt(p.limits.campaigns)} campaigns</li>
                  <li>{fmt(p.limits.forms)} forms</li>
                </ul>
                <ul className="space-y-1 text-xs">
                  <li className={p.features.advancedReports ? "" : "text-muted-foreground line-through"}>Advanced reports</li>
                  <li className={p.features.customRoles ? "" : "text-muted-foreground line-through"}>Custom roles</li>
                  <li className={p.features.webhooks ? "" : "text-muted-foreground line-through"}>Webhooks</li>
                  <li className={p.features.apiAccess ? "" : "text-muted-foreground line-through"}>API access</li>
                  <li className={p.features.sso ? "" : "text-muted-foreground line-through"}>SSO</li>
                  <li className={p.features.auditLog ? "" : "text-muted-foreground line-through"}>Audit log</li>
                </ul>
                {isCurrent ? (
                  <span className="inline-block rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                    Current plan
                  </span>
                ) : canEdit && stripeOn && p.key !== "FREE" ? (
                  <BillingActions
                    mode="checkout"
                    plan={p.key as "STARTER" | "PROFESSIONAL" | "ENTERPRISE"}
                    label={`Upgrade to ${p.label}`}
                  />
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function fmt(n: number) {
  if (n === -1) return "Unlimited";
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return n.toString();
}
