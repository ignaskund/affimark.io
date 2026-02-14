/**
 * Content Viability Engine for Product Verifier
 *
 * Evaluates whether a product is suitable for content creation:
 * - E-E-A-T signals (Expertise, Experience, Authority, Trust)
 * - Proof requirements (what evidence creator needs)
 * - Thin content risk (can you differentiate?)
 * - YMYL category detection
 *
 * Helps creators avoid products that are hard to market
 * without thin/low-quality affiliate content.
 */

// --- Types ---

export interface EEATSignals {
  expertise_provable: boolean;
  expertise_explanation: string;
  experience_demonstrable: boolean;
  experience_explanation: string;
  authority_buildable: boolean;
  authority_explanation: string;
  trust_signals_available: boolean;
  trust_explanation: string;
}

export interface ContentViability {
  score: number; // 0-100
  proof_requirements: string[];
  thin_content_risk: 'high' | 'medium' | 'low';
  thin_content_explanation: string;
  eeat_signals: EEATSignals;
  recommended_content_types: string[];
  avoid_content_types: string[];
  ymyl_category: boolean;
  ymyl_warnings: string[];
  differentiation_angles: string[];
  competition_notes: string;
}

export interface ContentViabilityInput {
  product_title: string;
  brand: string | null;
  category: string | null;
  price: number | null;
  description: string | null;
  review_count: number;
  rating: number | null;
  claims: string[];
  has_images: boolean;
  has_video: boolean;
  positive_angles: string[]; // From review analysis
  platform: string;
}

// --- YMYL Categories ---

const YMYL_KEYWORDS = [
  'health', 'medical', 'medicine', 'supplement', 'vitamin', 'treatment', 'cure',
  'finance', 'investment', 'loan', 'credit', 'insurance', 'tax', 'retirement',
  'legal', 'law', 'attorney', 'contract',
  'safety', 'emergency', 'security',
  'baby', 'infant', 'child safety',
];

const YMYL_CATEGORIES = [
  'health', 'wellness', 'supplements', 'medicine',
  'finance', 'investing', 'insurance',
  'baby', 'infant', 'child',
];

// --- Competition Indicators ---

const HIGH_COMPETITION_CATEGORIES = [
  'electronics', 'fashion', 'beauty', 'home decor',
  'fitness', 'weight loss', 'skincare',
];

const COMMODITY_INDICATORS = [
  'amazon basics', 'generic', 'no brand', 'unbranded',
  'white label', 'oem',
];

// --- Main Evaluation Function ---

export function evaluateContentViability(input: ContentViabilityInput): ContentViability {
  const eeat_signals = evaluateEEAT(input);
  const ymyl = evaluateYMYL(input);
  const thin_content = evaluateThinContentRisk(input);
  const proof_requirements = generateProofRequirements(input, ymyl.is_ymyl);
  const content_types = recommendContentTypes(input, thin_content.risk);
  const differentiation = findDifferentiationAngles(input);
  const competition = assessCompetition(input);

  // Calculate overall score
  let score = 50; // Start neutral

  // EEAT contribution (max +25)
  if (eeat_signals.expertise_provable) score += 7;
  if (eeat_signals.experience_demonstrable) score += 8;
  if (eeat_signals.authority_buildable) score += 5;
  if (eeat_signals.trust_signals_available) score += 5;

  // Content feasibility (max +25)
  if (input.has_images) score += 5;
  if (input.has_video) score += 5;
  if (input.review_count >= 50) score += 5;
  if (input.positive_angles.length >= 2) score += 5;
  if (differentiation.length >= 2) score += 5;

  // Penalties
  if (thin_content.risk === 'high') score -= 20;
  else if (thin_content.risk === 'medium') score -= 10;

  if (ymyl.is_ymyl) score -= 10; // YMYL requires more care
  if (competition.level === 'saturated') score -= 10;
  else if (competition.level === 'high') score -= 5;

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    proof_requirements,
    thin_content_risk: thin_content.risk,
    thin_content_explanation: thin_content.explanation,
    eeat_signals,
    recommended_content_types: content_types.recommended,
    avoid_content_types: content_types.avoid,
    ymyl_category: ymyl.is_ymyl,
    ymyl_warnings: ymyl.warnings,
    differentiation_angles: differentiation,
    competition_notes: competition.notes,
  };
}

// --- E-E-A-T Evaluation ---

