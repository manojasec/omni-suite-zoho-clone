import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/card";

export function ModuleStub({
  title,
  description,
  features,
  milestone,
}: {
  title: string;
  description: string;
  features: string[];
  milestone: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Badge className="border-amber-300 bg-amber-50 text-amber-800">Scheduled · {milestone}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What ships in this module</CardTitle>
          <CardDescription>Tracked in the MVP PRD; UI scaffolded, logic incoming.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 rounded-md border p-3 text-sm">
                <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
