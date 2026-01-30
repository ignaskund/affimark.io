-- ============================================================
-- AFFIMARK CLEAN SCHEMA v1.0
-- ============================================================
-- This schema contains ONLY the tables needed for:
-- 1. Authentication (NextAuth + Supabase Auth)
-- 2. User Profiles
-- 3. Onboarding Magic (Linktree/Beacons import)
-- 4. Basic Dashboard display
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================

-- ============================================================
-- STEP 1: PROFILES TABLE (Core - Required for all foreign keys)
-- ============================================================
-- Note: This table links to Supabase's auth.users table
-- The id must match auth.users.id for the foreign key to work

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  user_type TEXT DEFAULT 'creator',  -- 'creator', 'brand', 'agency'
  onboarding_completed BOOLEAN DEFAULT false,

  -- Subscription/billing (for future Stripe integration)
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',  -- 'free', 'pro', 'enterprise'
  subscription_period_end TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (needed for OAuth signup)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Service role can do anything (needed for NextAuth creating profiles)
CREATE POLICY "Service role full access" ON profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);


-- ============================================================
-- STEP 2: USER STOREFRONTS (Imported from Linktree/Beacons)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_storefronts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Storefront identification
  platform TEXT NOT NULL,           -- 'ltk', 'amazon', 'shopmy', 'awin', etc.
  storefront_url TEXT NOT NULL,     -- Original storefront URL
  display_name TEXT,                -- "LTK Storefront" or custom name
  icon TEXT,                        -- Emoji or icon identifier

  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
  product_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, storefront_url)
);

-- RLS for user_storefronts
ALTER TABLE user_storefronts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own storefronts" ON user_storefronts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own storefronts" ON user_storefronts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own storefronts" ON user_storefronts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own storefronts" ON user_storefronts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access storefronts" ON user_storefronts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_storefronts_user_id
  ON user_storefronts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_storefronts_platform
  ON user_storefronts(user_id, platform);


-- ============================================================
-- STEP 3: USER STOREFRONT PRODUCTS (Products within storefronts)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_storefront_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storefront_id UUID NOT NULL REFERENCES user_storefronts(id) ON DELETE CASCADE,

  -- Product identification
  external_id TEXT,                 -- ASIN, SKU, or platform-specific ID
  product_url TEXT NOT NULL,        -- Affiliate link URL

  -- Product metadata
  title TEXT,
  brand TEXT,
  category TEXT,
  image_url TEXT,
  current_price DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',

  -- Platform info
  platform TEXT,                    -- 'amazon', 'ltk', etc.

  -- Enrichment tracking
  is_active BOOLEAN DEFAULT true,
  last_enriched_at TIMESTAMPTZ,
  enrichment_status TEXT DEFAULT 'pending', -- 'pending', 'enriched', 'failed', 'skipped'
  enrichment_error TEXT,
  raw_data JSONB,                   -- Store full API response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(storefront_id, product_url)
);

-- RLS for user_storefront_products
ALTER TABLE user_storefront_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own products" ON user_storefront_products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own products" ON user_storefront_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own products" ON user_storefront_products
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own products" ON user_storefront_products
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access products" ON user_storefront_products
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_storefront_products_user_id
  ON user_storefront_products(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_storefront_products_storefront_id
  ON user_storefront_products(storefront_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_storefront_products_external_id
  ON user_storefront_products(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_storefront_products_enrichment
  ON user_storefront_products(enrichment_status) WHERE enrichment_status = 'pending';


-- ============================================================
-- STEP 4: USER SOCIAL LINKS (Social media from import)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_social_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,           -- 'instagram', 'youtube', 'tiktok', 'twitter', etc.
  url TEXT NOT NULL,
  display_name TEXT,
  icon TEXT,
  follower_count INTEGER,
  is_verified BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform)
);

-- RLS for user_social_links
ALTER TABLE user_social_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own social links" ON user_social_links
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own social links" ON user_social_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social links" ON user_social_links
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social links" ON user_social_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access social links" ON user_social_links
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_user_social_links_user_id ON user_social_links(user_id);


-- ============================================================
-- STEP 5: USER CREATOR PREFERENCES (Dashboard settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_creator_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  home_currency TEXT DEFAULT 'EUR',
  selected_tax_persona_id UUID,
  timezone TEXT DEFAULT 'Europe/Berlin',

  -- Notification preferences
  email_notifications BOOLEAN DEFAULT true,
  link_health_alerts BOOLEAN DEFAULT true,
  weekly_summary BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for user_creator_preferences
ALTER TABLE user_creator_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences" ON user_creator_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_creator_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_creator_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access preferences" ON user_creator_preferences
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- STEP 6: CONNECTED ACCOUNTS (OAuth platforms for earnings)
-- ============================================================
-- This is for future earnings tracking via OAuth (Awin, etc.)

CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  platform TEXT NOT NULL,           -- 'amazon_de', 'amazon_uk', 'awin', 'ltk'
  storefront_name TEXT,             -- User-friendly name
  account_identifier TEXT,
  region TEXT,                      -- 'DE', 'UK', 'US', 'FR'

  -- OAuth tokens (encrypted in production)
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, region)
);

