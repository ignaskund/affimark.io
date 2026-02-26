/**
 * Diversity-Constrained Selection
 *
 * Prevents returning 5 near-identical items. Enforces:
 * - Merchant diversity: max 2 from same merchant
 * - Brand diversity: at least 3 unique brands in final set
 * - Feature diversity: at least one product optimized for each top user priority
 */

interface ScoredProduct {
  id: string;
  name: string;
  brand: string;
  merchant: string;
  combinedScore: number;
  productPriorityKpis?: Array<{ id: string; score: number }>;
}

interface DiversityConfig {
  maxPerMerchant: number;
  minUniqueBrands: number;
  targetSize: number;
  topPriorityIds: string[];
}

const DEFAULT_CONFIG: DiversityConfig = {
  maxPerMerchant: 2,
  minUniqueBrands: 3,
  targetSize: 5,
  topPriorityIds: [],
};

/**
 * Select a diverse set of products from scored candidates.
 * Higher-scored products are preferred, but diversity constraints are enforced.
 */
export function selectDiverseProducts<T extends ScoredProduct>(
  candidates: T[],
  config: Partial<DiversityConfig> = {},
): T[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (candidates.length <= cfg.targetSize) return candidates;

  const selected: T[] = [];
  const merchantCount = new Map<string, number>();
  const brandSet = new Set<string>();
  const coveredPriorities = new Set<string>();

  // Candidates are assumed pre-sorted by combinedScore descending
  const remaining = [...candidates];

  // Pass 1: Greedily pick the best product for each top priority (feature diversity)
  for (const priorityId of cfg.topPriorityIds) {
    if (selected.length >= cfg.targetSize) break;

    const bestForPriority = remaining
      .filter(c => !selected.some(s => s.id === c.id))
      .filter(c => canAddUnderConstraints(c, merchantCount, cfg))
      .sort((a, b) => {
        const aScore = a.productPriorityKpis?.find(k => k.id === priorityId)?.score ?? 0;
        const bScore = b.productPriorityKpis?.find(k => k.id === priorityId)?.score ?? 0;
        return bScore - aScore;
      })[0];

    if (bestForPriority) {
      addToSelection(bestForPriority, selected, merchantCount, brandSet, coveredPriorities);
    }
  }

  // Pass 2: Fill remaining slots with highest-scoring candidates under constraints
  for (const candidate of remaining) {
    if (selected.length >= cfg.targetSize) break;
    if (selected.some(s => s.id === candidate.id)) continue;
    if (!canAddUnderConstraints(candidate, merchantCount, cfg)) continue;

    // If we haven't hit minUniqueBrands, prefer a new brand
    const brand = normalizeBrandKey(candidate.brand);
    if (brandSet.size < cfg.minUniqueBrands && brandSet.has(brand)) {
      // Check if there's a new-brand candidate with acceptable score (within 15% of this one)
      const newBrandCandidate = remaining.find(c =>
        !selected.some(s => s.id === c.id) &&
        c.id !== candidate.id &&
        !brandSet.has(normalizeBrandKey(c.brand)) &&
        canAddUnderConstraints(c, merchantCount, cfg) &&
        c.combinedScore >= candidate.combinedScore * 0.85,
      );
      if (newBrandCandidate) {
        addToSelection(newBrandCandidate, selected, merchantCount, brandSet, coveredPriorities);
        continue;
      }
    }

    addToSelection(candidate, selected, merchantCount, brandSet, coveredPriorities);
  }

  // Pass 3: If still under target, relax merchant constraint
  if (selected.length < cfg.targetSize) {
    for (const candidate of remaining) {
      if (selected.length >= cfg.targetSize) break;
      if (selected.some(s => s.id === candidate.id)) continue;
      addToSelection(candidate, selected, merchantCount, brandSet, coveredPriorities);
    }
  }

  return selected;
}

function canAddUnderConstraints(
  candidate: ScoredProduct,
  merchantCount: Map<string, number>,
  cfg: DiversityConfig,
): boolean {
  const merchant = normalizeMerchantKey(candidate.merchant);
  const count = merchantCount.get(merchant) || 0;
  return count < cfg.maxPerMerchant;
}

function addToSelection<T extends ScoredProduct>(
  product: T,
  selected: T[],
  merchantCount: Map<string, number>,
  brandSet: Set<string>,
  coveredPriorities: Set<string>,
): void {
  selected.push(product);

  const merchant = normalizeMerchantKey(product.merchant);
  merchantCount.set(merchant, (merchantCount.get(merchant) || 0) + 1);

  brandSet.add(normalizeBrandKey(product.brand));

  if (product.productPriorityKpis) {
    for (const kpi of product.productPriorityKpis) {
      if (kpi.score >= 70) coveredPriorities.add(kpi.id);
    }
  }
}

function normalizeMerchantKey(merchant: string): string {
  return (merchant || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function normalizeBrandKey(brand: string): string {
  return (brand || 'unknown').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}
