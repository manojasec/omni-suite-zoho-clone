import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createCandidateAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function NewCandidatePage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "candidate", "create");
  return (
    <div className="space-y-4">
      <Link href="/app/recruit/candidates" className="text-sm text-muted-foreground hover:underline">← Candidates</Link>
      <h1 className="text-2xl font-semibold tracking-tight">Add candidate</h1>
      <Card className="p-6">
        <form action={createCandidateAction} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required maxLength={80} /></div>
            <div><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required maxLength={80} /></div>
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required maxLength={160} /></div>
            <div><Label htmlFor="phone">Phone</Label><Input id="phone" name="phone" maxLength={40} /></div>
            <div className="md:col-span-2"><Label htmlFor="headline">Headline</Label><Input id="headline" name="headline" maxLength={160} placeholder="Senior Frontend Engineer" /></div>
            <div><Label htmlFor="location">Location</Label><Input id="location" name="location" maxLength={120} /></div>
            <div><Label htmlFor="source">Source</Label><Input id="source" name="source" maxLength={60} placeholder="Referral · LinkedIn" /></div>
            <div><Label htmlFor="linkedinUrl">LinkedIn URL</Label><Input id="linkedinUrl" name="linkedinUrl" type="url" maxLength={300} /></div>
            <div><Label htmlFor="resumeUrl">Resume URL</Label><Input id="resumeUrl" name="resumeUrl" type="url" maxLength={500} /></div>
          </div>
          <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" rows={4} maxLength={4000} /></div>
          <div className="flex justify-end gap-2">
            <Link href="/app/recruit/candidates"><Button type="button" variant="outline">Cancel</Button></Link>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