function evaluateEEAT(input: ContentViabilityInput): EEATSignals {
  // Expertise: Can creator demonstrate knowledge?
  const expertise_provable =
    input.category !== null &&
    (input.description?.length || 0) > 100;
  const expertise_explanation = expertise_provable
    ? 'Product has enough detail to demonstrate knowledge'
    : 'Limited product info makes expertise demonstration harder';

  // Experience: Can creator show hands-on use?
  const experience_demonstrable =
    input.has_images ||
    input.has_video ||
    input.price !== null && input.price < 200; // Affordable to purchase
  const experience_explanation = experience_demonstrable
    ? 'Product can be demonstrated through personal use'
    : 'Hard to show personal experience (high price or no visuals)';

  // Authority: Can creator build credibility?
  const authority_buildable =
    input.review_count >= 20 &&
    input.rating !== null &&
    input.rating >= 4.0;
  const authority_explanation = authority_buildable
    ? 'Strong existing reviews support creator authority'
    : 'Limited reviews make authority building harder';

  // Trust: Are there trust signals to leverage?
  const trust_signals_available =
    input.brand !== null &&
    input.brand.length > 0 &&
    !COMMODITY_INDICATORS.some(c => input.brand!.toLowerCase().includes(c));
  const trust_explanation = trust_signals_available
    ? 'Branded product provides trust foundation'
    : 'Generic/unbranded products have lower inherent trust';

  return {
    expertise_provable,
    expertise_explanation,
    experience_demonstrable,
    experience_explanation,
    authority_buildable,
    authority_explanation,
    trust_signals_available,
    trust_explanation,
  };
}

// --- YMYL Evaluation ---

function evaluateYMYL(input: ContentViabilityInput): { is_ymyl: boolean; warnings: string[] } {
  const warnings: string[] = [];
  let is_ymyl = false;

  const searchText = [
    input.product_title,
    input.category,
    input.description,
    ...input.claims,
  ].filter(Boolean).join(' ').toLowerCase();

  // Check for YMYL keywords
  for (const keyword of YMYL_KEYWORDS) {
    if (searchText.includes(keyword)) {
      is_ymyl = true;
      break;
    }
  }

  // Check for YMYL categories
  if (input.category) {
    for (const cat of YMYL_CATEGORIES) {
      if (input.category.toLowerCase().includes(cat)) {
        is_ymyl = true;
        break;
      }
    }
  }

  if (is_ymyl) {
    warnings.push('This product falls into a Your Money Your Life (YMYL) category');
    warnings.push('Google applies higher scrutiny to YMYL content');
    warnings.push('Ensure all claims are substantiated and properly disclosed');

    // Check for problematic claims
    const problematicClaims = [
      'cure', 'treat', 'heal', 'guaranteed', 'clinically proven',
      'doctor recommended', 'fda approved', 'miracle',
    ];

    for (const claim of problematicClaims) {
      if (searchText.includes(claim)) {
        warnings.push(`Caution: Contains "${claim}" claim - verify substantiation`);
      }
    }
  }

  return { is_ymyl, warnings };
}

// --- Thin Content Risk ---

function evaluateThinContentRisk(input: ContentViabilityInput): {
  risk: 'high' | 'medium' | 'low';
  explanation: string;
} {
  let riskScore = 0;
  const reasons: string[] = [];

  // Commodity product
  if (input.brand && COMMODITY_INDICATORS.some(c => input.brand!.toLowerCase().includes(c))) {
    riskScore += 3;
    reasons.push('generic/commodity product');
  }

  // High competition category
  if (input.category && HIGH_COMPETITION_CATEGORIES.some(c =>
    input.category!.toLowerCase().includes(c)
  )) {
    riskScore += 2;
    reasons.push('highly competitive category');
  }

  // Limited product info
  if (!input.description || input.description.length < 100) {
    riskScore += 2;
    reasons.push('limited product description');
  }

  // No unique angles from reviews
  if (input.positive_angles.length < 2) {
    riskScore += 2;
    reasons.push('few unique selling points');
  }

  // Low visual assets
  if (!input.has_images && !input.has_video) {
    riskScore += 1;
    reasons.push('no visual assets');
  }

  // Determine risk level
  let risk: 'high' | 'medium' | 'low';
  let explanation: string;

  if (riskScore >= 5) {
    risk = 'high';
    explanation = `High thin content risk: ${reasons.slice(0, 2).join(', ')}. Creating unique, valuable content will be challenging.`;
  } else if (riskScore >= 3) {
    risk = 'medium';
    explanation = `Medium thin content risk: ${reasons[0]}. Ensure your content adds genuine value.`;
  } else {
    risk = 'low';
    explanation = 'Good potential for unique, valuable content.';
  }

  return { risk, explanation };
}

// --- Proof Requirements ---

