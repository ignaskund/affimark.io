// ============================================================
// Product Verifier Types
// ============================================================

// --- Enums / Unions ---

export type VerifierStatus =
  | 'analyzing'
  | 'snapshot_ready'
  | 'alternatives_ready'
  | 'playbook_ready'
  | 'completed'
  | 'failed';

export type ConfidenceLevel = 'LOW' | 'MED' | 'HIGH';

export type VerdictStatus = 'GREEN' | 'YELLOW' | 'RED' | 'TEST_FIRST';

export type PrimaryAction = 'APPROVE' | 'ALT_BRAND' | 'ALT_PRODUCT' | 'TEST_FIRST';

export type AlternativeMode = 'SAME_CATEGORY_DIFF_BRAND' | 'SAME_BRAND_DIFF_PRODUCT';

export type TrafficType = 'PAID' | 'ORGANIC' | 'MIXED';

export type RiskTolerance = 'SAFE' | 'BALANCED' | 'AGGRESSIVE';

export type PlatformPreference = 'AMAZON' | 'DTC' | 'ANY';

export type ShippingExpectation = 'FAST' | 'STANDARD' | 'ANY';

export type CommissionModel = 'CPS' | 'CPA' | 'HYBRID';

export type AlertType =
  | 'review_sentiment_change'
  | 'commission_change'
  | 'policy_change'
  | 'better_alternative'
  | 'price_change'
  | 'availability_change';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type ChannelType = 'SEO' | 'ADS' | 'EMAIL' | 'SOCIAL';

// --- Request Types ---

export interface AnalyzeRequest {
  product_url: string;
  user_context?: UserContext;
}

export interface UserContext {
  region?: string;
  traffic_type?: TrafficType;
  risk_tolerance?: RiskTolerance;
  platform_preference?: PlatformPreference;
  min_commission_pct?: number;
  min_cookie_days?: number;
  price_band?: PriceBand;
}

export interface PriceBand {
  min: number;
  max: number;
}

export interface AlternativesRequest {
  mode: AlternativeMode;
  constraints: AlternativeConstraints;
}

export interface AlternativeConstraints {
  region: string;
  price_band: PriceBand;
  shipping_expectation: ShippingExpectation;
  min_commission_pct: number;
  min_cookie_days: number;
  platform_preference: PlatformPreference;
  risk_tolerance: RiskTolerance;
}

// --- Product Data ---

export interface ProductData {
  title: string;
  brand: string;
  category: string;
  merchant: string;
  price: ProductPrice;
  description?: string;
  image_url?: string;
  rating?: number;
  review_count?: number;
  availability?: string;
  variants?: ProductVariant[];
  claims?: string[];
  region_availability?: string[];
}

export interface ProductPrice {
  amount: number;
  currency: string;
  original_amount?: number; // if on sale
}

export interface ProductVariant {
  name: string;
  price?: number;
  available?: boolean;
}

// --- Scores ---

export interface Scores {
  product_viability: number;
  offer_merchant: number;
  economics: number;
}

export interface ScoreBreakdown {
  product_viability: ProductViabilityBreakdown;
  offer_merchant: OfferMerchantBreakdown;
  economics: EconomicsBreakdown;
}

export interface ProductViabilityBreakdown {
  demand_signals: number;       // 0-25
  review_sentiment: number;     // 0-25
  pricing_competitiveness: number; // 0-25
  category_fit: number;         // 0-15
  uniqueness: number;           // 0-10
  details: Record<string, string>;
}

export interface OfferMerchantBreakdown {
  merchant_trust: number;       // 0-30
  shipping_returns: number;     // 0-20
  policy_clarity: number;       // 0-15
  brand_risk: number;           // 0-20
  compliance: number;           // 0-15
  details: Record<string, string>;
}

export interface EconomicsBreakdown {
  commission_component: number; // 0-40
  conversion_component: number; // 0-25
  aov_component: number;        // 0-20
  refund_adjustment: number;    // 0-15
  details: Record<string, string>;
}

// --- Confidence & Evidence ---

export interface EvidenceSummary {
  sources: EvidenceSource[];
  cross_source_agreement: ConfidenceLevel;
  total_data_points: number;
}

export interface EvidenceSource {
  name: string;
  type: 'on_page' | 'reviews' | 'reputation' | 'commission_db' | 'scrape';
  count: number;
  recency_days: number;
}

// --- Verdict ---

export interface Verdict {
  status: VerdictStatus;
  primary_action: PrimaryAction;
  hard_stop_flags: string[];
}

// --- Economics ---

export interface EconomicsDetails {
  commission: CommissionInfo;
  cookie_days: number;
  earning_band: EarningBand;
  assumptions: EconomicsAssumptions;
}

