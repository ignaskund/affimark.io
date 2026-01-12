-- =====================================================
-- AFFIMARK V2 - CREATOR OPERATIONS PLATFORM
-- =====================================================
-- Additive migration: Builds on existing LINK_AUDIT_SCHEMA.sql
-- Adds: Multi-storefront connections, transaction import,
--       currency normalization, tax exports, link optimization
-- =====================================================

-- =====================================================
-- CONNECTED STOREFRONTS (Multi-Platform)
-- =====================================================

CREATE TABLE IF NOT EXISTS connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Platform identification
  platform TEXT NOT NULL, -- 'amazon_de', 'amazon_uk', 'amazon_us', 'awin', 'ltk', 'shopmy', 'tradedoubler'
  storefront_name TEXT, -- User-friendly name: "My German Amazon Store"
  account_identifier TEXT, -- Platform-specific ID (Amazon Tag, Awin Publisher ID, etc.)
  region TEXT, -- 'DE', 'UK', 'US', 'FR', 'ES', 'EU'

  -- OAuth credentials (for platforms that support it)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Sync status
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
  sync_error TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, account_identifier)
);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_active ON connected_accounts(is_active, user_id);
CREATE INDEX idx_connected_accounts_sync ON connected_accounts(sync_status, last_sync_at);

COMMENT ON TABLE connected_accounts IS 'Multi-storefront connections (Amazon DE/UK/US, Awin, LTK, ShopMy, etc.)';

-- =====================================================
-- AFFILIATE TRANSACTIONS (Unified Earnings Data)
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connected_account_id UUID REFERENCES connected_accounts(id) ON DELETE SET NULL,

  -- Platform details
  platform TEXT NOT NULL, -- 'amazon_de', 'awin', 'ltk', etc.
  region TEXT, -- 'DE', 'UK', 'US'

  -- Transaction details
  transaction_date DATE NOT NULL,
  transaction_id TEXT, -- Platform-specific transaction ID
  order_id TEXT, -- Platform-specific order ID

  -- Product details
  product_name TEXT,
  product_id TEXT, -- ASIN, SKU, etc.
  product_category TEXT,

  -- Metrics
  clicks INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  items_shipped INTEGER DEFAULT 0, -- Amazon-specific
  conversions INTEGER DEFAULT 0, -- For non-Amazon platforms

  -- Revenue (original currency)
  revenue DECIMAL(10,2) DEFAULT 0,
  commission DECIMAL(10,2) DEFAULT 0,
  original_currency TEXT NOT NULL, -- 'EUR', 'GBP', 'USD'

  -- Normalized to EUR (for unified dashboard)
  commission_eur DECIMAL(10,2),
  revenue_eur DECIMAL(10,2),
  exchange_rate DECIMAL(10,6), -- Rate used for conversion

  -- Raw data (for audit trail)
  raw_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, transaction_id, transaction_date)
);

CREATE INDEX idx_transactions_user ON affiliate_transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_account ON affiliate_transactions(connected_account_id);
CREATE INDEX idx_transactions_platform ON affiliate_transactions(platform, transaction_date DESC);
CREATE INDEX idx_transactions_date ON affiliate_transactions(transaction_date DESC);

COMMENT ON TABLE affiliate_transactions IS 'Unified affiliate earnings across all platforms with multi-currency normalization';

-- =====================================================
-- CURRENCY EXCHANGE RATES (ECB Rates for EU Compliance)
-- =====================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Rate details
  from_currency TEXT NOT NULL, -- 'USD', 'GBP'
  to_currency TEXT NOT NULL DEFAULT 'EUR', -- Always normalize to EUR
  rate DECIMAL(10,6) NOT NULL,

  -- Date
  rate_date DATE NOT NULL,

  -- Source
  source TEXT DEFAULT 'ecb', -- 'ecb' (European Central Bank), 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_currency, to_currency, rate_date)
);

CREATE INDEX idx_exchange_rates_lookup ON exchange_rates(from_currency, to_currency, rate_date DESC);

COMMENT ON TABLE exchange_rates IS 'Currency exchange rates (primarily ECB for EU compliance)';

-- =====================================================
-- TAX EXPORT TEMPLATES (Persona-Based Formatting)
-- =====================================================

CREATE TABLE IF NOT EXISTS tax_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Persona details
  persona_code TEXT UNIQUE NOT NULL, -- 'de_freelancer', 'uk_sole_trader', 'lt_mb'
  persona_name TEXT NOT NULL, -- "German Freelancer (Freiberufler)"
  country_code TEXT NOT NULL, -- 'DE', 'UK', 'LT'

  -- Template configuration (JSON structure for PDF/CSV formatting)
  template_config JSONB NOT NULL,

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tax_personas_country ON tax_personas(country_code);

COMMENT ON TABLE tax_personas IS 'Tax export persona templates (EÜR, BTW, Self Assessment, etc.)';

