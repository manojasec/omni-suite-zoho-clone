import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSurveyAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSurveyPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "survey", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/surveys" className="text-xs text-muted-foreground hover:underline">← Surveys</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New survey</h1>
      <Card className="p-6">
        <form action={createSurveyAction} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={160} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={1000} />
          </div>
          <div>
            <Label htmlFor="thankYouText">Thank-you message</Label>
            <Textarea id="thankYouText" name="thankYouText" rows={2} maxLength={500} placeholder="Thanks for your feedback!" />
          </div>
          <div>
            <Label htmlFor="closesAt">Closes at (optional)</Label>
            <Input id="closesAt" name="closesAt" type="datetime-local" />
          </div>
          <div className="flex justify-end"><Button type="submit">Create</Button></div>
        </form>
      </Card>
    </div>
  );
}
