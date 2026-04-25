import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const PROVIDERS = [
  { name: "Slack", description: "Send notifications to a Slack channel.", status: "Coming soon" },
  { name: "Zapier", description: "Connect OmniSuite to 5,000+ apps via Zapier.", status: "Coming soon" },
  { name: "Make.com", description: "Build automations with Make scenarios.", status: "Coming soon" },
  { name: "Google Workspace", description: "Calendar + contact sync for SDRs.", status: "Coming soon" },
  { name: "Microsoft 365", description: "Outlook + Teams integration.", status: "Coming soon" },
  { name: "Webhooks", description: "Native outgoing webhooks (configure in Webhooks tab).", status: "Available" },
];

export default async function IntegrationsPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect OmniSuite to the tools your team already uses.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROVIDERS.map((p) => (
          <Card key={p.name}>
            <CardHeader>
              <CardTitle className="flex items-baseline justify-between gap-2 text-base">
                <span>{p.name}</span>
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-normal">{p.status}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
