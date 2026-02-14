-- ============================================================
-- PRODUCT FINDER MIGRATION
-- ============================================================
-- Run in Supabase SQL Editor AFTER COMPLETE_DATABASE_SETUP.sql
-- Adds tables and columns for the new Product Finder feature
-- ============================================================

-- ============================================================
-- PART 1: EXTEND user_creator_preferences
-- ============================================================

-- Add priority columns
ALTER TABLE user_creator_preferences
ADD COLUMN IF NOT EXISTS product_priorities JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS brand_priorities JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS active_social_context JSONB DEFAULT '{"socials": [], "storefronts": []}',
ADD COLUMN IF NOT EXISTS onboarding_priorities_completed BOOLEAN DEFAULT false;

-- product_priorities format:
-- [
--   { "id": "quality", "rank": 1 },
--   { "id": "reviews", "rank": 2 },
--   { "id": "sustainability", "rank": 3 },
--   { "id": "price", "rank": 4 },
--   { "id": "design", "rank": 5 }
-- ]

-- brand_priorities format:
-- [
--   { "id": "commission", "rank": 1 },
--   { "id": "reputation", "rank": 2 },
--   { "id": "return_policy", "rank": 3 },
--   { "id": "customer_service", "rank": 4 },
--   { "id": "cookie_duration", "rank": 5 }
-- ]

-- active_social_context format:
-- {
--   "socials": ["youtube", "instagram"],
--   "storefronts": ["amazon_de", "ltk"]
-- }

COMMENT ON COLUMN user_creator_preferences.product_priorities IS 'Ranked product priorities (1-5) for scoring alternatives';
COMMENT ON COLUMN user_creator_preferences.brand_priorities IS 'Ranked brand priorities (1-5) for scoring merchants';
COMMENT ON COLUMN user_creator_preferences.active_social_context IS 'Which socials/storefronts to consider in searches';
COMMENT ON COLUMN user_creator_preferences.onboarding_priorities_completed IS 'Whether user completed priority selection in onboarding';

-- ============================================================
-- PART 2: PRODUCT FINDER SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS product_finder_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Input
  input_type TEXT NOT NULL CHECK (input_type IN ('url', 'category')),
  input_value TEXT NOT NULL,

  -- Context snapshot at search time
  product_priorities_snapshot JSONB NOT NULL DEFAULT '[]',
  brand_priorities_snapshot JSONB NOT NULL DEFAULT '[]',
  active_context_snapshot JSONB NOT NULL DEFAULT '{}',
  active_context_hash TEXT, -- Hash for detecting toggle changes (Fix #6)

  -- Original product (if URL input)
  original_product JSONB,

  -- Results
  alternatives JSONB DEFAULT '[]',
  alternatives_count INTEGER DEFAULT 0,

  -- Interaction tracking
  current_index INTEGER DEFAULT 0,
  viewed_alternatives JSONB DEFAULT '[]',
  saved_alternatives JSONB DEFAULT '[]',
  skipped_alternatives JSONB DEFAULT '[]',
  selected_alternative_id TEXT,

  -- Chat history
  chat_messages JSONB DEFAULT '[]',

  -- Status
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'ready', 'browsing', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE product_finder_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own finder sessions" ON product_finder_sessions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access finder sessions" ON product_finder_sessions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_finder_sessions_user ON product_finder_sessions(user_id);
CREATE INDEX idx_finder_sessions_status ON product_finder_sessions(status);
CREATE INDEX idx_finder_sessions_created ON product_finder_sessions(created_at DESC);

-- ============================================================
-- PART 3: SAVED PRODUCTS (Enhanced Watchlist)
-- ============================================================

CREATE TABLE IF NOT EXISTS saved_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  finder_session_id UUID REFERENCES product_finder_sessions(id) ON DELETE SET NULL,

  -- Product info
  product_url TEXT NOT NULL,
  product_name TEXT,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',

  -- Match context
  match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
  match_reasons JSONB DEFAULT '[]',
  priority_alignment JSONB DEFAULT '{}',

  -- User organization
  list_type TEXT DEFAULT 'saved' CHECK (list_type IN ('saved', 'try_first', 'content_calendar', 'rejected')),
  notes TEXT,
  tags JSONB DEFAULT '[]',

  -- Affiliate info
  affiliate_network TEXT,
  affiliate_link TEXT,
  commission_rate DECIMAL(5,2),
  cookie_duration_days INTEGER,

  -- Status
  is_archived BOOLEAN DEFAULT false,
  promoted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, product_url)
);

