/**
 * AffiMark TypeScript Type Definitions
 * Shared types for frontend and API routes
 */

// =====================================================
// USER & PROFILE TYPES
// =====================================================

export type UserType = 'creator' | 'brand' | 'agency' | 'startup';

// Tech domains for creators
export type TechDomain =
  | 'web_development'
  | 'mobile_development'
  | 'ai_ml'
  | 'devops'
  | 'cloud_infrastructure'
  | 'security'
  | 'data_engineering'
  | 'blockchain'
  | 'game_development'
  | 'hardware'
  | 'iot'
  | 'developer_tools'
  | 'open_source';

// Content formats for creators
export type ContentFormat =
  | 'youtube_tutorials'
  | 'youtube_reviews'
  | 'youtube_vlogs'
  | 'tiktok_shorts'
  | 'x_threads'
  | 'x_posts'
  | 'live_coding'
  | 'podcasts'
  | 'blog_posts'
  | 'courses'
  | 'newsletters';

// Product types for brands
export type ProductType =
  | 'b2b_saas'
  | 'b2c_saas'
  | 'devtool'
  | 'infrastructure'
  | 'ai_tool'
  | 'hardware'
  | 'consumer_electronics'
  | 'developer_service'
  | 'open_source_project';

// Target personas for brands
export type TargetPersona =
  | 'developers'
  | 'senior_developers'
  | 'tech_leads'
  | 'engineering_managers'
  | 'ctos'
  | 'devops_engineers'
  | 'data_scientists'
  | 'it_managers'
  | 'startup_founders'
  | 'tech_enthusiasts'
  | 'students';

// Compensation types
export type CompensationType =
  | 'flat'
  | 'flat_plus_bonus'
  | 'revenue_share'
  | 'affiliate'
  | 'product_only';

// Social platforms
export type Platform = 'youtube' | 'tiktok' | 'twitter' | 'instagram';

// =====================================================
// PROFILE INTERFACES
// =====================================================

export interface BaseProfile {
  id: string;
  user_type: UserType;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  website?: string;
  location?: string;
  onboarding_completed: boolean;
  primary_platforms: Platform[];
  target_regions: string[];
  languages: string[];
  created_at: string;
  updated_at: string;
}

export interface CreatorProfile extends BaseProfile {
  user_type: 'creator';
  tech_skills: string[];
  tech_domains: TechDomain[];
  content_formats: ContentFormat[];
  min_rate?: number;
  preferred_comp_types: CompensationType[];
}

export interface BrandProfile extends BaseProfile {
  user_type: 'brand' | 'startup';
  product_type?: ProductType;
  target_personas: TargetPersona[];
  brand_tech_stack: string[];
  typical_budget_range?: string;
}

export interface AgencyProfile extends BaseProfile {
  user_type: 'agency';
  // Agencies can have both creator and brand-like fields
  tech_domains: TechDomain[];
  target_personas: TargetPersona[];
  typical_budget_range?: string;
}

export type Profile = CreatorProfile | BrandProfile | AgencyProfile;

// =====================================================
// ONBOARDING TYPES
// =====================================================

export interface CreatorOnboardingData {
  user_type: 'creator';
  // From existing questionnaire
  content_focus: string[];
  audience_size: string;
  goals: string[];
  budget_range: string;
  posting_frequency: string;
  partnership_types: string[];
  // New tech-specific fields
  tech_skills: string[];
  tech_domains: string[];
  content_formats: string[];
  min_rate?: number;
  preferred_comp_types: string[];
  primary_platforms: string[];
  target_regions: string[];
  languages: string[];
}

export interface BrandOnboardingData {
  user_type: 'brand' | 'startup';
  // From existing questionnaire
  content_focus: string[]; // Industries
  audience_size: string; // Company size
  goals: string[];
  budget_range: string;
  posting_frequency: string; // Campaign frequency
  partnership_types: string[];
  // New tech-specific fields
  product_type: string;
  target_personas: string[];
  brand_tech_stack: string[];
  typical_budget_range: string;
  target_regions: string[];
  languages: string[];
}

export type OnboardingData = CreatorOnboardingData | BrandOnboardingData;

// =====================================================
// OPTIONS FOR UI SELECTS
// =====================================================

export const TECH_SKILLS_OPTIONS = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
  'Rust',
  'Java',
  'C++',
  'C#',
  'Ruby',
  'PHP',
  'Swift',
  'Kotlin',
  'React',
  'Vue',
  'Angular',
  'Next.js',
  'Node.js',
  'Django',
  'FastAPI',
  'Spring',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'Terraform',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'GraphQL',
  'REST APIs',
  'Git',
  'CI/CD',
  'Linux',
  'Machine Learning',
  'Deep Learning',
  'NLP',
  'Computer Vision',
];

