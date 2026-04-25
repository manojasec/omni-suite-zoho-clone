import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const POLICIES = [
  { priority: "URGENT", firstResponse: "15 min", resolution: "4 hours" },
  { priority: "HIGH", firstResponse: "1 hour", resolution: "8 hours" },
  { priority: "NORMAL", firstResponse: "4 hours", resolution: "1 business day" },
  { priority: "LOW", firstResponse: "1 business day", resolution: "3 business days" },
];

export default async function SlaPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SLA policies</h1>
        <p className="text-sm text-muted-foreground">
          Service level targets used by helpdesk to surface breach risks on the ticket board.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Default policy</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Priority</th>
                <th className="px-3 py-2 text-left">First response</th>
                <th className="px-3 py-2 text-left">Resolution</th>
              </tr>
            </thead>
            <tbody>
              {POLICIES.map((p) => (
                <tr key={p.priority} className="border-b">
                  <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.priority}</span></td>
                  <td className="px-3 py-2">{p.firstResponse}</td>
                  <td className="px-3 py-2">{p.resolution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Custom SLA policies and per-customer overrides are planned for the Professional plan.
      </p>
    </div>
  );
}
