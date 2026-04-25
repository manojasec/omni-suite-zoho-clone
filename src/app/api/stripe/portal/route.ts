import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

function appOrigin(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

export async function POST(req: Request) {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.billing", "edit");

  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { stripeCustomerId: true },
  });
  if (!ws?.stripeCustomerId) {
    return NextResponse.json({ error: "No Stripe customer for this workspace yet" }, { status: 400 });
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: ws.stripeCustomerId,
    return_url: `${appOrigin(req)}/app/settings/billing`,
  });
  return NextResponse.json({ url: portal.url });
}