export interface CommissionInfo {
  rate_pct_low: number;
  rate_pct_high: number;
  model: CommissionModel;
  network?: string;
  program_name?: string;
}

export interface EarningBand {
  low: number;
  high: number;
  currency: string;
  period: 'monthly';
}

export interface EconomicsAssumptions {
  aov: number;
  conversion_rate: number;
  refund_rate: number;
  estimated_monthly_clicks?: number;
}

// --- Decision Snapshot (full response) ---

export interface DecisionSnapshot {
  session_id?: string;
  product: ProductData;
  scores: Scores;
  score_breakdowns: Record<string, Record<string, number>>;
  confidence: {
    level: ConfidenceLevel;
    evidence: EvidenceSummary;
  };
  verdict: Verdict;
  insights: {
    top_pros: string[];
    top_risks: string[];
    key_assumptions: string[];
  };
  economics: EconomicsDetails;
  coverage: CoverageResult;
}

// --- Alternatives ---

export interface Alternative {
  id: string;
  title: string;
  brand: string;
  category: string;
  merchant: string;
  network: string;
  url?: string;
  price_band: PriceBand;
  scores: Scores;
  confidence: ConfidenceLevel;
  commission: CommissionInfo;
  cookie_days: number;
  requires_application: boolean;
  approval_difficulty?: string;
  signup_url?: string;
  why_recommended: string[];
  main_risk: string;
  hard_stop_flags: string[];
  shipping_info?: Record<string, unknown>;
  return_policy?: Record<string, unknown>;
}

export interface AlternativesResponse {
  session_id: string;
  mode: AlternativeMode;
  alternatives: Alternative[];
  total_candidates: number;
}

// --- Compare View ---

export interface CompareItem {
  id: string;
  title: string;
  brand: string;
  merchant: string;
  price_band: PriceBand;
  commission: CommissionInfo;
  cookie_days: number;
  scores: Scores;
  shipping_info?: Record<string, unknown>;
  return_policy?: Record<string, unknown>;
  review_themes?: string[];
  risk_flags: string[];
}

// --- Playbook ---

export interface Playbook {
  approved_item: {
    id: string;
    title: string;
    brand: string;
  };
  positioning_angles: PositioningAngle[];
  audience: AudienceTargeting;
  channel_plan: ChannelPlanItem[];
  assets_checklist: string[];
  tracking_checklist: string[];
  test_plan: TestPlan;
  compliance_notes: string[];
}

export interface PositioningAngle {
  angle_name: string;
  hook: string;
  proof_points: string[];
}

export interface AudienceTargeting {
  primary_segment: string;
  pain_points: string[];
  objections: string[];
  buying_triggers: string[];
}

export interface ChannelPlanItem {
  channel: ChannelType;
  recommended: boolean;
  steps: string[];
}

export interface TestPlan {
  kpis: string[];
  duration_days: number;
  iteration_rules: string[];
}

// --- Watchlist ---

