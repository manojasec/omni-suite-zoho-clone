import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const STATUSES = [
  { name: "Open", color: "bg-blue-500", description: "New ticket awaiting triage" },
  { name: "Pending", color: "bg-amber-500", description: "Waiting on customer response" },
  { name: "On hold", color: "bg-slate-500", description: "Blocked on internal dependency" },
  { name: "Resolved", color: "bg-emerald-500", description: "Issue addressed; awaiting closure" },
  { name: "Closed", color: "bg-zinc-700", description: "Final state" },
];

export default async function TicketStatusesPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ticket statuses</h1>
        <p className="text-sm text-muted-foreground">
          Default statuses used by the helpdesk pipeline.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Default workflow</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y">
            {STATUSES.map((s) => (
              <li key={s.name} className="flex items-center gap-3 p-3">
                <span className={`h-3 w-3 rounded-full ${s.color}`} aria-hidden />
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Custom statuses and workflows are planned for the Professional plan.
      </p>
    </div>
  );
}
