import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import {
  ASSIGNABLE_DEFAULT_ROLES,
  SSO_PROTOCOLS,
  SSO_PROTOCOL_LABELS,
  SSO_PROVIDER_STATUSES,
  SSO_PROVIDER_STATUS_LABELS,
} from "@/modules/sso/schemas";
import { createSsoProviderAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewSsoProviderPage() {
  const ctx = await requireSession();
  assertCan(ctx.role, "ssoProvider", "create");

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New SSO provider</h1>
        <p className="text-sm text-muted-foreground">
          Configure a SAML 2.0 or OIDC identity provider. Save as DRAFT and activate
          once the certificate and domain are verified.
        </p>
      </div>

      <Card className="p-4">
        <form action={createSsoProviderAction} className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={160}
              placeholder="Okta"
            />
          </div>
          <div>
            <Label htmlFor="protocol">Protocol</Label>
            <Select id="protocol" name="protocol" defaultValue="SAML">
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
              placeholder="example.com"
              maxLength={160}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="DRAFT">
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
              required
              maxLength={400}
              placeholder="https://idp.example.com/saml/metadata"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="ssoUrl">SSO URL</Label>
            <Input
              id="ssoUrl"
              name="ssoUrl"
              type="url"
              required
              maxLength={600}
              placeholder="https://idp.example.com/saml/sso"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="sloUrl">SLO URL (optional)</Label>
            <Input
              id="sloUrl"
              name="sloUrl"
              type="url"
              maxLength={600}
              placeholder="https://idp.example.com/saml/slo"
            />
          </div>
          <div>
            <Label htmlFor="emailAttr">Email attribute</Label>
            <Input
              id="emailAttr"
              name="emailAttr"
              defaultValue="email"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="nameAttr">Name attribute</Label>
            <Input
              id="nameAttr"
              name="nameAttr"
              defaultValue="name"
              maxLength={80}
            />
          </div>
          <div>
            <Label htmlFor="defaultRole">Default role for new users</Label>
            <Select
              id="defaultRole"
              name="defaultRole"
              defaultValue="MEMBER"
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
              placeholder="-----BEGIN CERTIFICATE-----
MII...
-----END CERTIFICATE-----"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Required to activate the provider.
            </p>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit">Create provider</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
