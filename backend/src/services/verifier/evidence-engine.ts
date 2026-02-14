/**
 * Evidence Engine for Product Verifier
 *
 * Tracks all data sources used in analysis, calculates cross-source
 * agreement, and generates confidence explanations.
 *
 * This provides transparency: users can see exactly what data
 * informed the decision and why confidence is low/med/high.
 */

// --- Types ---

export type EvidenceSourceType =
  | 'product_page'
  | 'trustpilot'
  | 'reviews_io'
  | 'google_reviews'
  | 'affiliate_db'
  | 'policy_page'
  | 'brand_site';

export interface EvidenceSource {
  source: EvidenceSourceType;
  label: string;
  data_points: number;
  recency_days: number | null;
  quality: 'high' | 'medium' | 'low';
  snippets?: string[];
  url?: string;
}

export interface EvidenceSummary {
  sources: EvidenceSource[];
  total_data_points: number;
  source_count: number;
  cross_source_agreement: 'HIGH' | 'MED' | 'LOW';
  confidence: 'HIGH' | 'MED' | 'LOW';
  confidence_explanation: string[];
  gaps: string[];
  strengths: string[];
}

export interface EvidenceCollector {
  addSource(source: EvidenceSource): void;
  addProductPageEvidence(data: ProductPageEvidence): void;
  addReputationEvidence(data: ReputationEvidence): void;
  addAffiliateDbEvidence(data: AffiliateDbEvidence): void;
  getSummary(): EvidenceSummary;
}

interface ProductPageEvidence {
  has_rating: boolean;
  rating: number | null;
  review_count: number;
  has_price: boolean;
  has_description: boolean;
  has_brand: boolean;
  has_images: boolean;
  page_url: string;
}

interface ReputationEvidence {
  trustpilot_score: number | null;
  trustpilot_reviews: number;
  reviews_io_score: number | null;
  reviews_io_reviews: number;
  recency_days: number | null;
}

interface AffiliateDbEvidence {
  program_found: boolean;
  program_name: string | null;
  confidence_score: number | null;
  last_verified_days: number | null;
}

// --- Evidence Collector Implementation ---

export function createEvidenceCollector(): EvidenceCollector {
  const sources: EvidenceSource[] = [];

  return {
    addSource(source: EvidenceSource) {
      sources.push(source);
    },

    addProductPageEvidence(data: ProductPageEvidence) {
      let dataPoints = 0;
      let quality: 'high' | 'medium' | 'low' = 'low';

      if (data.has_rating && data.rating !== null) dataPoints += 1;
      if (data.review_count > 0) dataPoints += Math.min(data.review_count, 100) / 10;
      if (data.has_price) dataPoints += 1;
      if (data.has_description) dataPoints += 1;
      if (data.has_brand) dataPoints += 1;
      if (data.has_images) dataPoints += 1;

      // Quality based on completeness
      if (dataPoints >= 8) quality = 'high';
      else if (dataPoints >= 4) quality = 'medium';

      sources.push({
        source: 'product_page',
        label: 'Product Page',
        data_points: Math.round(dataPoints),
        recency_days: 0, // Live scrape
        quality,
        url: data.page_url,
      });
    },

    addReputationEvidence(data: ReputationEvidence) {
      if (data.trustpilot_score !== null || data.trustpilot_reviews > 0) {
        sources.push({
          source: 'trustpilot',
          label: 'Trustpilot',
          data_points: Math.min(data.trustpilot_reviews, 100),
          recency_days: data.recency_days,
          quality: data.trustpilot_reviews >= 50 ? 'high' : data.trustpilot_reviews >= 10 ? 'medium' : 'low',
        });
      }

      if (data.reviews_io_score !== null || data.reviews_io_reviews > 0) {
        sources.push({
          source: 'reviews_io',
          label: 'Reviews.io',
          data_points: Math.min(data.reviews_io_reviews, 100),
          recency_days: data.recency_days,
          quality: data.reviews_io_reviews >= 50 ? 'high' : data.reviews_io_reviews >= 10 ? 'medium' : 'low',
        });
      }
    },

    addAffiliateDbEvidence(data: AffiliateDbEvidence) {
      if (data.program_found) {
        const quality: 'high' | 'medium' | 'low' =
          data.confidence_score && data.confidence_score >= 4 ? 'high' :
          data.confidence_score && data.confidence_score >= 3 ? 'medium' : 'low';

        sources.push({
          source: 'affiliate_db',
          label: 'Affiliate Database',
          data_points: 1,
          recency_days: data.last_verified_days,
          quality,
        });
      }
    },

    getSummary(): EvidenceSummary {
      const totalDataPoints = sources.reduce((sum, s) => sum + s.data_points, 0);
      const sourceCount = sources.length;

      // Calculate cross-source agreement
      const crossSourceAgreement = calculateCrossSourceAgreement(sources);

      // Calculate confidence
      const confidence = calculateConfidence(sources, totalDataPoints, crossSourceAgreement);

      // Generate explanations
      const { explanations, gaps, strengths } = generateExplanations(sources, confidence);

      return {
        sources,
        total_data_points: Math.round(totalDataPoints),
        source_count: sourceCount,
        cross_source_agreement: crossSourceAgreement,
        confidence,
        confidence_explanation: explanations,
        gaps,
        strengths,
      };
    },
  };
}

