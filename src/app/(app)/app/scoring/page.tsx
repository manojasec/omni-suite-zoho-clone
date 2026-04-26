import Link from "next/link";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EVENT_TYPE_LABELS,
  LEAD_SCORE_EVENT_TYPES,
  DEFAULT_POINTS,
  scoreBucket,
  scoreBucketClass,
} from "@/modules/scoring/schemas";
import {
  createRuleAction,
  toggleRuleAction,
  deleteRuleAction,
  viewContactScoreAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function ScoringDashboardPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "leadScoreRule", "view");

  const [rules, totals] = await Promise.all([
    prisma.leadScoreRule.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }),
    prisma.leadScoreEvent.groupBy({
      by: ["contactId"],
      where: { workspaceId: ctx.workspaceId },
      _sum: { points: true },
      orderBy: { _sum: { points: "desc" } },
      take: 25,
    }),
  ]);

  const contactIds = totals.map((t) => t.contactId);
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { id: { in: contactIds }, workspaceId: ctx.workspaceId },
        select: { id: true, firstName: true, lastName: true, email: true, lifecycleStage: true },
      })
    : [];
  const contactById = new Map(contacts.map((c) => [c.id, c]));

  const contactOptions = await prisma.contact.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, firstName: true, lastName: true, email: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const canManageRules = can(ctx.role, "leadScoreRule", "create");
  const canDeleteRules = can(ctx.role, "leadScoreRule", "delete");

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead scoring</h1>
          <p className="text-sm text-muted-foreground">
            Top contacts ranked by accumulated score from rule-driven and manual events.
          </p>
        </div>
        <Card className="divide-y">
          {totals.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No scoring activity yet. Add rules and record events.
            </div>
          ) : (
            totals.map((t) => {
              const c = contactById.get(t.contactId);
              const score = t._sum.points ?? 0;
              return (
                <div key={t.contactId} className="flex items-center justify-between gap-3 p-3">
                  <div>
                    <Link
                      href={`/app/scoring/contacts/${t.contactId}`}
                      className="font-medium hover:underline"
                    >
                      {c
                        ? `${c.firstName}${c.lastName ? " " + c.lastName : ""}`
                        : "(deleted contact)"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {c?.email ?? "—"}
                      {c?.lifecycleStage ? ` · ${c.lifecycleStage}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      "inline-flex items-center gap-2 rounded px-2 py-0.5 text-xs font-medium " +
                      scoreBucketClass(score)
                    }
                  >
                    {scoreBucket(score)} · {score}
                  </span>
                </div>
              );
            })
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Look up a contact</h2>
          <form action={viewContactScoreAction} className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="contactId">Contact</Label>
              <Select id="contactId" name="contactId" required>
                <option value="">Select a contact…</option>
                {contactOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName}
                    {c.lastName ? " " + c.lastName : ""}
                    {c.email ? ` — ${c.email}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline">View score</Button>
          </form>
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-2">Scoring rules</h2>
          {rules.length === 0 ? (
            <p className="text-xs text-muted-foreground">No rules yet.</p>
          ) : (
            <ul className="divide-y text-sm">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-medium">{r.name}</span>
                    <p className="text-xs text-muted-foreground">
                      {EVENT_TYPE_LABELS[r.eventType]} ·{" "}
                      <span className={r.points >= 0 ? "text-emerald-600" : "text-rose-600"}>
                        {r.points >= 0 ? `+${r.points}` : r.points}
                      </span>{" "}
                      points {r.active ? "" : "· paused"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageRules ? (
                      <form action={toggleRuleAction.bind(null, r.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          {r.active ? "Pause" : "Resume"}
                        </Button>
                      </form>
                    ) : null}
                    {canDeleteRules ? (
                      <form action={deleteRuleAction.bind(null, r.id)}>
                        <Button type="submit" size="sm" variant="outline">
                          Delete
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {canManageRules ? (
            <form action={createRuleAction} className="mt-3 space-y-2 border-t pt-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">New rule</h3>
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required maxLength={160} placeholder="e.g. Pricing page click" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="eventType">Event</Label>
                  <Select id="eventType" name="eventType" defaultValue="EMAIL_CLICKED">
                    {LEAD_SCORE_EVENT_TYPES.filter((t) => t !== "MANUAL").map((t) => (
                      <option key={t} value={t}>{EVENT_TYPE_LABELS[t]}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="points">Points</Label>
                  <Input id="points" name="points" type="number" defaultValue={DEFAULT_POINTS.EMAIL_CLICKED} required />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" name="active" defaultChecked />
                Active
              </label>
              <div className="flex justify-end">
                <Button type="submit" size="sm">Create rule</Button>
              </div>
            </form>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
