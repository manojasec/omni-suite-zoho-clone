import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ASSIGNABLE_DEFAULT_ROLES,
  SSO_LOGIN_KIND_LABELS,
  SSO_PROTOCOLS,
  SSO_PROTOCOL_LABELS,
  SSO_PROVIDER_STATUSES,
  SSO_PROVIDER_STATUS_LABELS,
  SSO_PROVIDER_TRANSITIONS,
  formatDate,
} from "@/modules/sso/schemas";
import {
  deleteSsoProviderAction,
  transitionSsoProviderAction,
  updateSsoProviderAction,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function SsoProviderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "view");

  const provider = await prisma.ssoProvider.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
  });
  if (!provider) notFound();

  const events = await prisma.ssoLoginEvent.findMany({
    where: { providerId: provider.id },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  const canEdit = can(ctx.role, "ssoProvider", "edit");
  const canManage = can(ctx.role, "ssoProvider", "manage");
  const canDelete = can(ctx.role, "ssoProvider", "delete");

  const updateBound = updateSsoProviderAction.bind(null, provider.id);
  const transitionBound = transitionSsoProviderAction.bind(null, provider.id);
  const deleteBound = deleteSsoProviderAction.bind(null, provider.id);

  const transitions = SSO_PROVIDER_TRANSITIONS[provider.status] ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
          <p className="text-sm text-muted-foreground">
            {SSO_PROTOCOL_LABELS[provider.protocol]} ·{" "}
            {SSO_PROVIDER_STATUS_LABELS[provider.status]}
            {provider.domain ? ` · @${provider.domain}` : ""}
          </p>
        </div>
        {canDelete && provider.status !== "ACTIVE" ? (
          <form action={deleteBound}>
            <Button type="submit" variant="outline">
              Delete
            </Button>
          </form>
        ) : null}
      </div>

      {transitions.length > 0 && canManage ? (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <span className="text-sm text-muted-foreground">Status →</span>
          {transitions.map((t) => (
            <form key={t} action={transitionBound}>
              <input type="hidden" name="to" value={t} />
              <Button type="submit" size="sm" variant="outline">
                {SSO_PROVIDER_STATUS_LABELS[t]}
              </Button>
            </form>
          ))}
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">Configuration</h2>
        <form action={updateBound} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              defaultValue={provider.name}
              required
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="protocol">Protocol</Label>
            <Select
              id="protocol"
              name="protocol"
              defaultValue={provider.protocol}
              disabled={!canEdit}
            >
              {SSO_PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {SSO_PROTOCOL_LABELS[p]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="domain">Email domain</Label>
            <Input
              id="domain"
              name="domain"
              defaultValue={provider.domain ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              id="status"
              name="status"
              defaultValue={provider.status}
              disabled={!canEdit}
            >
              {SSO_PROVIDER_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {SSO_PROVIDER_STATUS_LABELS[st]}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="entityId">Entity ID / Issuer</Label>
            <Input
              id="entityId"
              name="entityId"
              defaultValue={provider.entityId}
              required
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ssoUrl">SSO URL</Label>
            <Input
              id="ssoUrl"
              name="ssoUrl"
              type="url"
              defaultValue={provider.ssoUrl}
              required
              disabled={!canEdit}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="sloUrl">SLO URL</Label>
            <Input
              id="sloUrl"
              name="sloUrl"
              type="url"
              defaultValue={provider.sloUrl ?? ""}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="emailAttr">Email attribute</Label>
            <Input
              id="emailAttr"
              name="emailAttr"
              defaultValue={provider.emailAttr}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="nameAttr">Name attribute</Label>
            <Input
              id="nameAttr"
              name="nameAttr"
              defaultValue={provider.nameAttr}
              disabled={!canEdit}
            />
          </div>
          <div>
            <Label htmlFor="defaultRole">Default role</Label>
            <Select
              id="defaultRole"
              name="defaultRole"
              defaultValue={provider.defaultRole}
              disabled={!canEdit}
            >
              {ASSIGNABLE_DEFAULT_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="certificate">x509 certificate (PEM)</Label>
            <Textarea
              id="certificate"
              name="certificate"
              rows={6}
              defaultValue={provider.certificate ?? ""}
              disabled={!canEdit}
            />
          </div>
          {canEdit ? (
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit">Save</Button>
            </div>
          ) : null}
        </form>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent login events</h2>
          <Link
            href="/app/sso/events"
            className="text-xs text-muted-foreground hover:underline"
          >
            View all →
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events recorded.</p>
        ) : (
          <ul className="divide-y text-sm">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{e.email}</div>
                  {e.reason ? (
                    <div className="text-xs text-muted-foreground">{e.reason}</div>
                  ) : null}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{SSO_LOGIN_KIND_LABELS[e.kind]}</div>
                  <div>{formatDate(e.occurredAt)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