export interface WatchlistItem {
  id: string;
  session_id: string | null;
  url: string;
  normalized_url?: string;
  product_name: string;
  brand: string;
  merchant: string;
  category?: string;
  last_snapshot: {
    scores: Scores;
    verdict: VerdictStatus;
    confidence: ConfidenceLevel;
  } | null;
  monitoring_config: MonitoringConfig;
  last_checked_at: string | null;
  next_check_at: string | null;
  alert_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MonitoringConfig {
  review_sentiment: boolean;
  commission_changes: boolean;
  policy_changes: boolean;
  better_alternatives: boolean;
}

// --- Alerts ---

export interface VerifierAlert {
  id: string;
  watchlist_id: string;
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  previous_value: unknown;
  new_value: unknown;
  is_read: boolean;
  created_at: string;
}

// --- Library ---

export interface LibraryItem {
  id: string;
  session_id: string;
  product_name: string;
  brand: string;
  category: string;
  verdict: VerdictStatus;
  scores: Scores;
  notes?: string;
  tags: string[];
  created_at: string;
}

// --- Verifier Session (full DB row) ---

export interface VerifierSession {
  id: string;
  user_id: string;
  url: string;
  normalized_url: string | null;
  merchant: string | null;
  platform: string | null;
  region: string | null;
  status: VerifierStatus;
  user_context: UserContext;
  product_data: ProductData | null;
  product_viability_score: number | null;
  offer_merchant_score: number | null;
  economics_score: number | null;
  confidence: ConfidenceLevel | null;
  verdict: VerdictStatus | null;
  primary_action: PrimaryAction | null;
  hard_stop_flags: string[];
  top_pros: string[];
  top_risks: string[];
  key_assumptions: string[];
  evidence_summary: EvidenceSummary | null;
  score_breakdowns: ScoreBreakdown | null;
  economics_details: EconomicsDetails | null;
  constraints: AlternativeConstraints | null;
  alternatives: Alternative[];
  selected_alternative_id: string | null;
  compare_items: CompareItem[];
  playbook: Playbook | null;
  approved_item: { id: string; title: string; brand: string } | null;
  telemetry_events: TelemetryEvent[];
  created_at: string;
  updated_at: string;
}

// --- Telemetry ---

export type TelemetryEventName =
  | 'analyze_started'
  | 'analyze_completed'
  | 'analyze_failed'
  | 'snapshot_viewed'
  | 'details_opened'
  | 'constraints_opened'
  | 'constraints_saved'
  | 'alternatives_generated'
  | 'compare_opened'
  | 'alternative_selected'
  | 'approved'
  | 'playbook_viewed'
  | 'playbook_exported'
  | 'watchlist_added';

export interface TelemetryEvent {
  event: TelemetryEventName;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ============================================================
// ENHANCED TYPES (Upgrade V2)
// ============================================================

// --- Enhanced Alert Types ---

export type EnhancedAlertType =
  | AlertType
  | 'price_drift'
  | 'policy_drift'
  | 'evidence_stale'
  | 'rating_crash';

// --- Evidence (Enhanced) ---

export interface EnhancedEvidenceSource {
  source: 'product_page' | 'trustpilot' | 'reviews_io' | 'google_reviews' | 'affiliate_db' | 'policy_page' | 'brand_site';
  label: string;
  data_points: number;
  recency_days: number | null;
  quality: 'high' | 'medium' | 'low';
  snippets?: string[];
  url?: string;
}

export interface EnhancedEvidenceSummary {
  sources: EnhancedEvidenceSource[];
  total_data_points: number;
  source_count: number;
  cross_source_agreement: 'HIGH' | 'MED' | 'LOW';
  confidence: ConfidenceLevel;
  confidence_explanation: string[];
  gaps: string[];
  strengths: string[];
}

// --- Review Themes ---

export type ReviewTheme =
  | 'quality'
  | 'shipping'
  | 'support'
  | 'value'
  | 'durability'
  | 'sizing'
  | 'ease_of_use'
  | 'packaging'
  | 'accuracy'
  | 'performance';

export interface ThemeAnalysis {
  theme: ReviewTheme;
  sentiment: 'positive' | 'neutral' | 'negative';
  frequency: number;
  mention_count: number;
  dealbreaker_likelihood: 'high' | 'medium' | 'low';
  example_snippets: string[];
}

export interface ReviewAnalysis {
  themes: ThemeAnalysis[];
  merchant_vs_product_blame: {
    merchant_issues_pct: number;
    product_issues_pct: number;
    explanation: string;
  };
  refund_drivers: string[];
  positive_angles: string[];
  objection_points: string[];
  overall_sentiment: 'positive' | 'mixed' | 'negative';
  sentiment_score: number;
}

// --- Policy Snapshot ---

export interface ReturnPolicy {
  days: number | null;
  conditions: string[];
  free_returns: boolean | null;
  clarity_score: number;
}

export interface ShippingPolicy {
  free_threshold: number | null;
  free_threshold_currency: string | null;
  estimated_days: string | null;
  regions: string[];
  clarity_score: number;
}

export interface SupportInfo {
  contact_visible: boolean;
  channels: ('email' | 'phone' | 'chat' | 'form')[];
  response_time: string | null;
  clarity_score: number;
}

export interface PolicySnapshot {
  returns: ReturnPolicy;
  shipping: ShippingPolicy;
  support: SupportInfo;
  overall_clarity: number;
  friction_flags: string[];
  snapshot_hash: string;
}

// --- Content Viability ---

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
  score: number;
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

// --- Economics Sensitivity ---

export interface SensitivityScenario {
  label: string;
  description: string;
  conversion_rate: number;
  aov: number;
  refund_rate: number;
  commission_rate: number;
  monthly_clicks: number;
  monthly_earnings: {
    gross: number;
    net: number;
  };
}

export interface EconomicsSensitivity {
  base_scenario: SensitivityScenario;
  pessimistic_scenario: SensitivityScenario;
  optimistic_scenario: SensitivityScenario;
  earning_band: {
    min: number;
    max: number;
    currency: string;
  };
  fragility: 'stable' | 'moderate' | 'fragile';
  fragility_explanation: string;
  key_driver: string;
  sensitivity_factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  breakeven_analysis: {
    clicks_needed_for_100: number;
    realistic: boolean;
  };
}

// --- Enhanced Alternative ---

export interface EnhancedAlternative extends Alternative {
  best_angle: string;
  biggest_risk: string;
  verify_next: string[];
  positioning_uniqueness: 'unique' | 'differentiated' | 'commodity';
  content_viability_score: number;
}

// --- Enhanced Decision Snapshot ---

export interface EnhancedDecisionSnapshot extends DecisionSnapshot {
  evidence_summary: EnhancedEvidenceSummary;
  review_analysis?: ReviewAnalysis;
  policy_snapshot?: PolicySnapshot;
  content_viability?: ContentViability;
  economics_sensitivity?: EconomicsSensitivity;
  refund_drivers?: string[];
  friction_flags?: string[];
}

// --- Enhanced Playbook ---

export interface ComplianceBlock {
  disclosure_placement: string[];
  claims_to_avoid: string[];
  substantiation_requirements: string[];
}

export interface ProofBuilder {
  screenshots_needed: string[];
  ugc_requirements: string[];
  demo_opportunities: string[];
  comparisons_to_make: string[];
}

export interface EnhancedPlaybook extends Playbook {
  compliance_block: ComplianceBlock;
  proof_builder: ProofBuilder;
  channel_templates: {
    seo?: {
      outline: string[];
      headings: string[];
      proof_checklist: string[];
      internal_linking: string[];
    };
    ads?: {
      creatives_checklist: string[];
      landing_requirements: string[];
      test_budget: string;
      disallowed_claims: string[];
    };
    email?: {
      sequence_suggestion: string[];
      segment: string;
      objections_to_handle: string[];
    };
  };
}

// --- Enhanced Watchlist ---

export interface EnhancedWatchlistItem extends WatchlistItem {
  last_policy_hash?: string;
  last_price?: number;
  price_validated_band?: {
    min: number;
    max: number;
    currency: string;
  };
  last_review_recency_days?: number;
}

export interface EnhancedVerifierAlert extends VerifierAlert {
  alert_type: EnhancedAlertType;
  impact_estimate?: string;
}

// ============================================================
// RECOMMENDATION SYSTEM TYPES (Upgrade V3)
// ============================================================

// --- Rank Modes ---

export type RankMode = 'balanced' | 'demand_first' | 'trust_first' | 'economics_first';

export type BucketKey = 'safe' | 'upside' | 'budget' | 'trending';

// --- Intent Router ---

export interface IntentRouterOutput {
  primary_route: 'category_alternatives' | 'brand_alternatives' | 'test_first';
  rank_mode: RankMode;
  bucket_strategy: 'standard' | 'conservative' | 'aggressive';
  show_trending: boolean;
  suppress_winner: boolean;
  banner: string | null;
  reason: string;
}

// --- Coverage ---

export interface CoverageResult {
  overall_score: number;
  by_pillar: {
    product_viability: number;
    offer_merchant: number;
    economics: number;
  };
  missing_signals: string[];
  data_quality: 'high' | 'medium' | 'low';
  recommendation: string;
}

// --- Ranked Alternative ---

export interface RankedAlternative {
  id: string;
  title: string;
  brand: string;
  category: string;
  merchant: string;
  network: string;

