-- ============================================================
-- AFFIMARK COMPLETE DATABASE SETUP
-- ============================================================
-- Run this ONCE in Supabase SQL Editor to set up all tables
-- in the correct order with proper dependencies.
-- ============================================================

-- ============================================================
-- PART 1: CORE PROFILES TABLE (Required First)
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  user_type TEXT DEFAULT 'creator',
  onboarding_completed BOOLEAN DEFAULT false,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',
  subscription_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Service role full access profiles" ON profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ============================================================
-- PART 2: USER TABLES (Depend on profiles)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  storefront_url TEXT NOT NULL,
  display_name TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, storefront_url)
);

ALTER TABLE user_storefronts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own storefronts" ON user_storefronts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access storefronts" ON user_storefronts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE TABLE IF NOT EXISTS user_storefront_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL REFERENCES user_storefronts(id) ON DELETE CASCADE,
  external_id TEXT,
  product_url TEXT NOT NULL,
  title TEXT,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  current_price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',
  platform TEXT,
  is_active BOOLEAN DEFAULT true,
  last_enriched_at TIMESTAMPTZ,
  enrichment_status TEXT DEFAULT 'pending',
  enrichment_error TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(storefront_id, product_url)
);

ALTER TABLE user_storefront_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own products" ON user_storefront_products
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access products" ON user_storefront_products
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE TABLE IF NOT EXISTS user_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  display_name TEXT,
  icon TEXT,
  follower_count INTEGER,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

ALTER TABLE user_social_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own social links" ON user_social_links
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_creator_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  home_currency TEXT DEFAULT 'EUR',
  selected_tax_persona_id UUID,
  timezone TEXT DEFAULT 'Europe/Berlin',
  email_notifications BOOLEAN DEFAULT true,
  link_health_alerts BOOLEAN DEFAULT true,
  weekly_summary BOOLEAN DEFAULT true,
  agent_settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_creator_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own preferences" ON user_creator_preferences
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PART 3: AFFILIATE PROGRAMS (Core Commission Agent Data)
-- ============================================================

CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  network TEXT NOT NULL,
  network_display_name TEXT,
  commission_rate_low DECIMAL(5,2),
  commission_rate_high DECIMAL(5,2),
  cookie_duration_days INTEGER,
  primary_category TEXT,
  region TEXT DEFAULT 'global',
  is_active BOOLEAN DEFAULT true,
  program_url TEXT,
  signup_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_slug, network, region)
);

CREATE INDEX IF NOT EXISTS idx_affiliate_programs_brand ON affiliate_programs(brand_slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_category ON affiliate_programs(primary_category);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_network ON affiliate_programs(network);

-- ============================================================
-- PART 4: BRAND REPUTATION (Enhanced Agent)
-- ============================================================

CREATE TABLE IF NOT EXISTS brand_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,
  source TEXT NOT NULL,
  rating DECIMAL(3,2),
  review_count INTEGER,
  sentiment_label TEXT,
  sentiment_score DECIMAL(5,4),
  response_rate DECIMAL(5,2),
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_slug, source)
);

CREATE INDEX IF NOT EXISTS idx_brand_reputation_brand ON brand_reputation(brand_slug);
CREATE INDEX IF NOT EXISTS idx_brand_reputation_expires ON brand_reputation(expires_at);

-- ============================================================
-- PART 5: COMMISSION AGENT SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS commission_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  current_step TEXT DEFAULT 'insights',
  product_url TEXT,
  brand_slug TEXT,
  brand_name TEXT,
  category TEXT,
  insights_result JSONB,
  brand_research_result JSONB,
  optimization_result JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE commission_agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON commission_agent_sessions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access sessions" ON commission_agent_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================
-- PART 6: KPI DEFINITIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  category TEXT,
  benchmark_low DECIMAL(10,2),
  benchmark_avg DECIMAL(10,2),
  benchmark_high DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default KPIs
INSERT INTO kpi_definitions (kpi_key, display_name, description, unit, category, benchmark_low, benchmark_avg, benchmark_high) VALUES
  ('commission_rate', 'Commission Rate', 'Percentage earned per sale', '%', 'earnings', 2, 5, 12),
  ('cookie_duration', 'Cookie Duration', 'Days tracking persists', 'days', 'tracking', 1, 30, 90),
  ('epc', 'Earnings Per Click', 'Estimated earnings per 100 clicks', '€', 'earnings', 0.5, 2, 5),
  ('conversion_rate', 'Conversion Rate', 'Percentage of clicks that convert', '%', 'performance', 1, 3, 8),
  ('avg_order_value', 'Average Order Value', 'Typical purchase amount', '€', 'earnings', 25, 75, 200)
ON CONFLICT (kpi_key) DO NOTHING;

-- ============================================================
-- PART 7: LINK HEALTH & OPTIMIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS link_health_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_url TEXT,
  issue_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE link_health_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own issues" ON link_health_issues
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS link_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  original_program TEXT,
  original_rate DECIMAL(5,2),
  suggested_program TEXT,
  suggested_rate_low DECIMAL(5,2),
  suggested_rate_high DECIMAL(5,2),
  potential_gain_low DECIMAL(10,2),
  potential_gain_high DECIMAL(10,2),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE link_optimizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own optimizations" ON link_optimizations
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- DONE!
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'AFFIMARK DATABASE SETUP COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - profiles';
  RAISE NOTICE '  - user_storefronts';
  RAISE NOTICE '  - user_storefront_products';
  RAISE NOTICE '  - user_social_links';
  RAISE NOTICE '  - user_creator_preferences';
  RAISE NOTICE '  - affiliate_programs';
  RAISE NOTICE '  - brand_reputation';
  RAISE NOTICE '  - commission_agent_sessions';
  RAISE NOTICE '  - kpi_definitions';
  RAISE NOTICE '  - link_health_issues';
  RAISE NOTICE '  - link_optimizations';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Run COMMISSION_AGENT_SEED_V2.sql to add affiliate program data';
  RAISE NOTICE '============================================================';
END $$;
