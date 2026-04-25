import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APPLICATION_STAGES, INTERVIEW_KINDS, INTERVIEW_OUTCOMES } from "@/modules/recruit/schemas";
import {
  createInterviewAction,
  deleteInterviewAction,
  updateApplicationAction,
  updateInterviewOutcomeAction,
} from "../../actions";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireSession();
  assertCan(ctx.role, "application", "view");
  const { id } = await params;
  const app = await prisma.application.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      job: true,
      candidate: true,
      interviews: { orderBy: { scheduledAt: "asc" } },
    },
  });
  if (!app) notFound();
  const canEdit = can(ctx.role, "application", "edit");
  const canIv = can(ctx.role, "interview", "create");

  return (
    <div className="space-y-4">
      <Link href="/app/recruit/pipeline" className="text-xs text-muted-foreground hover:underline">← Pipeline</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <Link href={`/app/recruit/candidates/${app.candidate.id}`} className="hover:underline">{app.candidate.firstName} {app.candidate.lastName}</Link>
          <span className="text-muted-foreground"> · </span>
          <Link href={`/app/recruit/jobs/${app.job.id}`} className="hover:underline">{app.job.title}</Link>
        </h1>
        <p className="text-sm text-muted-foreground">
          Stage <span className="font-medium text-foreground">{app.stage}</span>
          {app.rating ? ` · Rating ${app.rating}/5` : ""}
          · Applied {app.appliedAt.toISOString().slice(0, 10)}
        </p>
      </div>

      {canEdit ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Update application</h2>
          <form action={updateApplicationAction.bind(null, app.id)} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label htmlFor="stage">Stage</Label>
                <Select id="stage" name="stage" defaultValue={app.stage}>
                  {APPLICATION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor="rating">Rating (1-5)</Label>
                <Input id="rating" name="rating" type="number" min={1} max={5} defaultValue={app.rating ?? ""} />
              </div>
              <div>
                <Label htmlFor="rejectedReason">Rejected reason</Label>
                <Input id="rejectedReason" name="rejectedReason" maxLength={500} defaultValue={app.rejectedReason ?? ""} />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={4} defaultValue={app.notes ?? ""} />
            </div>
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        </Card>
      ) : null}

      <Card className="p-0 overflow-hidden">
        <div className="bg-muted px-3 py-2 text-sm font-semibold">Interviews ({app.interviews.length})</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-1 text-left">When</th><th className="px-3 py-1 text-left">Kind</th><th className="px-3 py-1 text-left">Interviewer</th><th className="px-3 py-1 text-left">Outcome</th><th className="px-3 py-1" /></tr>
          </thead>
          <tbody>
            {app.interviews.map((iv) => (
              <tr key={iv.id} className="border-t">
                <td className="px-3 py-2">{iv.scheduledAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="px-3 py-2 text-xs">{iv.kind}</td>
                <td className="px-3 py-2 text-muted-foreground">{iv.interviewer ?? ""}</td>
                <td className="px-3 py-2">
                  {can(ctx.role, "interview", "edit") ? (
                    <form action={updateInterviewOutcomeAction.bind(null, iv.id)} className="flex gap-1">
                      <Select name="outcome" defaultValue={iv.outcome} className="h-8 text-xs">
                        {INTERVIEW_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                      <input type="hidden" name="feedback" value={iv.feedback ?? ""} />
                      <Button type="submit" size="sm" variant="outline">Save</Button>
                    </form>
                  ) : iv.outcome}
                </td>
                <td className="px-3 py-2 text-right">
                  {can(ctx.role, "interview", "delete") ? (
                    <form action={deleteInterviewAction.bind(null, iv.id)}>
                      <Button type="submit" size="sm" variant="ghost">Remove</Button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {app.interviews.length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No interviews scheduled.</td></tr> : null}
          </tbody>
        </table>
      </Card>

      {canIv ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">Schedule interview</h2>
          <form action={createInterviewAction.bind(null, app.id)} className="grid gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="kind">Kind</Label>
              <Select id="kind" name="kind" defaultValue="VIDEO">
                {INTERVIEW_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="scheduledAt">When</Label>
              <Input id="scheduledAt" name="scheduledAt" type="datetime-local" required />
            </div>
            <div>
              <Label htmlFor="durationMins">Duration (mins)</Label>
              <Input id="durationMins" name="durationMins" type="number" min={5} max={480} defaultValue={45} />
            </div>
            <div>
              <Label htmlFor="interviewer">Interviewer</Label>
              <Input id="interviewer" name="interviewer" maxLength={120} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="location">Location / link</Label>
              <Input id="location" name="location" maxLength={200} />
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="feedback">Notes</Label>
              <Textarea id="feedback" name="feedback" rows={2} maxLength={4000} />
            </div>
            <div className="md:col-span-3 flex justify-end"><Button type="submit">Schedule</Button></div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