  // Scores
  product_viability: number;
  offer_merchant: number;
  economics: number;
  rank_score: number;

  // Economics
  commission_rate_low: number;
  commission_rate_high: number;
  cookie_days: number;
  avg_conversion_rate: number | null;
  avg_order_value: number | null;
  refund_rate: number | null;

  // Meta
  coverage: number;
  confidence: ConfidenceLevel;
  hard_stop_flags: string[];
  risk_score: number;
  trend_score: number | null;
  trend_eligible: boolean;

  // Presentation
  tags: string[];
  winner_eligible: boolean;
  bucket_hint: BucketKey | null;

  // Price
  price_low: number | null;
  price_high: number | null;
  currency: string;
}

// --- Bucket ---

export interface RecommendationBucket {
  key: BucketKey;
  title: string;
  description: string;
  items: RankedAlternative[];
  eligible: boolean;
}

// --- Full Recommendations Response ---

export interface RecommendationsResponse {
  session_id: string;
  mode: RankMode;
  routing: IntentRouterOutput;
  coverage: CoverageResult;
  winner: RankedAlternative | null;
  buckets: RecommendationBucket[];
  total_candidates?: number;
  can_rerank?: boolean;
}

// --- Combined Snapshot + Recommendations ---

export interface VerifierAnalysisResult {
  session_id: string;
  snapshot: DecisionSnapshot;
  recommendations: RecommendationsResponse;
}
