import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  buildPortalUrl,
  formatPortalStatus,
  portalLinkStatus,
  portalStatusColor,
} from "@/modules/portal/schemas";
import {
  issuePortalLinkAction,
  revokePortalLinkAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function CustomerPortalAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "portal", "view");
  const canCreate = can(ctx.role, "portal", "create");
  const canRevoke = can(ctx.role, "portal", "delete");

  const customer = await prisma.customer.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, name: true, email: true },
  });
  if (!customer) notFound();

  const links = await prisma.portalAccess.findMany({
    where: { workspaceId: ctx.workspaceId, customerId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  return (
    <div className="space-y-4">
      <p>
        <Link
          href={`/app/billing/customers/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {customer.name}
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Customer portal links
        </h1>
        <p className="text-sm text-muted-foreground">
          Share a token-gated URL so this customer can view their invoices and quotes
          without signing up.
        </p>
      </div>

      {canCreate ? (
        <Card className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Issue a new link</h2>
          <form
            action={issuePortalLinkAction.bind(null, id)}
            className="grid gap-3 sm:grid-cols-3"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                name="label"
                placeholder="e.g. Q2 review"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="expiresAt">Expires</Label>
              <Input id="expiresAt" name="expiresAt" type="date" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit">Generate link</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {links.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No portal links yet.
        </Card>
      ) : (
        <Card className="divide-y p-0">
          {links.map((l) => {
            const status = portalLinkStatus({
              revokedAt: l.revokedAt,
              expiresAt: l.expiresAt,
            });
            const url = buildPortalUrl(origin, l.token);
            return (
              <div key={l.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${portalStatusColor(status)}`}
                  >
                    {formatPortalStatus(status)}
                  </span>
                  <span className="text-sm font-medium">
                    {l.label ?? "Untitled"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    issued {l.createdAt.toISOString().slice(0, 10)}
                    {l.expiresAt
                      ? ` · expires ${l.expiresAt.toISOString().slice(0, 10)}`
                      : ""}
                    {" · "}
                    used {l.useCount}×
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input readOnly value={url} className="font-mono text-xs" />
                  {canRevoke && status === "active" ? (
                    <form action={revokePortalLinkAction.bind(null, l.id)}>
                      <Button type="submit" size="sm" variant="ghost">
                        Revoke
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
