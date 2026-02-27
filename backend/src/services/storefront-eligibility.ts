/**
 * Storefront Eligibility Gate
 *
 * A product is "eligible" if the user can actually monetize it through
 * their connected storefronts/networks. This is a HARD GATE, not a soft preference.
 *
 * Ineligible products are excluded from ranking unless the user explicitly
 * requests to see them (e.g. "show ineligible as suggestions").
 */

import type { UserProfile } from './profile-builder';

export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  matchedStorefront?: string;
  matchedNetwork?: string;
}

const NETWORK_STOREFRONT_MAP: Record<string, string[]> = {
  amazon: ['amazon', 'amazon_de', 'amazon_uk', 'amazon_us', 'amazon_fr', 'amazon_it', 'amazon_es'],
  awin: ['awin'],
  cj: ['cj', 'commission_junction'],
  impact: ['impact'],
  tradedoubler: ['tradedoubler'],
  shareasale: ['shareasale'],
  rakuten: ['rakuten'],
  webgains: ['webgains'],
  partnerize: ['partnerize'],
  // Additional common Datafeedr networks
  belboon: ['belboon'],
  tradetracker: ['tradetracker'],
  affilinet: ['affilinet'],
  daisycon: ['daisycon'],
};

/**
 * Networks with open/easy enrollment — products from these are accessible to most creators
 * regardless of their connected storefronts. Treated as eligible even without an explicit
 * storefront match so they're not penalised.
 */
const OPEN_NETWORKS = ['amazon', 'awin', 'impact', 'cj', 'shareasale', 'belboon', 'webgains', 'rakuten', 'tradedoubler', 'tradetracker'];

/**
 * Check if a product is eligible for a user based on their connected storefronts/networks.
 */
export function checkEligibility(
  product: {
    affiliateNetwork?: string;
    merchant?: string;
  },
  userProfile: UserProfile,
): EligibilityResult {
  const preferredNetworks = userProfile.storefrontContext.preferredNetworks;

  // If user has no preferred networks data, we can't gate — pass everything
  if (!preferredNetworks || preferredNetworks.length === 0) {
    return {
      eligible: true,
      reason: 'No storefront data available; eligibility check skipped',
    };
  }

  const productNetwork = (product.affiliateNetwork || '').toLowerCase();

  if (!productNetwork) {
    return {
      eligible: true,
      reason: 'Product network unknown; included for review',
    };
  }

  // Direct network match
  for (const userNetwork of preferredNetworks) {
    const normalized = userNetwork.toLowerCase();

    // Check if product network matches user's preferred network
    if (productNetwork.includes(normalized) || normalized.includes(productNetwork)) {
      return {
        eligible: true,
        reason: `Available via your ${userNetwork} account`,
        matchedStorefront: userNetwork,
        matchedNetwork: productNetwork,
      };
    }

    // Check storefront → network mapping
    for (const [networkKey, storefrontKeys] of Object.entries(NETWORK_STOREFRONT_MAP)) {
      if (productNetwork.includes(networkKey)) {
        const userHasStorefront = storefrontKeys.some(sf =>
          preferredNetworks.some(un => un.toLowerCase().includes(sf))
        );
        if (userHasStorefront) {
          return {
            eligible: true,
            reason: `Available via your ${networkKey} storefront`,
            matchedStorefront: userNetwork,
            matchedNetwork: networkKey,
          };
        }
      }
    }
  }

  // Check if it's an open network (like Amazon where most creators can sign up easily)
  for (const openNet of OPEN_NETWORKS) {
    if (productNetwork.includes(openNet)) {
      return {
        eligible: true,
        reason: `Available on ${openNet} (open enrollment)`,
        matchedNetwork: openNet,
      };
    }
  }

  return {
    eligible: false,
    reason: `Product is on ${productNetwork} which isn't in your connected networks`,
  };
}

/**
 * Filter and annotate products with eligibility
 */
export function applyEligibilityGate<T extends { affiliateNetwork?: string; merchant?: string }>(
  products: T[],
  userProfile: UserProfile,
  options: { includeIneligible?: boolean } = {},
): Array<T & { _eligibility: EligibilityResult }> {
  return products
    .map(product => ({
      ...product,
      _eligibility: checkEligibility(product, userProfile),
    }))
    .filter(p => options.includeIneligible || p._eligibility.eligible);
}

/**
 * Get eligibility stats for logging/monitoring
 */
export function getEligibilityStats(
  results: Array<{ _eligibility: EligibilityResult }>
): {
  total: number;
  eligible: number;
  ineligible: number;
  eligibilityRate: number;
} {
  const total = results.length;
  const eligible = results.filter(r => r._eligibility.eligible).length;
  return {
    total,
    eligible,
    ineligible: total - eligible,
    eligibilityRate: total > 0 ? (eligible / total) * 100 : 100,
  };
}