-- RLS for connected_accounts
ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts" ON connected_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts" ON connected_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON connected_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON connected_accounts
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access accounts" ON connected_accounts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);


-- ============================================================
-- STEP 7: LINK HEALTH ISSUES (Dashboard widget - can be empty)
-- ============================================================

CREATE TABLE IF NOT EXISTS link_health_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  product_url TEXT,
  issue_type TEXT NOT NULL,         -- 'broken_link', 'out_of_stock', 'redirect_error'
  severity TEXT DEFAULT 'medium',   -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'open',       -- 'open', 'resolved', 'ignored'

  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,

  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for link_health_issues
ALTER TABLE link_health_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own issues" ON link_health_issues
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own issues" ON link_health_issues
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own issues" ON link_health_issues
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access issues" ON link_health_issues
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Index
CREATE INDEX IF NOT EXISTS idx_link_health_issues_user_status
  ON link_health_issues(user_id, status);


-- ============================================================
-- STEP 8: LINK OPTIMIZATIONS (Dashboard widget - can be empty)
-- ============================================================

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

  status TEXT DEFAULT 'pending',    -- 'pending', 'applied', 'dismissed'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for link_optimizations
ALTER TABLE link_optimizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own optimizations" ON link_optimizations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own optimizations" ON link_optimizations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access optimizations" ON link_optimizations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- STEP 9: LINK AUDIT ACTIONS (Dashboard widget - can be empty)
-- ============================================================

CREATE TABLE IF NOT EXISTS link_audit_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  action_type TEXT NOT NULL,        -- 'fix_link', 'switch_program', 'remove_link'
  status TEXT DEFAULT 'pending',    -- 'pending', 'completed', 'failed'

  details JSONB,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for link_audit_actions
ALTER TABLE link_audit_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own actions" ON link_audit_actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own actions" ON link_audit_actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own actions" ON link_audit_actions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access actions" ON link_audit_actions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- STEP 10: HELPER FUNCTIONS
-- ============================================================

-- Drop existing functions first (they may have different signatures)
DROP FUNCTION IF EXISTS get_total_earnings(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS get_earnings_growth(UUID);
DROP FUNCTION IF EXISTS update_storefront_product_count();
DROP FUNCTION IF EXISTS get_user_storefront_summary(UUID);
DROP FUNCTION IF EXISTS get_platform_reliability(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_revenue_loss_summary(UUID, INTEGER);

-- Function to update storefront product count (trigger)
CREATE OR REPLACE FUNCTION update_storefront_product_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE user_storefronts
    SET product_count = product_count + 1, updated_at = NOW()
    WHERE id = NEW.storefront_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE user_storefronts
    SET product_count = GREATEST(product_count - 1, 0), updated_at = NOW()
    WHERE id = OLD.storefront_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for product count
DROP TRIGGER IF EXISTS trg_update_storefront_product_count ON user_storefront_products;
CREATE TRIGGER trg_update_storefront_product_count
  AFTER INSERT OR DELETE ON user_storefront_products
  FOR EACH ROW
  EXECUTE FUNCTION update_storefront_product_count();

-- Function to get total earnings (placeholder - returns 0 for now)
CREATE OR REPLACE FUNCTION get_total_earnings(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (total_commission_eur DECIMAL) AS $$
BEGIN
  -- Placeholder: returns 0 until affiliate_transactions table is implemented
  RETURN QUERY SELECT 0::DECIMAL AS total_commission_eur;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get earnings growth (placeholder - returns 0 for now)
CREATE OR REPLACE FUNCTION get_earnings_growth(p_user_id UUID)
RETURNS TABLE (growth_rate DECIMAL) AS $$
BEGIN
  -- Placeholder: returns 0 until affiliate_transactions table is implemented
  RETURN QUERY SELECT 0::DECIMAL AS growth_rate;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'AFFIMARK CLEAN SCHEMA - SETUP COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  1. profiles                  - User profiles (auth linked)';
  RAISE NOTICE '  2. user_storefronts          - Imported storefronts';
  RAISE NOTICE '  3. user_storefront_products  - Products in storefronts';
  RAISE NOTICE '  4. user_social_links         - Social media links';
  RAISE NOTICE '  5. user_creator_preferences  - User settings';
  RAISE NOTICE '  6. connected_accounts        - OAuth platform connections';
  RAISE NOTICE '  7. link_health_issues        - Link health tracking';
  RAISE NOTICE '  8. link_optimizations        - Optimization suggestions';
  RAISE NOTICE '  9. link_audit_actions        - Audit action tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'All tables have:';
  RAISE NOTICE '  - Row Level Security (RLS) enabled';
  RAISE NOTICE '  - User-specific access policies';
  RAISE NOTICE '  - Service role bypass policies';
  RAISE NOTICE '  - Appropriate indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Verify tables in Supabase Table Editor';
  RAISE NOTICE '  2. Check RLS policies in Authentication > Policies';
  RAISE NOTICE '  3. Test the sign-in flow';
  RAISE NOTICE '============================================================';
END $$;
