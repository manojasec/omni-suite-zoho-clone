import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EMPLOYMENT_TYPES, JOB_STATUSES } from "@/modules/recruit/schemas";
import { createJobAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "jobOpening", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/recruit/jobs" className="text-sm text-muted-foreground hover:underline">← Job openings</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New job</h1>
      <Card className="p-6">
        <form action={createJobAction} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required maxLength={120} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="department">Department</Label>
              <Input id="department" name="department" maxLength={80} />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="employment">Employment type</Label>
              <Select id="employment" name="employment" defaultValue="FULL_TIME">
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue="DRAFT">
                {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="remote" name="remote" />
              <Label htmlFor="remote">Remote-friendly</Label>
            </div>
            <div>
              <Label htmlFor="openings">Number of openings</Label>
              <Input id="openings" name="openings" type="number" min={1} defaultValue={1} />
            </div>
            <div>
              <Label htmlFor="salaryMin">Salary min</Label>
              <Input id="salaryMin" name="salaryMin" type="number" step="0.01" min={0} />
            </div>
            <div>
              <Label htmlFor="salaryMax">Salary max</Label>
              <Input id="salaryMax" name="salaryMax" type="number" step="0.01" min={0} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" maxLength={3} defaultValue="USD" />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={6} maxLength={8000} />
          </div>
          <div className="flex justify-end gap-2">
            <Link href="/app/recruit/jobs"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Create job</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
