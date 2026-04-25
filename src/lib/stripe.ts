import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazy Stripe client. Throws a clear error when STRIPE_SECRET_KEY is unset
 * so build/test environments without Stripe configured still pass.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  cached = new Stripe(secret, { apiVersion: "2026-04-22.dahlia" });
  return cached;
}

export function isStripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Map a Stripe Price ID (set via env vars per plan) to our internal Plan key.
 * Configure:
 *   STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE
 */
export function planForPriceId(priceId: string | null | undefined): "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE" {
  if (!priceId) return "FREE";
  if (priceId === process.env.STRIPE_PRICE_STARTER) return "STARTER";
  if (priceId === process.env.STRIPE_PRICE_PROFESSIONAL) return "PROFESSIONAL";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "ENTERPRISE";
  return "FREE";
}

export function priceIdForPlan(plan: "STARTER" | "PROFESSIONAL" | "ENTERPRISE"): string | undefined {
  switch (plan) {
    case "STARTER":
      return process.env.STRIPE_PRICE_STARTER;
    case "PROFESSIONAL":
      return process.env.STRIPE_PRICE_PROFESSIONAL;
    case "ENTERPRISE":
      return process.env.STRIPE_PRICE_ENTERPRISE;
  }
}