-- Insert default personas
INSERT INTO tax_personas (persona_code, persona_name, country_code, template_config) VALUES
  ('de_freelancer', 'German Freelancer (Freiberufler)', 'DE', '{"format": "eur", "includes_vat": true, "date_format": "DD.MM.YYYY"}'),
  ('de_small_business', 'German Small Business (Kleinunternehmer)', 'DE', '{"format": "simplified", "includes_vat": false, "date_format": "DD.MM.YYYY"}'),
  ('uk_sole_trader', 'UK Sole Trader', 'UK', '{"format": "self_assessment", "currency": "GBP", "date_format": "DD/MM/YYYY"}'),
  ('nl_zzp', 'Dutch ZZP', 'NL', '{"format": "btw", "includes_vat": true, "date_format": "DD-MM-YYYY"}'),
  ('lt_mb', 'Lithuanian MB', 'LT', '{"format": "dual_currency", "currency": "EUR", "date_format": "YYYY-MM-DD"}'),
  ('generic_eu', 'Generic EU', 'EU', '{"format": "standard", "currency": "EUR", "date_format": "YYYY-MM-DD"}')
ON CONFLICT (persona_code) DO NOTHING;

-- =====================================================
-- AFFILIATE PROGRAMS DATABASE (For Optimization)
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Network & Program
  network TEXT NOT NULL, -- 'awin', 'tradedoubler', 'impact', 'amazon', 'ltk', 'shopmy'
  program_id TEXT, -- Network-specific program ID
  brand_name TEXT NOT NULL,
  brand_domain TEXT, -- 'sony.com', 'zara.com'

  -- Categories
  category TEXT, -- 'electronics', 'fashion', 'beauty'
  subcategory TEXT,

  -- Commission structure (RANGES, not absolutes)
  commission_rate_low DECIMAL(5,2), -- e.g., 8.00 (8%)
  commission_rate_high DECIMAL(5,2), -- e.g., 12.00 (12%)
  commission_type TEXT DEFAULT 'percentage', -- 'percentage', 'fixed', 'tiered'

  -- Terms
  cookie_duration INTEGER, -- days
  average_order_value DECIMAL(10,2), -- for revenue estimation

  -- Region
  region TEXT DEFAULT 'EU', -- 'EU', 'DE', 'UK', 'US'

  -- Application
  requires_application BOOLEAN DEFAULT false,
  approval_difficulty TEXT, -- 'easy', 'medium', 'hard'

  -- Confidence & verification
  confidence_score INTEGER DEFAULT 3, -- 1-5 stars
  last_verified TIMESTAMPTZ,
  source TEXT DEFAULT 'manual', -- 'api', 'manual', 'community', 'scraped'

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_network ON affiliate_programs(network);
CREATE INDEX idx_programs_brand ON affiliate_programs(brand_name);
CREATE INDEX idx_programs_category ON affiliate_programs(category);
CREATE INDEX idx_programs_domain ON affiliate_programs(brand_domain);

COMMENT ON TABLE affiliate_programs IS 'Affiliate program database for Smart Link Optimizer with commission RANGES';

-- =====================================================
-- LINK OPTIMIZATION SUGGESTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS link_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Original link
  original_url TEXT NOT NULL,
  original_program TEXT,
  original_commission_rate DECIMAL(5,2),
  original_platform TEXT, -- 'amazon_de', etc.

  -- Suggested alternative
  suggested_program_id UUID REFERENCES affiliate_programs(id) ON DELETE SET NULL,
  suggested_url TEXT,
  suggested_commission_low DECIMAL(5,2),
  suggested_commission_high DECIMAL(5,2),

  -- Impact estimation
  monthly_clicks_estimate INTEGER, -- Based on user's historical traffic
  potential_gain_low DECIMAL(10,2),
  potential_gain_high DECIMAL(10,2),

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'dismissed', 'testing'
  confidence_score INTEGER DEFAULT 3, -- 1-5 stars

  -- User action
  user_action TEXT, -- 'accepted', 'dismissed', 'testing'
  user_action_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_optimizations_user ON link_optimizations(user_id, status);
CREATE INDEX idx_optimizations_program ON link_optimizations(suggested_program_id);

COMMENT ON TABLE link_optimizations IS 'Smart Link Optimizer suggestions with confidence ranges';

-- =====================================================
-- PLATFORM RELIABILITY TRACKING
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_reliability_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Platform
  platform TEXT NOT NULL, -- 'amazon_de', 'ltk', 'awin', etc.

  -- Period
  stat_date DATE NOT NULL,

  -- Metrics
  total_links_checked INTEGER DEFAULT 0,
  healthy_links INTEGER DEFAULT 0,
  broken_links INTEGER DEFAULT 0,
  out_of_stock_links INTEGER DEFAULT 0,
  issues_detected INTEGER DEFAULT 0,

  -- Calculated reliability (0-100)
  reliability_score DECIMAL(5,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, platform, stat_date)
);

