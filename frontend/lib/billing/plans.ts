export type PlanId = "free" | "pro" | "business" | "enterprise";

export interface PlanEntitlements {
  /** Max members (owner+admin+member) in the org. Infinity = unlimited. */
  maxSeats: number;
  /** Max external guests. */
  maxGuests: number;
  /** Max active automations. */
  maxAutomations: number;
  /** Automation runs per month. */
  automationRunsPerMonth: number;
  /** AI assistant requests per month. */
  aiRequestsPerMonth: number;
  /** Storage in MB. */
  storageMb: number;
  /** Feature flags. */
  features: {
    customFields: boolean;
    recurringTasks: boolean;
    webhooks: boolean;
    apiAccess: boolean;
    guestPortal: boolean;
    prioritySupport: boolean;
    auditLogExport: boolean;
  };
}

export const PLANS: Record<PlanId, PlanEntitlements & { name: string; priceMonthly: number }> = {
  free: {
    name: "Free",
    priceMonthly: 0,
    maxSeats: 5,
    maxGuests: 3,
    maxAutomations: 3,
    automationRunsPerMonth: 100,
    aiRequestsPerMonth: 25,
    storageMb: 500,
    features: {
      customFields: false,
      recurringTasks: false,
      webhooks: false,
      apiAccess: true,
      guestPortal: false,
      prioritySupport: false,
      auditLogExport: false,
    },
  },
  pro: {
    name: "Pro",
    priceMonthly: 9,
    maxSeats: 25,
    maxGuests: 10,
    maxAutomations: 25,
    automationRunsPerMonth: 5_000,
    aiRequestsPerMonth: 500,
    storageMb: 10_240,
    features: {
      customFields: true,
      recurringTasks: true,
      webhooks: true,
      apiAccess: true,
      guestPortal: true,
      prioritySupport: false,
      auditLogExport: false,
    },
  },
  business: {
    name: "Business",
    priceMonthly: 19,
    maxSeats: 200,
    maxGuests: 100,
    maxAutomations: 200,
    automationRunsPerMonth: 50_000,
    aiRequestsPerMonth: 5_000,
    storageMb: 102_400,
    features: {
      customFields: true,
      recurringTasks: true,
      webhooks: true,
      apiAccess: true,
      guestPortal: true,
      prioritySupport: true,
      auditLogExport: true,
    },
  },
  enterprise: {
    name: "Enterprise",
    priceMonthly: -1, // contact sales
    maxSeats: Infinity,
    maxGuests: Infinity,
    maxAutomations: Infinity,
    automationRunsPerMonth: Infinity,
    aiRequestsPerMonth: Infinity,
    storageMb: Infinity,
    features: {
      customFields: true,
      recurringTasks: true,
      webhooks: true,
      apiAccess: true,
      guestPortal: true,
      prioritySupport: true,
      auditLogExport: true,
    },
  },
};

/** Stripe Price IDs come from env so test/live mode is a config change. */
export function stripePriceFor(plan: PlanId): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO ?? null;
  if (plan === "business") return process.env.STRIPE_PRICE_BUSINESS ?? null;
  return null;
}

export function planFromStripePrice(priceId: string): PlanId | null {
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return "business";
  return null;
}
