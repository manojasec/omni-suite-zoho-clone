import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  publicSignAction,
  publicDeclineAction,
  recordViewEvent,
} from "@/app/(app)/app/esign/actions";

export const dynamic = "force-dynamic";

export default async function PublicSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const signer = await prisma.signatureSigner.findUnique({
    where: { accessToken: token },
    include: {
      envelope: {
        include: { signers: { orderBy: { order: "asc" }, select: { id: true, order: true, name: true, status: true } } },
      },
    },
  });
  if (!signer) notFound();

  // Record the first view (best-effort, ignored on errors).
  try {
    await recordViewEvent(token);
  } catch {
    // ignore
  }

  const env = signer.envelope;
  const expired = env.expiresAt && env.expiresAt.getTime() < Date.now();
  const prior = env.signers.filter((s) => s.order < signer.order);
  const myTurn = prior.every((p) => p.status === "SIGNED");

  const sign = publicSignAction.bind(null, token);
  const decline = publicDeclineAction.bind(null, token);

  const alreadySigned = signer.status === "SIGNED";
  const alreadyDeclined = signer.status === "DECLINED";
  const envelopeFinal =
    env.status === "COMPLETED" ||
    env.status === "DECLINED" ||
    env.status === "CANCELLED" ||
    env.status === "EXPIRED";

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Signature request</p>
          <h1 className="text-2xl font-semibold tracking-tight">{env.title}</h1>
          <p className="text-sm text-muted-foreground">
            For <strong>{signer.name}</strong> ({signer.email}) · Signer #{signer.order} of {env.signers.length}
          </p>
        </div>

        {env.message ? (
          <Card className="p-4">
            <p className="text-sm whitespace-pre-wrap">{env.message}</p>
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-1">Document</div>
          <a
            href={env.documentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {env.documentUrl}
          </a>
        </Card>

        {alreadySigned ? (
          <Card className="p-4 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40">
            <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-200">
              ✓ You signed this document
            </div>
            <p className="text-xs text-muted-foreground mt-1 tabular-nums">
              {signer.signedAt?.toISOString().slice(0, 16).replace("T", " ")}
            </p>
          </Card>
        ) : alreadyDeclined ? (
          <Card className="p-4 border-rose-200 bg-rose-50 dark:bg-rose-950/40">
            <div className="text-sm font-semibold text-rose-700 dark:text-rose-200">
              You declined this request
            </div>
            {signer.declineReason ? (
              <p className="text-sm mt-1">{signer.declineReason}</p>
            ) : null}
          </Card>
        ) : envelopeFinal ? (
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/40">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">
              This envelope is no longer accepting signatures (status: {env.status}).
            </div>
          </Card>
        ) : expired ? (
          <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950/40">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-200">
              This signature request has expired.
            </div>
          </Card>
        ) : !myTurn ? (
          <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-950/40">
            <div className="text-sm font-semibold">Waiting for prior signers</div>
            <p className="text-xs text-muted-foreground mt-1">
              You can sign once the previous signers have completed their step.
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-3">Sign electronically</h2>
              <form action={sign} className="space-y-3">
                <div>
                  <Label htmlFor="signatureName">Type your full name *</Label>
                  <Input id="signatureName" name="signatureName" required minLength={2}
                    placeholder={signer.name} defaultValue={signer.name} />
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name="agree" required className="mt-0.5" />
                  <span>
                    I agree that my electronic signature has the same legal effect as a hand-written signature
                    and that I have reviewed the document above.
                  </span>
                </label>
                <Button type="submit" className="w-full">Sign document</Button>
              </form>
            </Card>

            <Card className="p-6">
              <h2 className="text-sm font-semibold mb-3">Decline to sign</h2>
              <form action={decline} className="space-y-3">
                <Textarea name="reason" rows={3} required minLength={1} maxLength={500}
                  placeholder="Reason for declining (required)" />
                <Button type="submit" variant="ghost" size="sm">Decline request</Button>
              </form>
            </Card>
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Powered by Omnisuite e-signature
        </p>
      </div>
    </div>
  );
}
