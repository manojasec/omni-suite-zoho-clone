import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { assertCan } from "@/platform/permissions";
import { prisma } from "@/lib/prisma";
import { getStripe, priceIdForPlan } from "@/lib/stripe";

const bodySchema = z.object({
  plan: z.enum(["STARTER", "PROFESSIONAL", "ENTERPRISE"]),
});

function appOrigin(req: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

export async function POST(req: Request) {
  const ctx = await requireSession();
  assertCan(ctx.role, "settings.billing", "edit");

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  const priceId = priceIdForPlan(parsed.data.plan);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price ID for ${parsed.data.plan} is not configured` },
      { status: 500 },
    );
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: ctx.workspaceId },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: ctx.userId },
    select: { email: true },
  });

  const stripe = getStripe();
  const origin = appOrigin(req);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: ws.stripeCustomerId ?? undefined,
    customer_email: ws.stripeCustomerId ? undefined : user?.email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      trial_period_days: parsed.data.plan === "STARTER" || parsed.data.plan === "PROFESSIONAL" ? 14 : undefined,
      metadata: { workspaceId: ws.id, plan: parsed.data.plan },
    },
    metadata: { workspaceId: ws.id, plan: parsed.data.plan },
    success_url: `${origin}/app/settings/billing?status=success`,
    cancel_url: `${origin}/app/settings/billing?status=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
