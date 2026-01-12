// Stripe Pricing Configuration for AffiMark

export const STRIPE_PLANS = {
  FREE: {
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Connect 1 social account',
      'Basic analytics',
      '50 AI chat messages/month',
      '10 product recommendations',
      'Email support',
    ],
    limits: {
      socialAccounts: 1,
      aiMessages: 50,
      productMatches: 10,
    },
  },
  CREATOR: {
    name: 'Creator',
    price: 29,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CREATOR!,
    features: [
      'Connect 3 social accounts',
      'Advanced analytics & insights',
      'Unlimited AI chat messages',
      '50 product recommendations/month',
      'Partnership tracking',
      'Priority support',
      'Content performance reports',
    ],
    limits: {
      socialAccounts: 3,
      aiMessages: -1, // unlimited
      productMatches: 50,
    },
  },
  PRO: {
    name: 'Pro',
    price: 79,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO!,
    features: [
      'Unlimited social accounts',
      'Advanced analytics & insights',
      'Unlimited AI chat messages',
      'Unlimited product recommendations',
      'Partnership tracking & management',
      'Priority support',
      'Content performance reports',
      'Cross-platform analytics',
      'Revenue forecasting',
      'Custom integrations',
    ],
    limits: {
      socialAccounts: -1, // unlimited
      aiMessages: -1, // unlimited
      productMatches: -1, // unlimited
    },
  },
} as const;

export type PlanType = keyof typeof STRIPE_PLANS;

export function getPlanByPriceId(priceId: string): PlanType | null {
  if (!priceId) return 'FREE';
  
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.priceId === priceId) {
      return key as PlanType;
    }
  }
  
  return null;
}

export function getPlanFeatures(planType: PlanType) {
  return STRIPE_PLANS[planType];
}

export function canUserAccessFeature(
  userPlan: PlanType,
  feature: {
    requiredPlan?: PlanType;
    socialAccounts?: number;
    aiMessages?: number;
  }
): boolean {
  const plan = STRIPE_PLANS[userPlan];
  
  // Check plan tier
  const planOrder: PlanType[] = ['FREE', 'CREATOR', 'PRO'];
  const userPlanIndex = planOrder.indexOf(userPlan);
  const requiredPlanIndex = feature.requiredPlan
    ? planOrder.indexOf(feature.requiredPlan)
    : 0;
  
  if (userPlanIndex < requiredPlanIndex) {
    return false;
  }
  
  // Check specific limits
  if (feature.socialAccounts !== undefined) {
    if (plan.limits.socialAccounts !== -1 && feature.socialAccounts > plan.limits.socialAccounts) {
      return false;
    }
  }
  
  if (feature.aiMessages !== undefined) {
    if (plan.limits.aiMessages !== -1 && feature.aiMessages > plan.limits.aiMessages) {
      return false;
    }
  }
  
  return true;
}

