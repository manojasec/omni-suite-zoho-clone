import type { Plan } from "@prisma/client";

/**
 * Plan catalog. Limits use -1 to indicate "unlimited".
 * Features are simple boolean keys consumed by `assertPlanFeature`.
 */
export type PlanLimitKey =
  | "users"
  | "contacts"
  | "deals"
  | "invoices"
  | "projects"
  | "tickets"
  | "campaigns"
  | "forms"
  | "storageMb";

export type PlanFeatureKey =
  | "advancedReports"
  | "customRoles"
  | "webhooks"
  | "apiAccess"
  | "sso"
  | "customDomains"
  | "auditLog";

export interface PlanDefinition {
  key: Plan;
  label: string;
  priceMonthly: number; // USD per month per workspace; 0 = free
  trialDays?: number;
  description: string;
  limits: Record<PlanLimitKey, number>;
  features: Record<PlanFeatureKey, boolean>;
}

const FREE: PlanDefinition = {
  key: "FREE",
  label: "Free",
  priceMonthly: 0,
  description: "Get started with the essentials.",
  limits: {
    users: 3,
    contacts: 500,
    deals: 100,
    invoices: 25,
    projects: 3,
    tickets: 100,
    campaigns: 1,
    forms: 2,
    storageMb: 250,
  },
  features: {
    advancedReports: false,
    customRoles: false,
    webhooks: false,
    apiAccess: false,
    sso: false,
    customDomains: false,
    auditLog: false,
  },
};

const STARTER: PlanDefinition = {
  key: "STARTER",
  label: "Starter",
  priceMonthly: 19,
  trialDays: 14,
  description: "For small teams getting serious.",
  limits: {
    users: 10,
    contacts: 5_000,
    deals: 2_000,
    invoices: 500,
    projects: 25,
    tickets: 5_000,
    campaigns: 10,
    forms: 25,
    storageMb: 5_000,
  },
  features: {
    advancedReports: false,
    customRoles: false,
    webhooks: true,
    apiAccess: true,
    sso: false,
    customDomains: false,
    auditLog: true,
  },
};

const PROFESSIONAL: PlanDefinition = {
  key: "PROFESSIONAL",
  label: "Professional",
  priceMonthly: 49,
  trialDays: 14,
  description: "For growing organizations.",
  limits: {
    users: 50,
    contacts: 50_000,
    deals: 25_000,
    invoices: 10_000,
    projects: 250,
    tickets: 50_000,
    campaigns: 100,
    forms: 250,
    storageMb: 50_000,
  },
  features: {
    advancedReports: true,
    customRoles: true,
    webhooks: true,
    apiAccess: true,
    sso: false,
    customDomains: true,
    auditLog: true,
  },
};

const ENTERPRISE: PlanDefinition = {
  key: "ENTERPRISE",
  label: "Enterprise",
  priceMonthly: 199,
  description: "Unlimited scale & advanced governance.",
  limits: {
    users: -1,
    contacts: -1,
    deals: -1,
    invoices: -1,
    projects: -1,
    tickets: -1,
    campaigns: -1,
    forms: -1,
    storageMb: -1,
  },
  features: {
    advancedReports: true,
    customRoles: true,
    webhooks: true,
    apiAccess: true,
    sso: true,
    customDomains: true,
    auditLog: true,
  },
};

export const PLANS: Record<Plan, PlanDefinition> = {
  FREE,
  STARTER,
  PROFESSIONAL,
  ENTERPRISE,
};

export const ORDERED_PLANS: PlanDefinition[] = [FREE, STARTER, PROFESSIONAL, ENTERPRISE];

export function getPlan(plan: Plan): PlanDefinition {
  return PLANS[plan] ?? FREE;
}
