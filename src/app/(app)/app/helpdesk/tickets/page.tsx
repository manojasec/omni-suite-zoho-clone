import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUSES = ["ALL", "OPEN", "PENDING", "ON_HOLD", "RESOLVED", "CLOSED"] as const;
const PRIORITY_COLOR: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700",
  HIGH: "bg-amber-100 text-amber-800",
  MEDIUM: "bg-blue-100 text-blue-700",
  LOW: "bg-zinc-100 text-zinc-700",
};
const STATUS_COLOR: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  PENDING: "bg-amber-100 text-amber-800",
  ON_HOLD: "bg-zinc-200 text-zinc-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-zinc-200 text-zinc-700",
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const ctx = await requireSession();
  const { status, q } = await searchParams;
  const tickets = await prisma.ticket.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(status && status !== "ALL" ? { status: status as "OPEN" } : {}),
      ...(q
        ? {
            OR: [
              { subject: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      requester: { select: { id: true, firstName: true, lastName: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <Link
          href="/app/helpdesk/tickets/new"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New ticket
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search subject or description…"
          className="h-9 w-full max-w-md rounded-md border bg-transparent px-3 text-sm"
        />
        {status ? <input type="hidden" name="status" value={status} /> : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => {
          const active = (s === "ALL" && !status) || s === status;
          const params = new URLSearchParams();
          if (s !== "ALL") params.set("status", s);
          if (q) params.set("q", q);
          const href = params.toString() ? `/app/helpdesk/tickets?${params}` : "/app/helpdesk/tickets";
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs ${active ? "bg-secondary" : "hover:bg-accent"}`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {tickets.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No tickets.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Subject</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Priority</th>
                  <th className="px-3 py-2 text-left">Requester</th>
                  <th className="px-3 py-2 text-left">Assignee</th>
                  <th className="px-3 py-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b hover:bg-accent/40">
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">#{t.number}</td>
                    <td className="px-3 py-2">
                      <Link href={`/app/helpdesk/tickets/${t.id}`} className="font-medium hover:underline">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLOR[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_COLOR[t.priority]}`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {t.requester ? `${t.requester.firstName ?? ""} ${t.requester.lastName ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{t.assignee ? (t.assignee.name ?? t.assignee.email) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
