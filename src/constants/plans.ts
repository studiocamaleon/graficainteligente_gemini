export const PLAN_SLUGS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const PLAN_NAMES = {
  [PLAN_SLUGS.FREE]: 'Free',
  [PLAN_SLUGS.PRO]: 'Pro',
  [PLAN_SLUGS.ENTERPRISE]: 'Enterprise',
} as const;

export const PLAN_COLORS = {
  [PLAN_SLUGS.FREE]: 'bg-gray-100 text-gray-800 border-gray-300',
  [PLAN_SLUGS.PRO]: 'bg-blue-100 text-blue-800 border-blue-300',
  [PLAN_SLUGS.ENTERPRISE]: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-900 border-orange-300',
} as const;
