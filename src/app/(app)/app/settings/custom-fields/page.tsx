import { requireSession } from "@/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const MODULES = [
  { key: "contact", label: "Contacts" },
  { key: "company", label: "Companies" },
  { key: "deal", label: "Deals" },
  { key: "ticket", label: "Tickets" },
  { key: "project", label: "Projects" },
  { key: "task", label: "Tasks" },
  { key: "product", label: "Products" },
];

export default async function CustomFieldsPage() {
  await requireSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Custom fields</h1>
        <p className="text-sm text-muted-foreground">
          Tailor records to your business by adding custom fields per module.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Modules</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {MODULES.map((m) => (
              <li key={m.key} className="flex items-center justify-between py-2">
                <span>{m.label}</span>
                <span className="text-xs text-muted-foreground">No custom fields configured</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Custom field UI is available on Professional plans. Field types planned: text, number, date,
            boolean, select, multi-select, URL, email.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
