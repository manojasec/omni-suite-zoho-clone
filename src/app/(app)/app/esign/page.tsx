import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { can } from "@/platform/permissions";
import { createEnvelopeAction } from "./actions";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  VIEWED: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  COMPLETED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  DECLINED: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  EXPIRED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function EsignPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const ctx = await requireSession();
  const params = await searchParams;
  const status = params.status?.toUpperCase();
  const validStatuses = ["DRAFT", "SENT", "VIEWED", "COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"];

  const where = {
    workspaceId: ctx.workspaceId,
    ...(status && validStatuses.includes(status)
      ? { status: status as "DRAFT" | "SENT" | "VIEWED" | "COMPLETED" | "DECLINED" | "EXPIRED" | "CANCELLED" }
      : {}),
  };

  const envelopes = await prisma.signatureEnvelope.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { signers: true } },
      signers: { select: { status: true } },
    },
    take: 200,
  });

  const totals = await prisma.signatureEnvelope.groupBy({
    by: ["status"],
    where: { workspaceId: ctx.workspaceId },
    _count: { _all: true },
  });
  const tile = (s: string) => totals.find((t) => t.status === s)?._count._all ?? 0;

  const canCreate = can(ctx.role, "signatureEnvelope", "create");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">E-Signature</h1>
        <p className="text-sm text-muted-foreground">Send documents for signature and track responses.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {(["DRAFT", "SENT", "COMPLETED", "DECLINED"] as const).map((s) => (
          <Card key={s} className="p-4">
            <div className="text-xs uppercase text-muted-foreground">{s}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{tile(s)}</div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/app/esign" className={`rounded-full border px-3 py-1 ${!status ? "bg-primary text-primary-foreground" : ""}`}>All</Link>
        {validStatuses.map((s) => (
          <Link key={s} href={`/app/esign?status=${s}`}
            className={`rounded-full border px-3 py-1 ${status === s ? "bg-primary text-primary-foreground" : ""}`}>
            {s}
          </Link>
        ))}
      </div>

      {canCreate ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold">New envelope</h2>
          <form action={createEnvelopeAction} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" required placeholder="Master Services Agreement" />
              </div>
              <div>
                <Label htmlFor="documentUrl">Document URL *</Label>
                <Input id="documentUrl" name="documentUrl" type="url" required placeholder="https://example.com/contract.pdf" />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires at</Label>
                <Input id="expiresAt" name="expiresAt" type="date" />
              </div>
            </div>
            <div>
              <Label htmlFor="message">Message to signers</Label>
              <Textarea id="message" name="message" rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Signers (in order) *</Label>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-2">
                  <Input name="signerName" placeholder={`Signer ${i + 1} name`} />
                  <Input name="signerEmail" type="email" placeholder={`signer${i + 1}@example.com`} />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Leave extra rows blank if not used.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Create envelope</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Signers</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {envelopes.map((e) => {
              const signed = e.signers.filter((s) => s.status === "SIGNED").length;
              return (
                <tr key={e.id} className="border-t hover:bg-accent/30">
                  <td className="px-4 py-2">
                    <Link href={`/app/esign/${e.id}`} className="font-medium hover:underline">
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">
                    {signed} / {e._count.signers}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${statusColor[e.status]}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground tabular-nums">
                    {e.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              );
            })}
            {envelopes.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No envelopes yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
