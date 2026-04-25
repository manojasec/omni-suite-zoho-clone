import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import {
  sendEnvelopeAction,
  cancelEnvelopeAction,
  deleteEnvelopeAction,
} from "../actions";

export const dynamic = "force-dynamic";

const signerStatusColor: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  VIEWED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  SIGNED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  DECLINED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export default async function EnvelopeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireSession();
  const { id } = await params;
  const env = await prisma.signatureEnvelope.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: {
      signers: { orderBy: { order: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!env) notFound();

  const canEdit = can(ctx.role, "signatureEnvelope", "edit");
  const canDelete = can(ctx.role, "signatureEnvelope", "delete");
  const canSend = canEdit && env.status === "DRAFT" && env.signers.length > 0;
  const canCancel =
    canEdit && (env.status === "SENT" || env.status === "VIEWED" || env.status === "DRAFT");
  const canDeleteEnv =
    canDelete && (env.status === "DRAFT" || env.status === "CANCELLED");

  // Build sign URLs based on request origin so links are clickable from this view.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/app/esign" className="hover:underline">E-Signature</Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{env.title}</h1>
          <p className="text-sm text-muted-foreground">
            <a href={env.documentUrl} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline">View document →</a>
            {env.expiresAt ? <> · Expires {env.expiresAt.toISOString().slice(0, 10)}</> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{env.status}</span>
          {canSend ? (
            <form action={sendEnvelopeAction.bind(null, env.id)}>
              <Button type="submit" size="sm">Send</Button>
            </form>
          ) : null}
          {canCancel ? (
            <form action={cancelEnvelopeAction.bind(null, env.id)}>
              <Button type="submit" size="sm" variant="ghost">Cancel</Button>
            </form>
          ) : null}
          {canDeleteEnv ? (
            <form action={deleteEnvelopeAction.bind(null, env.id)}>
              <Button type="submit" size="sm" variant="destructive">Delete</Button>
            </form>
          ) : null}
        </div>
      </div>

      {env.message ? (
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Message</div>
          <p className="text-sm whitespace-pre-wrap">{env.message}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="px-4 py-2 bg-muted/40 text-sm font-semibold">Signers</div>
        <table className="w-full text-sm">
          <thead className="text-left">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Signed</th>
              <th className="px-4 py-2 font-medium">Sign link</th>
            </tr>
          </thead>
          <tbody>
            {env.signers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2 tabular-nums">{s.order}</td>
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{s.email}</td>
                <td className="px-4 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${signerStatusColor[s.status]}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2 tabular-nums text-muted-foreground">
                  {s.signedAt ? s.signedAt.toISOString().slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td className="px-4 py-2">
                  {env.status === "DRAFT" || s.status === "SIGNED" || s.status === "DECLINED" ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <a
                      href={`${origin}/sign/${s.accessToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline break-all"
                    >
                      Open sign link
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {env.signers.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No signers.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-2 bg-muted/40 text-sm font-semibold">Audit trail</div>
        <ul className="divide-y text-sm">
          {env.events.map((ev) => (
            <li key={ev.id} className="px-4 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{ev.type}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {ev.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </span>
              </div>
              {ev.detail ? <div className="text-xs text-muted-foreground mt-0.5">{ev.detail}</div> : null}
              {ev.ip ? <div className="text-[10px] text-muted-foreground/70">IP: {ev.ip}</div> : null}
            </li>
          ))}
          {env.events.length === 0 ? (
            <li className="px-4 py-8 text-center text-muted-foreground">No events yet.</li>
          ) : null}
        </ul>
      </Card>
    </div>
  );
}