export const TECH_DOMAINS_OPTIONS: { value: TechDomain; label: string }[] = [
  { value: 'web_development', label: 'Web Development' },
  { value: 'mobile_development', label: 'Mobile Development' },
  { value: 'ai_ml', label: 'AI & Machine Learning' },
  { value: 'devops', label: 'DevOps & SRE' },
  { value: 'cloud_infrastructure', label: 'Cloud & Infrastructure' },
  { value: 'security', label: 'Security & Privacy' },
  { value: 'data_engineering', label: 'Data Engineering' },
  { value: 'blockchain', label: 'Blockchain & Web3' },
  { value: 'game_development', label: 'Game Development' },
  { value: 'hardware', label: 'Hardware & Electronics' },
  { value: 'iot', label: 'IoT & Embedded' },
  { value: 'developer_tools', label: 'Developer Tools' },
  { value: 'open_source', label: 'Open Source' },
];

export const CONTENT_FORMATS_OPTIONS: { value: ContentFormat; label: string }[] = [
  { value: 'youtube_tutorials', label: 'YouTube Tutorials' },
  { value: 'youtube_reviews', label: 'YouTube Reviews' },
  { value: 'youtube_vlogs', label: 'YouTube Vlogs' },
  { value: 'tiktok_shorts', label: 'TikTok Shorts' },
  { value: 'x_threads', label: 'X/Twitter Threads' },
  { value: 'x_posts', label: 'X/Twitter Posts' },
  { value: 'live_coding', label: 'Live Streams' },
  { value: 'podcasts', label: 'Podcasts' },
  { value: 'blog_posts', label: 'Blog Posts' },
  { value: 'courses', label: 'Online Courses' },
  { value: 'newsletters', label: 'Newsletters' },
];

export const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'b2b_saas', label: 'B2B SaaS' },
  { value: 'b2c_saas', label: 'B2C SaaS' },
  { value: 'devtool', label: 'Developer Tool' },
  { value: 'infrastructure', label: 'Infrastructure / Platform' },
  { value: 'ai_tool', label: 'AI Tool / Service' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'consumer_electronics', label: 'Consumer Electronics' },
  { value: 'developer_service', label: 'Developer Service' },
  { value: 'open_source_project', label: 'Open Source Project' },
];

export const TARGET_PERSONAS_OPTIONS: { value: TargetPersona; label: string }[] = [
  { value: 'developers', label: 'Developers' },
  { value: 'senior_developers', label: 'Senior Developers' },
  { value: 'tech_leads', label: 'Tech Leads' },
  { value: 'engineering_managers', label: 'Engineering Managers' },
  { value: 'ctos', label: 'CTOs / VPs of Engineering' },
  { value: 'devops_engineers', label: 'DevOps Engineers' },
  { value: 'data_scientists', label: 'Data Scientists' },
  { value: 'it_managers', label: 'IT Managers' },
  { value: 'startup_founders', label: 'Startup Founders' },
  { value: 'tech_enthusiasts', label: 'Tech Enthusiasts' },
  { value: 'students', label: 'Students / Learners' },
];

export const COMP_TYPE_OPTIONS: { value: CompensationType; label: string; description: string }[] = [
  { value: 'flat', label: 'Flat Fee', description: 'Fixed payment for deliverables' },
  { value: 'flat_plus_bonus', label: 'Flat + Performance Bonus', description: 'Base pay plus performance incentives' },
  { value: 'revenue_share', label: 'Revenue Share', description: 'Percentage of sales/signups' },
  { value: 'affiliate', label: 'Affiliate Commission', description: 'Commission per conversion' },
  { value: 'product_only', label: 'Product Only', description: 'Free product/service access' },
];

export const REGION_OPTIONS = [
  'North America',
  'Europe',
  'Asia Pacific',
  'Latin America',
  'Middle East',
  'Africa',
  'Global',
];

export const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Japanese',
  'Korean',
  'Chinese',
  'Hindi',
  'Arabic',
];

// =====================================================
// CAMPAIGN & PITCH TYPES
// =====================================================

export type CollaborationStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'rejected'
  | 'withdrawn';

export type DeliverableType =
  | 'youtube_video'
  | 'youtube_short'
  | 'youtube_review'
  | 'tiktok_video'
  | 'x_thread'
  | 'x_post'
  | 'instagram_post'
  | 'instagram_reel'
  | 'blog_post'
  | 'newsletter'
  | 'podcast_episode'
  | 'live_stream'
  | 'tutorial'
  | 'documentation'
  | 'case_study'
  | 'whitepaper';

