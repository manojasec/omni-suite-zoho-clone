import { cookies } from "next/headers";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { buildTotpUri } from "@/modules/two-factor/totp";
import {
  confirm2faEnrollmentAction,
  disable2faAction,
  regenerateRecoveryCodesAction,
  start2faEnrollmentAction,
} from "./actions";

export const dynamic = "force-dynamic";

const PENDING_PREFIX = "PENDING:";

export default async function TwoFactorSettingsPage() {
  const ctx = await requireSession();

  const [user, recovery] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { email: true, twoFactorSecret: true },
    }),
    prisma.twoFactorRecoveryCode.findMany({
      where: { userId: ctx.userId },
      select: { id: true, usedAt: true },
    }),
  ]);

  const secret = user?.twoFactorSecret ?? null;
  const isPending = !!secret?.startsWith(PENDING_PREFIX);
  const isEnabled = !!secret && !isPending;
  const pendingSecret = isPending ? secret!.slice(PENDING_PREFIX.length) : null;

  const cookieStore = await cookies();
  const codesCookie = cookieStore.get("2fa.codes")?.value;
  const justIssuedCodes = codesCookie ? codesCookie.split(",") : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Two-factor authentication
        </h1>
        <p className="text-sm text-muted-foreground">
          Add an authenticator app code to your sign-in for stronger protection.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              isEnabled
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-100 text-zinc-700"
            }`}
          >
            {isEnabled ? "Enabled" : isPending ? "Setup in progress" : "Disabled"}
          </span>
          <span className="text-sm">{user?.email}</span>
        </div>

        {!isEnabled && !isPending ? (
          <form action={start2faEnrollmentAction}>
            <Button type="submit">Enable two-factor</Button>
          </form>
        ) : null}

        {isPending && pendingSecret ? (
          <div className="space-y-3">
            <p className="text-sm">
              Scan this URI in Google Authenticator, 1Password, Authy, etc., then
              enter the 6-digit code to confirm.
            </p>
            <Input
              readOnly
              className="font-mono text-xs"
              value={buildTotpUri({
                account: user!.email,
                issuer: "OmniSuite",
                secret: pendingSecret,
              })}
            />
            <p className="text-xs text-muted-foreground">
              Manual entry secret:{" "}
              <span className="font-mono">{pendingSecret}</span>
            </p>
            <form
              action={confirm2faEnrollmentAction}
              className="flex flex-wrap items-end gap-2"
            >
              <div>
                <Label htmlFor="code">6-digit code</Label>
                <Input
                  id="code"
                  name="code"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                />
              </div>
              <Button type="submit">Confirm</Button>
            </form>
          </div>
        ) : null}

        {isEnabled ? (
          <div className="space-y-3">
            {(() => {
              const remaining = recovery.filter((r) => !r.usedAt).length;
              return (
                <>
                  <p className="text-sm">
                    You have {remaining} unused recovery codes.
                  </p>
                  {remaining <= 2 ? (
                    <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      You're running low on recovery codes. Regenerate a new
                      set and store them somewhere safe.
                    </p>
                  ) : null}
                </>
              );
            })()}
            <form action={regenerateRecoveryCodesAction}>
              <Button type="submit" size="sm" variant="outline">
                Regenerate recovery codes
              </Button>
            </form>
            <form
              action={disable2faAction}
              className="flex flex-wrap items-end gap-2 border-t pt-3"
            >
              <div>
                <Label htmlFor="dcode">Code to disable</Label>
                <Input
                  id="dcode"
                  name="code"
                  inputMode="numeric"
                  maxLength={12}
                  required
                />
              </div>
              <Button type="submit" size="sm" variant="ghost">
                Disable two-factor
              </Button>
            </form>
          </div>
        ) : null}
      </Card>

      {justIssuedCodes.length > 0 ? (
        <Card className="space-y-2 p-4">
          <h2 className="text-sm font-semibold">Save your recovery codes</h2>
          <p className="text-xs text-muted-foreground">
            Each code can be used once if you lose access to your authenticator.
            They will not be shown again.
          </p>
          <ul className="grid gap-1 font-mono text-sm sm:grid-cols-2">
            {justIssuedCodes.map((c) => (
              <li key={c} className="rounded bg-muted px-2 py-1">
                {c}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