// --- Helper Functions ---

function calculateCrossSourceAgreement(sources: EvidenceSource[]): 'HIGH' | 'MED' | 'LOW' {
  if (sources.length < 2) return 'LOW';

  const highQualityCount = sources.filter(s => s.quality === 'high').length;
  const mediumOrHighCount = sources.filter(s => s.quality !== 'low').length;

  if (highQualityCount >= 2 && sources.length >= 3) return 'HIGH';
  if (mediumOrHighCount >= 2) return 'MED';
  return 'LOW';
}

function calculateConfidence(
  sources: EvidenceSource[],
  totalDataPoints: number,
  agreement: 'HIGH' | 'MED' | 'LOW'
): 'HIGH' | 'MED' | 'LOW' {
  // High confidence requires:
  // - At least 3 sources
  // - At least 20 data points
  // - High or medium cross-source agreement
  // - At least one high-quality source

  const hasHighQuality = sources.some(s => s.quality === 'high');
  const hasFreshData = sources.some(s => s.recency_days !== null && s.recency_days <= 7);

  if (
    sources.length >= 3 &&
    totalDataPoints >= 20 &&
    agreement !== 'LOW' &&
    hasHighQuality &&
    hasFreshData
  ) {
    return 'HIGH';
  }

  if (
    sources.length >= 2 &&
    totalDataPoints >= 10 &&
    (hasHighQuality || agreement !== 'LOW')
  ) {
    return 'MED';
  }

  return 'LOW';
}

function generateExplanations(
  sources: EvidenceSource[],
  confidence: 'HIGH' | 'MED' | 'LOW'
): { explanations: string[]; gaps: string[]; strengths: string[] } {
  const explanations: string[] = [];
  const gaps: string[] = [];
  const strengths: string[] = [];

  // Source coverage
  const sourceTypes = new Set(sources.map(s => s.source));

  if (sourceTypes.has('product_page')) {
    const productSource = sources.find(s => s.source === 'product_page');
    if (productSource?.quality === 'high') {
      strengths.push('Rich product page data available');
    }
  } else {
    gaps.push('Product page data not extracted');
  }

  if (sourceTypes.has('trustpilot') || sourceTypes.has('reviews_io')) {
    strengths.push('Third-party reviews available');
  } else {
    gaps.push('No third-party merchant reviews found');
  }

  if (sourceTypes.has('affiliate_db')) {
    strengths.push('Affiliate program data verified');
  } else {
    gaps.push('No affiliate program data - using category estimates');
  }

  // Review volume
  const totalReviews = sources
    .filter(s => ['product_page', 'trustpilot', 'reviews_io'].includes(s.source))
    .reduce((sum, s) => sum + s.data_points, 0);

  if (totalReviews < 10) {
    gaps.push('Limited review volume (fewer than 10 reviews)');
    explanations.push('Low review count reduces prediction accuracy');
  } else if (totalReviews >= 100) {
    strengths.push(`Strong review volume (${totalReviews}+ reviews)`);
  }

  // Recency
  const staleSourceCount = sources.filter(
    s => s.recency_days !== null && s.recency_days > 30
  ).length;

  if (staleSourceCount > 0) {
    gaps.push('Some data is older than 30 days');
  }

  // Confidence explanation
  if (confidence === 'LOW') {
    explanations.push('Confidence is LOW because: ' + gaps.slice(0, 2).join(', '));
  } else if (confidence === 'MED') {
    if (gaps.length > 0) {
      explanations.push('Some data gaps exist: ' + gaps[0]);
    }
    explanations.push('Confidence is MEDIUM - verify key assumptions before committing');
  } else {
    explanations.push('Strong evidence from multiple sources supports this analysis');
  }

  return { explanations, gaps, strengths };
}

// --- Utility: Format Evidence for Display ---

export function formatEvidenceForUI(summary: EvidenceSummary): {
  sources_display: Array<{ name: string; quality: string; count: string }>;
  agreement_badge: { label: string; color: string };
  confidence_badge: { label: string; color: string };
} {
  const sources_display = summary.sources.map(s => ({
    name: s.label,
    quality: s.quality,
    count: s.data_points > 1 ? `${s.data_points} data points` : '1 data point',
  }));

  const agreementColors = {
    HIGH: 'emerald',
    MED: 'amber',
    LOW: 'red',
  };

  const confidenceColors = {
    HIGH: 'emerald',
    MED: 'amber',
    LOW: 'red',
  };

  return {
    sources_display,
    agreement_badge: {
      label: summary.cross_source_agreement,
      color: agreementColors[summary.cross_source_agreement],
    },
    confidence_badge: {
      label: summary.confidence,
      color: confidenceColors[summary.confidence],
    },
  };
}