CREATE INDEX idx_reliability_user ON platform_reliability_stats(user_id, stat_date DESC);
CREATE INDEX idx_reliability_platform ON platform_reliability_stats(platform, stat_date DESC);

COMMENT ON TABLE platform_reliability_stats IS 'Platform reliability metrics over time (pattern detection, not blame)';

-- =====================================================
-- USER PREFERENCES EXTENSION
-- =====================================================

CREATE TABLE IF NOT EXISTS user_creator_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Regional settings
  home_currency TEXT DEFAULT 'EUR', -- Primary currency for dashboard
  home_timezone TEXT DEFAULT 'Europe/Berlin',

  -- Tax persona
  preferred_tax_persona TEXT REFERENCES tax_personas(persona_code),

  -- Dashboard preferences
  dashboard_date_range TEXT DEFAULT '30d', -- '7d', '30d', '90d', 'all'

  -- Optimization preferences
  auto_optimize_enabled BOOLEAN DEFAULT FALSE, -- Opt-in for auto-link switching
  optimization_threshold DECIMAL(5,2) DEFAULT 5.00, -- Only suggest if >5% improvement

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_creator_preferences IS 'Creator-specific preferences (currency, tax persona, optimization thresholds)';

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_optimizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_reliability_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_creator_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY connected_accounts_policy ON connected_accounts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY affiliate_transactions_policy ON affiliate_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY link_optimizations_policy ON link_optimizations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY platform_reliability_policy ON platform_reliability_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY user_creator_prefs_policy ON user_creator_preferences FOR ALL USING (auth.uid() = user_id);

-- Public read for tax personas and affiliate programs (reference data)
ALTER TABLE tax_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tax_personas_read_policy ON tax_personas FOR SELECT USING (true);
CREATE POLICY affiliate_programs_read_policy ON affiliate_programs FOR SELECT USING (true);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get user's total earnings in home currency
CREATE OR REPLACE FUNCTION get_total_earnings(
  p_user_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  v_total DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(commission_eur), 0)
  INTO v_total
  FROM affiliate_transactions
  WHERE user_id = p_user_id
    AND (p_start_date IS NULL OR transaction_date >= p_start_date)
    AND transaction_date <= p_end_date;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate monthly growth rate
CREATE OR REPLACE FUNCTION get_earnings_growth(
  p_user_id UUID,
  p_months_back INTEGER DEFAULT 1
)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_current_month DECIMAL(10,2);
  v_previous_month DECIMAL(10,2);
  v_growth DECIMAL(5,2);
BEGIN
  -- Current month
  SELECT COALESCE(SUM(commission_eur), 0)
  INTO v_current_month
  FROM affiliate_transactions
  WHERE user_id = p_user_id
    AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Previous month
  SELECT COALESCE(SUM(commission_eur), 0)
  INTO v_previous_month
  FROM affiliate_transactions
  WHERE user_id = p_user_id
    AND transaction_date >= DATE_TRUNC('month', CURRENT_DATE - (p_months_back || ' months')::INTERVAL)
    AND transaction_date < DATE_TRUNC('month', CURRENT_DATE - (p_months_back - 1 || ' months')::INTERVAL);

  IF v_previous_month = 0 THEN
    RETURN NULL;
  END IF;

  v_growth := ((v_current_month - v_previous_month) / v_previous_month) * 100;

  RETURN v_growth;
END;
$$ LANGUAGE plpgsql;

-- Function to get top performing storefronts
CREATE OR REPLACE FUNCTION get_top_storefronts(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 5,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  platform TEXT,
  storefront_name TEXT,
  total_commission DECIMAL(10,2),
  total_clicks INTEGER,
  total_orders INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.platform,
    COALESCE(ca.storefront_name, t.platform) as storefront_name,
    SUM(t.commission_eur) as total_commission,
    SUM(t.clicks) as total_clicks,
    SUM(t.orders) as total_orders
  FROM affiliate_transactions t
  LEFT JOIN connected_accounts ca ON t.connected_account_id = ca.id
  WHERE t.user_id = p_user_id
    AND (p_start_date IS NULL OR t.transaction_date >= p_start_date)
    AND t.transaction_date <= p_end_date
  GROUP BY t.platform, ca.storefront_name
  ORDER BY total_commission DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_connected_accounts_updated_at
BEFORE UPDATE ON connected_accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_programs_updated_at
BEFORE UPDATE ON affiliate_programs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_creator_prefs_updated_at
BEFORE UPDATE ON user_creator_preferences
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION get_total_earnings IS 'Get total earnings in EUR for a user within date range';
COMMENT ON FUNCTION get_earnings_growth IS 'Calculate month-over-month earnings growth percentage';
COMMENT ON FUNCTION get_top_storefronts IS 'Get top performing storefronts by commission earned';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- This migration adds Creator Operations Platform features
-- to the existing Link Audit infrastructure.
-- Run this AFTER LINK_AUDIT_SCHEMA.sql is deployed.
-- =====================================================