export type DeliverableStatus =
  | 'pending'
  | 'in_progress'
  | 'submitted'
  | 'revision_needed'
  | 'approved'
  | 'published';

export type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type PitchResponseStatus =
  | 'sent'
  | 'discussing'
  | 'accepted'
  | 'declined';

export type PaymentStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'disputed';

// =====================================================
// CAMPAIGN (Brand-initiated)
// =====================================================

export interface Campaign {
  id: string;
  brand_id: string;

  // Basic info
  title: string;
  description: string;
  objectives?: string;

  // Targeting
  required_tech_domains: string[];
  required_tech_skills: string[];
  preferred_platforms: string[];
  target_audience_size?: string;
  target_regions: string[];

  // Compensation
  budget_min?: number;
  budget_max?: number;
  compensation_type: CompensationType;
  commission_rate?: number;

  // Timeline
  application_deadline?: string;
  start_date?: string;
  end_date?: string;

  // Requirements
  min_follower_count?: number;
  min_engagement_rate?: number;
  content_guidelines?: string;
  brand_guidelines_url?: string;

  // Complexity (for fairness score)
  complexity_rating?: number; // 1-5

  // Status
  status: CollaborationStatus;
  is_featured: boolean;
  views_count: number;
  applications_count: number;

  // Admin
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// =====================================================
// PITCH (Creator-initiated)
// =====================================================

export interface Pitch {
  id: string;
  creator_id: string;

  // Targeting
  target_brand_id?: string;
  target_product_types: string[];
  target_industries: string[];

  // Basic info
  title: string;
  pitch_description: string;
  value_proposition?: string;

  // Creator's offering
  available_formats: string[];
  sample_work_urls: string[];
  tech_expertise: string[];
  audience_demographics?: {
    age_range?: string;
    locations?: string[];
    interests?: string[];
  };

  // Pricing
  asking_rate_min?: number;
  asking_rate_max?: number;
  preferred_comp_types: string[];

  // Availability
  available_from?: string;
  available_until?: string;
  estimated_delivery_days?: number;

  // Status
  status: CollaborationStatus;
  views_count: number;

  // Admin
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
}

// =====================================================
// DELIVERABLE
// =====================================================

export interface Deliverable {
  id: string;

  // Parent reference
  campaign_id?: string;
  pitch_id?: string;
  partnership_id?: string;

  // Details
  deliverable_type: DeliverableType;
  title: string;
  description?: string;
  specifications?: {
    duration?: string;
    format?: string;
    word_count?: number;
    resolution?: string;
    [key: string]: unknown;
  };

  // Compensation
  payment_amount?: number;

  // Timeline
  due_date?: string;

  // Status
  status: DeliverableStatus;
  submitted_at?: string;
  submitted_url?: string;
  revision_notes?: string;
  approved_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// CAMPAIGN APPLICATION
// =====================================================

export interface CampaignApplication {
  id: string;
  campaign_id: string;
  creator_id: string;

  // Application
  cover_letter?: string;
  proposed_approach?: string;
  sample_work_urls: string[];
  proposed_rate?: number;

  // Status
  status: ApplicationStatus;

  // Response
  brand_response?: string;
  responded_at?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// PITCH RESPONSE
// =====================================================

export interface PitchResponse {
  id: string;
  pitch_id: string;
  brand_id: string;

  // Response
  message?: string;
  is_interested: boolean;
  proposed_terms?: string;
  proposed_budget?: number;

  // Status
  status: PitchResponseStatus;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// ENHANCED PARTNERSHIP
// =====================================================

export interface Partnership {
  id: string;
  creator_id: string;
  product_id: string;

  // Campaign/Pitch references
  campaign_id?: string;
  pitch_id?: string;
  application_id?: string;
  pitch_response_id?: string;

  // Partnership details
  status: 'active' | 'pending' | 'completed' | 'cancelled';
  partnership_type: 'affiliate' | 'sponsorship' | 'partnership' | 'collaboration';

  // Terms
  agreed_payment?: number;
  commission_rate?: number;
  start_date?: string;
  end_date?: string;

  // Contract
  contract_url?: string;

  // Payment
  payment_status: PaymentStatus;
  payment_due_date?: string;

  // Performance
  clicks: number;
  conversions: number;
  revenue: number;

