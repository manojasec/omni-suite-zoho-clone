import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CampaignForm } from "../campaign-form";
import {
  updateCampaignAction,
  deleteCampaignAction,
  sendCampaignAction,
  cancelCampaignAction,
  sendTestCampaignAction,
} from "../actions";
import { compileAudienceWhere } from "@/modules/marketing/audience";
import { SendCampaignControls } from "./send-campaign-controls";

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-foreground",
  SCHEDULED: "bg-amber-100 text-amber-900",
  SENDING: "bg-blue-100 text-blue-900",
  SENT: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-rose-100 text-rose-900",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireSession();
  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    include: { audience: true },
  });
  if (!campaign) notFound();

  const audiences = await prisma.audience.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  let recipientCount = 0;
  if (campaign.audience) {
    const where = compileAudienceWhere(
      ctx.workspaceId,
      (campaign.audience.filterDsl as object) ?? {},
    );
    recipientCount = await prisma.contact.count({ where });
  }

  const update = updateCampaignAction.bind(null, id);
  const remove = deleteCampaignAction.bind(null, id);
  const send = sendCampaignAction.bind(null, id);
  const cancel = cancelCampaignAction.bind(null, id);
  const test = sendTestCampaignAction.bind(null, id);

  const isLocked =
    campaign.status === "SENT" || campaign.status === "SENDING";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/app/campaigns" className="text-sm text-muted-foreground hover:underline">← All campaigns</Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{campaign.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[campaign.status] ?? ""}`}>
              {campaign.status}
            </span>
            <span className="text-muted-foreground">{campaign.subject}</span>
          </div>
        </div>
        <form action={remove}>
          <Button type="submit" variant="destructive" size="sm" disabled={isLocked}>Delete</Button>
        </form>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>{isLocked ? "Campaign content" : "Edit campaign"}</CardTitle></CardHeader>
          <CardContent>
            <CampaignForm
              action={update}
              audiences={audiences}
              disabled={isLocked}
              submitLabel="Save changes"
              initial={{
                name: campaign.name,
                audienceId: campaign.audienceId,
                subject: campaign.subject,
                html: campaign.html,
              }}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Audience</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {campaign.audience ? (
                <>
                  <Link href={`/app/campaigns/audiences/${campaign.audience.id}`} className="font-medium hover:underline">
                    {campaign.audience.name}
                  </Link>
                  <p className="text-muted-foreground">{recipientCount} recipient{recipientCount === 1 ? "" : "s"}</p>
                </>
              ) : (
                <p className="text-muted-foreground">No audience selected. Sending will deliver to 0 recipients.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Delivery</CardTitle></CardHeader>
            <CardContent>
              <SendCampaignControls
                campaignId={id}
                status={campaign.status}
                sendAction={send}
                cancelAction={cancel}
                testAction={test}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Stat label="Sent" value={campaign.status === "SENT" ? recipientCount : 0} />
              <Stat label="Opened" value={0} hint="placeholder" />
              <Stat label="Clicked" value={0} hint="placeholder" />
              <Stat label="Unsubscribed" value={0} hint="placeholder" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">
        {value}
        {hint ? <span className="ml-1 text-xs text-muted-foreground">({hint})</span> : null}
      </span>
    </div>
  );
}
