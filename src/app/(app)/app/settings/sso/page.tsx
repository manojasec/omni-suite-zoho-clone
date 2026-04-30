import { requireSession } from "@/lib/session";
import { assertCan, can } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  createScimTokenAction,
  revokeScimTokenAction,
  saveSamlConnectionAction,
  setSamlStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsSsoPage({
  searchParams,
}: {
  searchParams: Promise<{ newToken?: string }>;
}) {
  const ctx = await requireSession();
  assertCan(ctx.role, "samlConnection", "view");
  const canManage = can(ctx.role, "samlConnection", "manage");
  const canCreateToken = can(ctx.role, "scimToken", "create");
  const canRevokeToken = can(ctx.role, "scimToken", "delete");

  const { newToken } = await searchParams;

  const [saml, tokens] = await Promise.all([
    prisma.samlConnection.findUnique({
      where: { workspaceId: ctx.workspaceId },
    }),
    prisma.scimToken.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Workspace SSO &amp; SCIM
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure SAML 2.0 single sign-on and provision users via SCIM 2.0.
        </p>
      </div>

      {newToken ? (
        <Card className="border-emerald-300 bg-emerald-50 p-4 text-sm">
          <div className="font-semibold text-emerald-900">
            New SCIM token — copy it now, it won&apos;t be shown again:
          </div>
          <code className="mt-2 block break-all rounded bg-background p-2 text-xs">
            {newToken}
          </code>
        </Card>
      ) : null}

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">SAML 2.0 connection</h2>
            <p className="text-xs text-muted-foreground">
              {saml ? `Status: ${saml.status}` : "Not configured"}
            </p>
          </div>
          {canManage && saml ? (
            <div className="flex gap-2">
              {saml.status !== "ACTIVE" ? (
                <form action={setSamlStatusAction.bind(null, "ACTIVE")}>
                  <Button type="submit" size="sm">
                    Activate
                  </Button>
                </form>
              ) : (
                <form action={setSamlStatusAction.bind(null, "DISABLED")}>
                  <Button type="submit" size="sm" variant="ghost">
                    Disable
                  </Button>
                </form>
              )}
            </div>
          ) : null}
        </div>

        {canManage ? (
          <form action={saveSamlConnectionAction} className="space-y-2">
            <div>
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={160}
                defaultValue={saml?.name ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="idpEntityId">IdP Entity ID</Label>
              <Input
                id="idpEntityId"
                name="idpEntityId"
                required
                maxLength={500}
                defaultValue={saml?.idpEntityId ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="idpSsoUrl">IdP SSO URL</Label>
              <Input
                id="idpSsoUrl"
                name="idpSsoUrl"
                type="url"
                required
                maxLength={500}
                defaultValue={saml?.idpSsoUrl ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="spEntityId">SP Entity ID</Label>
              <Input
                id="spEntityId"
                name="spEntityId"
                required
                maxLength={500}
                defaultValue={
                  saml?.spEntityId ??
                  `urn:omnisuite:workspace:${ctx.workspaceSlug}`
                }
              />
            </div>
            <div>
              <Label htmlFor="idpCertificate">IdP X.509 Certificate (PEM)</Label>
              <textarea
                id="idpCertificate"
                name="idpCertificate"
                required
                rows={6}
                defaultValue={saml?.idpCertificate ?? ""}
                className="w-full rounded border bg-background p-2 font-mono text-xs"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm">
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-xs text-muted-foreground">
            View-only. Workspace owner permissions required to edit.
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">SCIM 2.0 tokens</h2>
            <p className="text-xs text-muted-foreground">
              Bearer tokens for /scim/v2 user provisioning endpoints.
            </p>
          </div>
        </div>

        {canCreateToken ? (
          <form action={createScimTokenAction} className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="name" className="sr-only">
                Name
              </Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={160}
                placeholder="e.g. Okta production"
              />
            </div>
            <Button type="submit" size="sm">
              Create token
            </Button>
          </form>
        ) : null}

        {tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="divide-y">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <code>{t.prefix}…</code> · created{" "}
                    {t.createdAt.toISOString().slice(0, 10)}
                    {t.revokedAt
                      ? ` · revoked ${t.revokedAt.toISOString().slice(0, 10)}`
                      : ""}
                  </div>
                </div>
                {canRevokeToken && !t.revokedAt ? (
                  <form action={revokeScimTokenAction.bind(null, t.id)}>
                    <Button type="submit" size="sm" variant="ghost">
                      Revoke
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
