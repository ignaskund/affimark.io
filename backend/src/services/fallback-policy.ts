/**
 * Fallback Policy Contract
 *
 * CRITICAL: Prevents confident recommendations built on defaults/thin evidence
 *
 * Defines strict rules for:
 * - What can be recommended when evidence is thin
 * - What must be labeled as "verify"
 * - When to default to "test-first" rather than "top pick"
 */

export interface FallbackPolicy {
  canSelectWinner: boolean; // Can this be marked as #1 recommendation
  requiresManualVerification: boolean; // User MUST verify before promoting
  displayMode: 'winner' | 'shortlist' | 'test_first' | 'verify_required';
  userMessage?: string; // What to tell the user
  evidenceWarnings: string[];
}

export interface EvidenceInputs {
  // Program evidence
  programTermsAvailable: boolean;
  commissionRateKnown: boolean;
  programTermsVerified: boolean; // Manually verified vs inferred

  // Product evidence
  categoryConfidence: number; // 0-100
  productDataCompleteness: number; // 0-100 (has rating, reviews, price, etc.)

  // Outcome feasibility
  outcomeFeasibilityScore: number; // 0-100
  outcomeFeasibilityConfidence: number; // 0-100

  // Profile evidence
  profileCompleteness: number; // 0-100
  recommendationEvidence: number; // 0-100
}

/**
 * Determine fallback policy for a product recommendation
 */
export function determineFallbackPolicy(evidence: EvidenceInputs): FallbackPolicy {
  const warnings: string[] = [];

  // ════════════════════════════════════════════════════════════
  // RULE 1: Program terms unknown → CANNOT BE WINNER
  // ════════════════════════════════════════════════════════════
  if (!evidence.programTermsAvailable || !evidence.commissionRateKnown) {
    warnings.push('Program terms unavailable - commission rate and cookie duration unknown');

    return {
      canSelectWinner: false,
      requiresManualVerification: true,
      displayMode: 'verify_required',
      userMessage: 'Verify affiliate program terms before promoting this product',
      evidenceWarnings: warnings,
    };
  }

  // ════════════════════════════════════════════════════════════
  // RULE 2: Low category confidence → ASK CONFIRMATION
  // ════════════════════════════════════════════════════════════
  if (evidence.categoryConfidence < 60) {
    warnings.push('Product categorization uncertain - may not match your niche');

    return {
      canSelectWinner: false,
      requiresManualVerification: false,
      displayMode: 'shortlist',
      userMessage: 'Category match uncertain - review shortlist and confirm fit',
      evidenceWarnings: warnings,
    };
  }

  // ════════════════════════════════════════════════════════════
  // RULE 3: Low outcome feasibility → TEST-FIRST mode
  // ════════════════════════════════════════════════════════════
  if (evidence.outcomeFeasibilityScore < 60) {
    if (evidence.outcomeFeasibilityScore < 40) {
      // Very low - require manual check
      warnings.push('Business outcome risk - low merchant/program/demand signals');

      return {
        canSelectWinner: false,
        requiresManualVerification: true,
        displayMode: 'verify_required',
        userMessage: 'Verify merchant reliability and program terms before promoting',
        evidenceWarnings: warnings,
      };
    } else {
      // Moderate - suggest testing first
      warnings.push('Moderate outcome risk - consider testing before major promotion');

      return {
        canSelectWinner: false,
        requiresManualVerification: false,
        displayMode: 'test_first',
        userMessage: 'Test with small audience before scaling this product',
        evidenceWarnings: warnings,
      };
    }
  }

  // ════════════════════════════════════════════════════════════
  // RULE 4: Low recommendation evidence → SHORTLIST mode
  // ════════════════════════════════════════════════════════════
  if (evidence.recommendationEvidence < 50) {
    warnings.push('Limited data sources - recommendation based on partial information');

    return {
      canSelectWinner: false,
      requiresManualVerification: false,
      displayMode: 'shortlist',
      userMessage: 'Review shortlist - recommendations based on limited data',
      evidenceWarnings: warnings,
    };
  }

  // ════════════════════════════════════════════════════════════
  // RULE 5: Low product data completeness → TEST-FIRST
  // ════════════════════════════════════════════════════════════
  if (evidence.productDataCompleteness < 40) {
    warnings.push('Incomplete product data - missing key signals like reviews or ratings');

    return {
      canSelectWinner: false,
      requiresManualVerification: false,
      displayMode: 'test_first',
      userMessage: 'Limited product data - test before committing',
      evidenceWarnings: warnings,
    };
  }

  // ════════════════════════════════════════════════════════════
  // RULE 6: Multiple moderate warnings → SHORTLIST
  // ════════════════════════════════════════════════════════════
  const moderateRisks = [
    evidence.programTermsVerified === false,
    evidence.categoryConfidence >= 60 && evidence.categoryConfidence < 75,
    evidence.outcomeFeasibilityScore >= 60 && evidence.outcomeFeasibilityScore < 70,
    evidence.productDataCompleteness >= 40 && evidence.productDataCompleteness < 60,
  ].filter(Boolean).length;

  if (moderateRisks >= 2) {
    warnings.push('Multiple moderate risks - recommend reviewing alternatives');

    return {
      canSelectWinner: false,
      requiresManualVerification: false,
      displayMode: 'shortlist',
      userMessage: 'Multiple uncertainty signals - review top alternatives carefully',
      evidenceWarnings: warnings,
    };
  }

  // ════════════════════════════════════════════════════════════
  // CLEAR TO RECOMMEND: All evidence thresholds passed
  // ════════════════════════════════════════════════════════════
  return {
    canSelectWinner: true,
    requiresManualVerification: false,
    displayMode: 'winner',
    userMessage: undefined,
    evidenceWarnings: warnings,
  };
}

/**
 * Calculate product data completeness (0-100)
 */
export function calculateProductDataCompleteness(product: {
  rating?: number;
  reviewCount?: number;
  price?: number;
  category?: string;
  brand?: string;
  imageUrl?: string;
  description?: string;
}): number {
  let completeness = 0;

  if (product.rating !== undefined) completeness += 20;
  if (product.reviewCount !== undefined && product.reviewCount > 0) completeness += 20;
  if (product.price !== undefined && product.price > 0) completeness += 15;
  if (product.category) completeness += 15;
  if (product.brand) completeness += 15;
  if (product.imageUrl) completeness += 10;
  if (product.description) completeness += 5;

  return completeness;
}

/**
 * Log policy decisions for debugging and tuning
 */
export function logPolicyDecision(
  productName: string,
  policy: FallbackPolicy,
  evidence: EvidenceInputs
): void {
  console.log(`[Fallback Policy] ${productName}:`);
  console.log(`  Display Mode: ${policy.displayMode}`);
  console.log(`  Can Select Winner: ${policy.canSelectWinner}`);
  console.log(`  Requires Verification: ${policy.requiresManualVerification}`);

  if (policy.evidenceWarnings.length > 0) {
    console.log(`  Warnings:`);
    policy.evidenceWarnings.forEach(w => console.log(`    - ${w}`));
  }

  console.log(`  Evidence Summary:`);
  console.log(`    Program Terms: ${evidence.programTermsAvailable ? '✓' : '✗'}`);
  console.log(`    Category Confidence: ${evidence.categoryConfidence}%`);
  console.log(`    Outcome Feasibility: ${evidence.outcomeFeasibilityScore}%`);
  console.log(`    Recommendation Evidence: ${evidence.recommendationEvidence}%`);
}
