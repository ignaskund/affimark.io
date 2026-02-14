/**
 * Context Hash Service
 *
 * Generates stable hashes for active context to detect when toggles change.
 * Prevents "silent inconsistency" where search results are based on one context
 * but chat advice references a different context.
 */

import { createHash } from 'node:crypto';

export interface ActiveContext {
  socials: string[];
  storefronts: string[];
}

/**
 * Generate a stable hash for active context
 *
 * This hash changes when the user toggles platforms on/off.
 * Used to detect context mismatches between search and chat.
 */
export function generateContextHash(activeContext: ActiveContext): string {
  // Sort arrays to ensure consistent ordering
  const sortedSocials = [...(activeContext.socials || [])].sort();
  const sortedStorefronts = [...(activeContext.storefronts || [])].sort();

  // Create canonical string representation
  const canonical = JSON.stringify({
    socials: sortedSocials,
    storefronts: sortedStorefronts,
  });

  // Generate short hash (first 8 chars of SHA-256)
  const hash = createHash('sha256').update(canonical).digest('hex');
  return hash.substring(0, 8);
}

/**
 * Create human-readable context label for UI
 *
 * Example: "YouTube, Instagram + Amazon DE"
 */
export function generateContextLabel(activeContext: ActiveContext): string {
  const parts: string[] = [];

  if (activeContext.socials && activeContext.socials.length > 0) {
    const socialNames = activeContext.socials
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(', ');
    parts.push(socialNames);
  }

  if (activeContext.storefronts && activeContext.storefronts.length > 0) {
    const storefrontNames = activeContext.storefronts
      .map(s => {
        // Format storefront IDs: "amazon_de" → "Amazon DE"
        const parts = s.split('_');
        return parts
          .map(p => p.toUpperCase())
          .join(' ');
      })
      .join(', ');
    parts.push(storefrontNames);
  }

  if (parts.length === 0) {
    return 'All platforms';
  }

  return parts.join(' + ');
}

/**
 * Check if context has changed since session creation
 */
export function hasContextChanged(
  sessionHash: string,
  currentContext: ActiveContext
): boolean {
  const currentHash = generateContextHash(currentContext);
  return sessionHash !== currentHash;
}

/**
 * Create context change message for UI
 */
export function getContextChangeMessage(
  sessionContext: ActiveContext,
  currentContext: ActiveContext
): {
  changed: boolean;
  message?: string;
  suggestion?: string;
} {
  if (!hasContextChanged(generateContextHash(sessionContext), currentContext)) {
    return { changed: false };
  }

  const sessionLabel = generateContextLabel(sessionContext);
  const currentLabel = generateContextLabel(currentContext);

  return {
    changed: true,
    message: `Context changed: Results were based on "${sessionLabel}", now showing "${currentLabel}"`,
    suggestion: 'Rerun search to update results with new context',
  };
}

/**
 * Rerank existing alternatives based on new context
 *
 * This is faster than a full re-search because we use cached alternatives
 * and just re-score them with the new context.
 */
export async function rerankWithNewContext(
  alternatives: any[],
  newContext: ActiveContext,
  userProfile: any
): Promise<any[]> {
  console.log('[Context Hash] Reranking with new context:', generateContextLabel(newContext));

  // Filter user profile by new active context
  const filteredProfile = { ...userProfile };

  // Filter social platforms
  if (newContext.socials && newContext.socials.length > 0) {
    filteredProfile.socialContext = {
      ...filteredProfile.socialContext,
      platforms: filteredProfile.socialContext.platforms.filter(
        (p: string) => newContext.socials.includes(p)
      ),
    };
  }

  // Filter storefronts
  if (newContext.storefronts && newContext.storefronts.length > 0) {
    const activeNetworks = newContext.storefronts.map((s: string) => {
      // Extract network from storefront ID: "amazon_de" → "amazon"
      return s.split('_')[0];
    });

    filteredProfile.storefrontContext = {
      ...filteredProfile.storefrontContext,
      preferredNetworks: filteredProfile.storefrontContext.preferredNetworks.filter(
        (n: string) => activeNetworks.includes(n)
      ),
    };
  }

  // Re-score each alternative with filtered profile
  // (Implementation depends on your scoring logic)
  // For now, just return sorted by existing matchScore
  const reranked = [...alternatives].sort((a, b) => b.matchScore - a.matchScore);

  console.log(`[Context Hash] Reranked ${reranked.length} alternatives`);
  return reranked;
}
