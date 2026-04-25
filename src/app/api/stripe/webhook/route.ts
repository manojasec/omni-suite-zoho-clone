import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe, planForPriceId } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. Configure STRIPE_WEBHOOK_SECRET, then point Stripe at:
 *   POST /api/stripe/webhook
 *
 * Handles: checkout.session.completed, customer.subscription.{created,updated,deleted}.
 */
export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspaceId;
        if (workspaceId) {
          const sub = typeof session.subscription === "string"
            ? await stripe.subscriptions.retrieve(session.subscription)
            : (session.subscription as Stripe.Subscription | null);
          await syncSubscription(workspaceId, sub, session.customer);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const workspaceId = sub.metadata?.workspaceId;
        if (workspaceId) {
          await syncSubscription(workspaceId, sub, sub.customer);
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Handler error: ${(err as Error).message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function syncSubscription(
  workspaceId: string,
  sub: Stripe.Subscription | null,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
) {
  const customerId = typeof customer === "string" ? customer : customer?.id ?? null;

  if (!sub) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        stripeCustomerId: customerId ?? undefined,
      },
    });
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? null;
  const plan = planForPriceId(priceId);
  const status = sub.status;
  const isActive = status === "active" || status === "trialing";

  // currentPeriodEnd lives on the subscription item in newer Stripe API versions.
  const periodEndUnix = sub.items.data[0]?.current_period_end ?? null;
  const trialEndUnix = sub.trial_end ?? null;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: isActive ? plan : "FREE",
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: sub.id,
      subscriptionStatus: status,
      currentPeriodEnd: periodEndUnix ? new Date(periodEndUnix * 1000) : null,
      trialEndsAt: trialEndUnix ? new Date(trialEndUnix * 1000) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      workspaceId,
      action: "subscription.sync",
      resource: "workspace",
      resourceId: workspaceId,
      diff: { status, plan, priceId },
    },
  });
}
