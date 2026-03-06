/**
 * MCP Alternative Search Agent — Shared Types
 *
 * These types define the contract between MCP tools and the agent orchestrator.
 * Every tool returns structured data that the agent reasons over to decide next steps.
 */

// ── Creator Profile ──────────────────────────────────────────────────────────

export interface CreatorProfile {
  userId: string;

  productPriorities: Array<{ id: string; rank: number }>;
  brandPriorities: Array<{ id: string; rank: number }>;

  socialContext: {
    platforms: string[];
    contentCategories: string[];
    audienceDemographics: {
      ageRange: string;
      topCountries: string[];
      interests: string[];
    };
    estimatedReach: number;
  };

  storefrontContext: {
    dominantCategories: Array<{ category: string; percentage: number }>;
    topBrands: string[];
    avgPricePoint: number;
    preferredNetworks: string[];
  };

  storefrontProducts: Array<{
    title: string;
    brand: string | null;
    category: string | null;
    price: number | null;
    platform: string;
    url: string;
  }>;

  confidenceScore: number;
}

// ── Product Identification ───────────────────────────────────────────────────

export interface IdentifiedProduct {
  title: string;
  brand: string | null;
  category: string;
  subcategory: string;
  price: number | null;
  currency: string;
  keywords: string[];
  searchQueries: string[];
  confidence: number;
  source: 'rainforest' | 'keepa' | 'scrape' | 'url_slug' | 'ai_asin' | 'ai_url' | 'datafeedr_sku';
}

// ── Search Candidates ────────────────────────────────────────────────────────

export interface SearchCandidate {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  imageUrl?: string;
  description?: string;
  merchant: string;
  affiliateNetwork: string;
  affiliateUrl: string;
  directUrl?: string;
  inStock: boolean;
}

// ── Scored Alternative ───────────────────────────────────────────────────────

export interface ScoredAlternative extends SearchCandidate {
  semanticSimilarity: number;

  productKpis: Array<{
    id: string;
    rank: number;
    label: string;
    score: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
    evidenceSource: string;
  }>;

  brandKpis: Array<{
    id: string;
    rank: number;
    label: string;
    score: number;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
    evidenceSource: string;
  }>;

  priorityWeightedScore: number;
  outcomeFeasibility: number;
  combinedScore: number;

  reasonCodes: string[];
  reasonSummary: string;
  warnings: string[];

  comparisonToOriginal: {
    priceDiff: string;
    categoryMatch: boolean;
    sameBrand: boolean;
    betterCommission: boolean;
    betterForPriority1: boolean;
  };
}

// ── Agent Decision Context ───────────────────────────────────────────────────

export interface SearchIteration {
  query: string;
  strategy: string;
  candidateCount: number;
  relevantCount: number;
  topScore: number;
  avgSemanticScore: number;
}

export interface AgentSearchResult {
  originalProduct: IdentifiedProduct;
  originalProductRisk?: import('../services/outcome-feasibility-scorer').OutcomeFeasibilityScore;
  alternatives: ScoredAlternative[];
  searchIterations: SearchIteration[];
  totalCandidatesEvaluated: number;
  agentReasoning: string;
  searchDurationMs: number;
}
