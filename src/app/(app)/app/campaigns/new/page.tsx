import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignForm } from "../campaign-form";
import { createCampaignAction } from "../actions";

export default async function NewCampaignPage() {
  const ctx = await requireSession();
  const audiences = await prisma.audience.findMany({
    where: { workspaceId: ctx.workspaceId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader><CardTitle>New campaign</CardTitle></CardHeader>
        <CardContent>
          <CampaignForm action={createCampaignAction} audiences={audiences} submitLabel="Create campaign" />
        </CardContent>
      </Card>
    </div>
  );
}