function generateProofRequirements(input: ContentViabilityInput, is_ymyl: boolean): string[] {
  const requirements: string[] = [];

  // Basic requirements
  requirements.push('Affiliate disclosure clearly visible');

  // Price-based
  if (input.price && input.price > 100) {
    requirements.push('Demonstrate personal use or thorough testing');
  }

  // Review-based
  if (input.review_count < 20) {
    requirements.push('Provide detailed hands-on review (limited existing reviews)');
  }

  // Category-specific
  if (input.category?.toLowerCase().includes('electronic')) {
    requirements.push('Include specifications comparison');
    requirements.push('Show real-world performance metrics');
  }

  if (input.category?.toLowerCase().includes('fashion') ||
      input.category?.toLowerCase().includes('clothing')) {
    requirements.push('Show fit on real person(s)');
    requirements.push('Include sizing guidance');
  }

  if (input.category?.toLowerCase().includes('beauty') ||
      input.category?.toLowerCase().includes('skincare')) {
    requirements.push('Document results over time');
    requirements.push('Note skin type compatibility');
  }

  // YMYL additions
  if (is_ymyl) {
    requirements.push('Cite credible sources for any claims');
    requirements.push('Include professional disclaimers');
    requirements.push('Avoid unsubstantiated health/financial claims');
  }

  // Visual proof
  if (!input.has_images) {
    requirements.push('Create original product photos');
  }

  if (!input.has_video && input.price && input.price > 50) {
    requirements.push('Consider video demonstration');
  }

  return requirements.slice(0, 6);
}

// --- Content Type Recommendations ---

function recommendContentTypes(
  input: ContentViabilityInput,
  thinRisk: 'high' | 'medium' | 'low'
): { recommended: string[]; avoid: string[] } {
  const recommended: string[] = [];
  const avoid: string[] = [];

  // Always safe
  recommended.push('Honest review with personal experience');

  // Based on content risk
  if (thinRisk === 'high') {
    avoid.push('Simple product roundups');
    avoid.push('Thin comparison posts');
    recommended.push('In-depth single product review');
    recommended.push('Problem-solution format');
  } else {
    recommended.push('Comparison with alternatives');
    recommended.push('Best-of lists in niche');
  }

  // Based on product type
  if (input.has_video || input.price && input.price > 50) {
    recommended.push('Video demonstration/unboxing');
  }

  if (input.positive_angles.length >= 2) {
    recommended.push('Use-case focused content');
  }

  // Category-specific
  if (input.category?.toLowerCase().includes('tech') ||
      input.category?.toLowerCase().includes('electronic')) {
    recommended.push('Specs comparison table');
    recommended.push('Long-term durability update');
  }

  // General avoids
  avoid.push('Auto-generated product descriptions');
  avoid.push('Purely specification-based content');

  return {
    recommended: recommended.slice(0, 4),
    avoid: avoid.slice(0, 3),
  };
}

// --- Differentiation Angles ---

function findDifferentiationAngles(input: ContentViabilityInput): string[] {
  const angles: string[] = [];

  // From positive review themes
  for (const angle of input.positive_angles) {
    angles.push(angle);
  }

  // From brand
  if (input.brand && !COMMODITY_INDICATORS.some(c => input.brand!.toLowerCase().includes(c))) {
    angles.push(`Brand story: ${input.brand}`);
  }

  // From price positioning
  if (input.price) {
    if (input.price < 30) angles.push('Budget-friendly option');
    else if (input.price > 200) angles.push('Premium/investment piece');
  }

  // From reviews
  if (input.rating && input.rating >= 4.5 && input.review_count >= 100) {
    angles.push('Crowd-validated choice');
  }

  // Suggest if none found
  if (angles.length === 0) {
    angles.push('Personal experience angle needed');
    angles.push('Find unique use case');
  }

  return angles.slice(0, 4);
}

// --- Competition Assessment ---

function assessCompetition(input: ContentViabilityInput): {
  level: 'low' | 'medium' | 'high' | 'saturated';
  notes: string;
} {
  let level: 'low' | 'medium' | 'high' | 'saturated' = 'medium';
  let notes = '';

  // Major platforms = more competition
  if (input.platform === 'amazon') {
    level = 'high';
    notes = 'Amazon products face high affiliate competition. ';
  }

  // Category-based
  if (input.category) {
    const cat = input.category.toLowerCase();
    if (HIGH_COMPETITION_CATEGORIES.some(c => cat.includes(c))) {
      level = 'saturated';
      notes += 'Saturated category - unique angle essential. ';
    }
  }

  // Brand recognition
  const majorBrands = ['apple', 'samsung', 'sony', 'nike', 'adidas', 'amazon'];
  if (input.brand && majorBrands.some(b => input.brand!.toLowerCase().includes(b))) {
    if (level !== 'saturated') level = 'high';
    notes += 'Major brand with many existing reviews. ';
  }

  // Niche indicators
  if (input.review_count < 50 && input.brand && !majorBrands.some(b =>
    input.brand!.toLowerCase().includes(b)
  )) {
    level = 'low';
    notes = 'Niche product with less competition - good opportunity. ';
  }

  if (!notes) {
    notes = 'Moderate competition - differentiation recommended.';
  }

  return { level, notes: notes.trim() };
}
