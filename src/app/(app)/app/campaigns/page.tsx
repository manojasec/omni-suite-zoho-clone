import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-foreground",
  SCHEDULED: "bg-amber-100 text-amber-900",
  SENDING: "bg-blue-100 text-blue-900",
  SENT: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-900",
};

export default async function CampaignsPage() {
  const ctx = await requireSession();
  const [campaigns, audiences] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { audience: { select: { id: true, name: true } } },
      take: 100,
    }),
    prisma.audience.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { campaigns: true } } },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email campaigns</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast email to contact audiences (mock provider in development).
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/app/campaigns/audiences/new"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
          >
            <Plus className="h-4 w-4" /> Audience
          </Link>
          <Link
            href="/app/campaigns/new"
            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Campaigns</h2>
        <Card>
          <CardContent className="p-0">
            {campaigns.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No campaigns yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Audience</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Scheduled</th>
                    <th className="px-3 py-2 text-left">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id} className="border-b hover:bg-accent/40">
                      <td className="px-3 py-2">
                        <Link href={`/app/campaigns/${c.id}`} className="font-medium hover:underline">
                          {c.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{c.subject}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.audience?.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[c.status] ?? ""}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {c.scheduledAt ? new Date(c.scheduledAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {c.sentAt ? new Date(c.sentAt).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Audiences</h2>
        <Card>
          <CardContent className="p-0">
            {audiences.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No audiences yet.</p>
            ) : (
              <ul className="divide-y">
                {audiences.map((a) => (
                  <li key={a.id} className="flex items-center justify-between px-3 py-2">
                    <Link href={`/app/campaigns/audiences/${a.id}`} className="font-medium hover:underline">
                      {a.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      Used in {a._count.campaigns} campaign{a._count.campaigns === 1 ? "" : "s"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