ALTER TABLE saved_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved products" ON saved_products
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access saved products" ON saved_products
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_saved_products_user ON saved_products(user_id);
CREATE INDEX idx_saved_products_list ON saved_products(user_id, list_type) WHERE NOT is_archived;
CREATE INDEX idx_saved_products_category ON saved_products(user_id, category);

-- ============================================================
-- PART 4: SOCIAL CONTEXT ANALYSIS (for OAuth-connected socials)
-- ============================================================

CREATE TABLE IF NOT EXISTS social_context_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,

  -- Audience metrics
  follower_count INTEGER,
  avg_engagement_rate DECIMAL(5,2),
  primary_audience_age TEXT,
  primary_audience_gender TEXT,
  primary_audience_location TEXT,

  -- Content analysis
  content_categories JSONB DEFAULT '[]',
  posting_frequency TEXT,
  top_performing_content_types JSONB DEFAULT '[]',

  -- Niche indicators
  detected_niches JSONB DEFAULT '[]',
  brand_affinity_signals JSONB DEFAULT '[]',

  -- Raw data
  raw_api_response JSONB,

  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),

  UNIQUE(user_id, platform)
);

ALTER TABLE social_context_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social analysis" ON social_context_analysis
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access social analysis" ON social_context_analysis
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_social_analysis_user ON social_context_analysis(user_id);

-- ============================================================
-- PART 5: PRIORITY OPTIONS REFERENCE (for UI consistency)
-- ============================================================

CREATE TABLE IF NOT EXISTS priority_options (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('product', 'brand')),
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- Seed product priorities
INSERT INTO priority_options (id, type, label, description, icon, display_order) VALUES
  ('quality', 'product', 'Quality & Durability', 'Products built to last with premium materials', 'shield-check', 1),
  ('price', 'product', 'Price & Value', 'Best bang for the buck, affordable options', 'tag', 2),
  ('reviews', 'product', 'Customer Reviews', 'Products with strong social proof and ratings', 'star', 3),
  ('sustainability', 'product', 'Sustainability & Ethics', 'Eco-friendly, ethical manufacturing', 'leaf', 4),
  ('design', 'product', 'Design & Aesthetics', 'Visually appealing, well-designed products', 'palette', 5),
  ('shipping', 'product', 'Shipping & Availability', 'Fast shipping, good stock levels', 'truck', 6),
  ('warranty', 'product', 'Warranty & Guarantees', 'Strong return policies and warranties', 'shield', 7),
  ('brand_recognition', 'product', 'Brand Recognition', 'Well-known, established brands', 'award', 8)
ON CONFLICT (id) DO NOTHING;

-- Seed brand priorities
INSERT INTO priority_options (id, type, label, description, icon, display_order) VALUES
  ('commission', 'brand', 'Commission Rate', 'Higher earnings per sale', 'percent', 1),
  ('customer_service', 'brand', 'Customer Service', 'Brands known for great support', 'headphones', 2),
  ('return_policy', 'brand', 'Return Policy', 'Easy returns reduce refund complaints', 'refresh-cw', 3),
  ('reputation', 'brand', 'Brand Reputation', 'Trusted, established brands', 'badge-check', 4),
  ('brand_sustainability', 'brand', 'Sustainability & Ethics', 'Environmentally conscious companies', 'globe', 5),
  ('payment_speed', 'brand', 'Payment Reliability', 'Timely, reliable affiliate payments', 'credit-card', 6),
  ('cookie_duration', 'brand', 'Cookie Duration', 'Longer tracking window = more conversions', 'clock', 7),
  ('easy_approval', 'brand', 'Easy Approval', 'No lengthy application process', 'check-circle', 8)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PART 6: USER PRODUCT PROFILES (Built from socials/storefronts)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_product_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Priorities (from onboarding, cached here)
  product_priorities JSONB DEFAULT '[]',
  brand_priorities JSONB DEFAULT '[]',

  -- Social context (refreshed monthly)
  social_platforms JSONB DEFAULT '[]',
  content_categories JSONB DEFAULT '[]',
  audience_demographics JSONB DEFAULT '{}',
  estimated_reach INTEGER DEFAULT 0,

  -- Storefront context (refreshed weekly)
  dominant_categories JSONB DEFAULT '[]',
  top_brands JSONB DEFAULT '[]',
  avg_price_point DECIMAL(10,2) DEFAULT 0,
  preferred_networks JSONB DEFAULT '[]',

  -- Metadata
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  last_social_analysis TIMESTAMPTZ,
  last_storefront_analysis TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

ALTER TABLE user_product_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_product_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access profiles" ON user_product_profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_user_profiles_user ON user_product_profiles(user_id);