  // Reviews
  completed_at?: string;
  creator_rating?: number;
  brand_rating?: number;
  creator_review?: string;
  brand_review?: string;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// =====================================================
// WEBSITE ANALYSIS
// =====================================================

export interface WebsiteAnalysis {
  company_description?: string;
  product_description?: string;
  tech_stack?: string[];
  company_values?: string[];
  target_market?: string;
  company_size_estimate?: string;
  founded_year?: number;
  social_links?: {
    twitter?: string;
    linkedin?: string;
    github?: string;
    facebook?: string;
  };
  confidence_score?: number; // 0-100
}

// =====================================================
// UI OPTIONS FOR CAMPAIGNS/PITCHES
// =====================================================

export const DELIVERABLE_TYPE_OPTIONS: { value: DeliverableType; label: string; description: string }[] = [
  { value: 'youtube_video', label: 'YouTube Video', description: 'Full-length video (5+ min)' },
  { value: 'youtube_short', label: 'YouTube Short', description: 'Short-form video (<60s)' },
  { value: 'youtube_review', label: 'YouTube Review', description: 'Product review video' },
  { value: 'tiktok_video', label: 'TikTok Video', description: 'Short-form TikTok content' },
  { value: 'x_thread', label: 'X/Twitter Thread', description: 'Multi-tweet technical thread' },
  { value: 'x_post', label: 'X/Twitter Post', description: 'Single tweet' },
  { value: 'instagram_post', label: 'Instagram Post', description: 'Photo/carousel post' },
  { value: 'instagram_reel', label: 'Instagram Reel', description: 'Short-form video' },
  { value: 'blog_post', label: 'Blog Post', description: 'Written article' },
  { value: 'newsletter', label: 'Newsletter Feature', description: 'Email newsletter mention' },
  { value: 'podcast_episode', label: 'Podcast Episode', description: 'Podcast sponsorship/feature' },
  { value: 'live_stream', label: 'Live Stream', description: 'Live coding/demo session' },
  { value: 'tutorial', label: 'Tutorial', description: 'Step-by-step guide' },
  { value: 'documentation', label: 'Documentation', description: 'Technical documentation' },
  { value: 'case_study', label: 'Case Study', description: 'In-depth case study' },
  { value: 'whitepaper', label: 'Whitepaper', description: 'Technical whitepaper' },
];

export const COMPLEXITY_RATING_OPTIONS: { value: number; label: string; description: string }[] = [
  { value: 1, label: 'Very Simple', description: 'Basic mention or simple post' },
  { value: 2, label: 'Simple', description: 'Single deliverable, straightforward content' },
  { value: 3, label: 'Moderate', description: 'Multiple deliverables or technical content' },
  { value: 4, label: 'Complex', description: 'In-depth content requiring research' },
  { value: 5, label: 'Very Complex', description: 'Multi-part series or extensive research' },
];

export const AUDIENCE_SIZE_OPTIONS = [
  { value: '0-1k', label: 'Micro (0-1K)' },
  { value: '1k-10k', label: 'Nano (1K-10K)' },
  { value: '10k-50k', label: 'Micro (10K-50K)' },
  { value: '50k-100k', label: 'Mid-tier (50K-100K)' },
  { value: '100k-500k', label: 'Macro (100K-500K)' },
  { value: '500k-1m', label: 'Large (500K-1M)' },
  { value: '1m+', label: 'Mega (1M+)' },
];

// =====================================================
// MESSAGING
// =====================================================

export interface MessageThread {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  campaign_id?: string;
  pitch_id?: string;
  partnership_id?: string;

  // Status
  last_message_at: string;
  last_message_preview?: string;
  unread_count_p1: number;
  unread_count_p2: number;
  is_archived: boolean;

  // Populated fields (from API)
  participant_1?: BaseProfile;
  participant_2?: BaseProfile;
  campaign?: Campaign;
  pitch?: Pitch;
  partnership?: Partnership;
  other_participant?: BaseProfile;
  unread_count?: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  attachment_ids: string[];
  is_read: boolean;
  read_at?: string;

  // Populated fields (from API)
  sender?: BaseProfile;

  // Timestamps
  created_at: string;
}

// =====================================================
// NOTIFICATION
// =====================================================

export type NotificationType =
  | 'message_received'
  | 'campaign_application'
  | 'application_accepted'
  | 'application_rejected'
  | 'pitch_response'
  | 'deliverable_submitted'
  | 'deliverable_approved'
  | 'deliverable_revision_requested'
  | 'payment_received'
  | 'payment_released'
  | 'review_received'
  | 'partnership_started'
  | 'partnership_completed'
  | 'dispute_filed'
  | 'dispute_resolved';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  action_url?: string;
  is_read: boolean;
  read_at?: string;

  // Context references
  campaign_id?: string;
  pitch_id?: string;
  partnership_id?: string;
  message_id?: string;
  payment_id?: string;

  // Timestamps
  created_at: string;
}