COMMENT ON TABLE user_product_profiles IS 'User profiles built from socials/storefronts for personalized product matching';
COMMENT ON COLUMN user_product_profiles.social_platforms IS 'Connected social platforms: ["youtube", "instagram"]';
COMMENT ON COLUMN user_product_profiles.content_categories IS 'Inferred content categories: ["tech", "lifestyle"]';
COMMENT ON COLUMN user_product_profiles.dominant_categories IS 'Product categories from storefront: [{"category": "Electronics", "percentage": 0.65}]';
COMMENT ON COLUMN user_product_profiles.confidence_score IS 'Profile completeness: 0-100 (40=priorities, 30=socials, 30=storefronts)';

-- ============================================================
-- PART 7: UPDATE TRIGGER FUNCTION (Must be created BEFORE triggers)
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================
-- PART 8: CREATE TRIGGERS (Uses function created above)
-- ============================================================

DROP TRIGGER IF EXISTS update_user_product_profiles_updated_at ON user_product_profiles;
CREATE TRIGGER update_user_product_profiles_updated_at
  BEFORE UPDATE ON user_product_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_finder_sessions_updated_at ON product_finder_sessions;
CREATE TRIGGER update_product_finder_sessions_updated_at
  BEFORE UPDATE ON product_finder_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_products_updated_at ON saved_products;
CREATE TRIGGER update_saved_products_updated_at
  BEFORE UPDATE ON saved_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- PART 9: COST TRACKING (Fix #8 - Cost Governor)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_operation_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL, -- 'search_full', 'ai_analysis_sonnet', etc.
  operation_date DATE NOT NULL,
  cost_estimate_usd DECIMAL(10,4), -- Estimated cost in USD
  tokens_used INTEGER,
  model_used TEXT,
  session_id UUID, -- Optional link to finder session
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_operation_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own costs" ON user_operation_costs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access costs" ON user_operation_costs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_user_costs_daily ON user_operation_costs(user_id, operation_date);
CREATE INDEX idx_user_costs_monthly ON user_operation_costs(user_id, operation_date)
  WHERE operation_date >= DATE_TRUNC('month', CURRENT_DATE);

COMMENT ON TABLE user_operation_costs IS 'Tracks operation costs per user for budget enforcement (Fix #8)';

-- ============================================================
-- PART 10: IMPLICIT FEEDBACK TRACKING (Fix #10 - Feedback Loop)
-- ============================================================

CREATE TABLE IF NOT EXISTS finder_implicit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id UUID REFERENCES product_finder_sessions(id) ON DELETE CASCADE,

  -- Product reference
  product_id TEXT NOT NULL,
  product_name TEXT,
  product_brand TEXT,
  product_category TEXT,
  affiliate_network TEXT,

  -- Match context (what scores did we give it)
  match_score INTEGER,
  outcome_feasibility INTEGER,
  display_position INTEGER, -- Position in results (1 = top)

  -- Implicit signals
  viewed BOOLEAN DEFAULT false,
  view_duration_seconds INTEGER,
  saved BOOLEAN DEFAULT false,
  clicked_link BOOLEAN DEFAULT false,
  asked_agent_about BOOLEAN DEFAULT false, -- User asked questions about this product
  selected_as_winner BOOLEAN DEFAULT false,
  rejected BOOLEAN DEFAULT false,

  -- Timing
  feedback_timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE finder_implicit_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback" ON finder_implicit_feedback
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Service role full access feedback" ON finder_implicit_feedback
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE INDEX idx_feedback_user ON finder_implicit_feedback(user_id);
CREATE INDEX idx_feedback_product ON finder_implicit_feedback(product_id);
CREATE INDEX idx_feedback_session ON finder_implicit_feedback(session_id);

COMMENT ON TABLE finder_implicit_feedback IS 'Implicit user feedback for machine learning (Fix #10)';

-- ============================================================
-- DONE
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'PRODUCT FINDER MIGRATION COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - product_finder_sessions';
  RAISE NOTICE '  - saved_products';
  RAISE NOTICE '  - social_context_analysis';
  RAISE NOTICE '  - user_product_profiles (for profile-based matching)';
  RAISE NOTICE '  - priority_options (with seed data)';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables altered:';
  RAISE NOTICE '  - user_creator_preferences (added priority columns)';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Run this migration in Supabase SQL Editor';
  RAISE NOTICE '  2. Verify tables created successfully';
  RAISE NOTICE '  3. Test the new onboarding flow';
  RAISE NOTICE '============================================================';
END $$;
