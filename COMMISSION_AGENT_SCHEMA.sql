-- ============================================================
-- COMMISSION AGENT SCHEMA
-- ============================================================
-- Tables for the Smart Link Optimizer / Commission Agent feature
-- Run this AFTER CLEAN_SCHEMA.sql
-- ============================================================


-- ============================================================
-- 1. AFFILIATE PROGRAMS DATABASE
-- ============================================================
-- Stores known affiliate programs with commission rates

CREATE TABLE IF NOT EXISTS affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Program identification
  network TEXT NOT NULL,            -- 'awin', 'shareasale', 'impact', 'amazon', 'direct'
  program_id TEXT,                  -- Network-specific program ID
  brand_name TEXT NOT NULL,         -- 'Sony', 'Nike', 'Samsung'
  brand_slug TEXT,                  -- 'sony', 'nike', 'samsung' (for matching)

  -- Categories
  category TEXT,                    -- 'electronics', 'fashion', 'beauty', 'home'
  subcategory TEXT,

  -- Commission structure
  commission_type TEXT DEFAULT 'cps', -- 'cps', 'cpa', 'cpl', 'hybrid'
  commission_rate_low DECIMAL(5,2),   -- Minimum rate (e.g., 5.00 for 5%)
  commission_rate_high DECIMAL(5,2),  -- Maximum rate (e.g., 12.00 for 12%)
  commission_flat_amount DECIMAL(10,2), -- For CPA/CPL models
  currency TEXT DEFAULT 'EUR',

  -- Cookie & attribution
  cookie_duration INTEGER,          -- Days (e.g., 30, 90)
  attribution_model TEXT,           -- 'last_click', 'first_click', 'linear'

  -- Requirements
  requires_application BOOLEAN DEFAULT true,
  approval_difficulty TEXT,         -- 'easy', 'medium', 'hard'
  minimum_payout DECIMAL(10,2),
  payment_terms TEXT,               -- 'net30', 'net60', 'monthly'

  -- Regional availability
  regions TEXT[],                   -- ['DE', 'UK', 'FR', 'US']

  -- Confidence & verification
  confidence_score INTEGER DEFAULT 3, -- 1-5 stars
  last_verified_at TIMESTAMPTZ,
  source TEXT,                      -- 'api', 'manual', 'community', 'scraped'

  -- Program links
  signup_url TEXT,
  program_page_url TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique program per network
  UNIQUE(network, brand_slug)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_brand_slug
  ON affiliate_programs(brand_slug);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_brand_name
  ON affiliate_programs(LOWER(brand_name));
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_category
  ON affiliate_programs(category);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_network
  ON affiliate_programs(network);
CREATE INDEX IF NOT EXISTS idx_affiliate_programs_commission
  ON affiliate_programs(commission_rate_high DESC);

-- RLS (public read, admin write)
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read affiliate programs" ON affiliate_programs
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage programs" ON affiliate_programs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- 2. BRAND ALIASES (for matching variations)
-- ============================================================
-- Maps brand name variations to canonical brand_slug

CREATE TABLE IF NOT EXISTS brand_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_slug TEXT NOT NULL,         -- Canonical slug (e.g., 'sony')
  alias TEXT NOT NULL,              -- Variation (e.g., 'sony electronics', 'sony.com')
  alias_type TEXT,                  -- 'name', 'domain', 'asin_prefix', 'url_pattern'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(alias)
);

CREATE INDEX IF NOT EXISTS idx_brand_aliases_alias ON brand_aliases(LOWER(alias));
CREATE INDEX IF NOT EXISTS idx_brand_aliases_slug ON brand_aliases(brand_slug);

ALTER TABLE brand_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read aliases" ON brand_aliases
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage aliases" ON brand_aliases
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- 3. LINK ANALYSES (user analysis history)
-- ============================================================
-- Stores user's analyzed links and found alternatives

CREATE TABLE IF NOT EXISTS link_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Original link info
  original_url TEXT NOT NULL,
  original_platform TEXT,           -- 'amazon_de', 'awin', 'ltk'
  detected_brand TEXT,
  detected_product TEXT,
  detected_asin TEXT,
  detected_commission_rate DECIMAL(5,2),

  -- Analysis results
  alternatives_found INTEGER DEFAULT 0,
  best_alternative_id UUID REFERENCES affiliate_programs(id),
  potential_gain_low DECIMAL(10,2),
  potential_gain_high DECIMAL(10,2),

  -- User action
  status TEXT DEFAULT 'analyzed',   -- 'analyzed', 'switched', 'dismissed', 'saved'
  switched_to_program_id UUID REFERENCES affiliate_programs(id),
  switched_at TIMESTAMPTZ,

  -- Metadata
  analysis_metadata JSONB,          -- Full analysis response

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_analyses_user_id
  ON link_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_link_analyses_brand
  ON link_analyses(detected_brand);

ALTER TABLE link_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own analyses" ON link_analyses
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analyses" ON link_analyses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses" ON link_analyses
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access analyses" ON link_analyses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- ============================================================
-- 4. PLATFORM COMMISSION RATES (Amazon categories, etc.)
-- ============================================================
-- Stores default commission rates for marketplaces by category

CREATE TABLE IF NOT EXISTS platform_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  platform TEXT NOT NULL,           -- 'amazon_de', 'amazon_uk', 'amazon_us'
  category TEXT NOT NULL,           -- 'electronics', 'fashion', 'beauty'
  commission_rate DECIMAL(5,2) NOT NULL,

  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT,                      -- 'official', 'scraped', 'manual'

  UNIQUE(platform, category)
);

ALTER TABLE platform_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform rates" ON platform_commission_rates
  FOR SELECT USING (true);


-- ============================================================
-- 5. SEED DATA: Amazon Commission Rates (2024/2025)
-- ============================================================

INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  -- Amazon DE rates
  ('amazon_de', 'amazon_games', 20.00, 'official'),
  ('amazon_de', 'luxury_beauty', 10.00, 'official'),
  ('amazon_de', 'luxury_stores', 10.00, 'official'),
  ('amazon_de', 'amazon_coins', 10.00, 'official'),
  ('amazon_de', 'digital_music', 5.00, 'official'),
  ('amazon_de', 'physical_music', 5.00, 'official'),
  ('amazon_de', 'handmade', 5.00, 'official'),
  ('amazon_de', 'kindle', 4.50, 'official'),
  ('amazon_de', 'fire_tv', 4.00, 'official'),
  ('amazon_de', 'home_garden', 4.00, 'official'),
  ('amazon_de', 'fashion', 4.00, 'official'),
  ('amazon_de', 'furniture', 3.00, 'official'),
  ('amazon_de', 'toys', 3.00, 'official'),
  ('amazon_de', 'kitchen', 3.00, 'official'),
  ('amazon_de', 'automotive', 3.00, 'official'),
  ('amazon_de', 'sports', 3.00, 'official'),
  ('amazon_de', 'books', 3.00, 'official'),
  ('amazon_de', 'baby', 3.00, 'official'),
  ('amazon_de', 'electronics', 1.00, 'official'),
  ('amazon_de', 'computers', 1.00, 'official'),
  ('amazon_de', 'video_games', 1.00, 'official'),
  ('amazon_de', 'health', 1.00, 'official'),
  ('amazon_de', 'grocery', 1.00, 'official'),
  ('amazon_de', 'default', 3.00, 'official')
ON CONFLICT (platform, category) DO UPDATE SET
  commission_rate = EXCLUDED.commission_rate,
  last_updated_at = NOW();


-- ============================================================
-- 6. SEED DATA: Popular Affiliate Programs
-- ============================================================

INSERT INTO affiliate_programs (
  network, brand_name, brand_slug, category,
  commission_rate_low, commission_rate_high, cookie_duration,
  requires_application, confidence_score, regions, source
) VALUES
  -- Electronics (better than Amazon's 1%)
  ('awin', 'Sony', 'sony', 'electronics', 3.00, 8.00, 30, true, 4, ARRAY['DE', 'UK', 'FR'], 'manual'),
  ('awin', 'Samsung', 'samsung', 'electronics', 2.00, 6.00, 30, true, 4, ARRAY['DE', 'UK'], 'manual'),
  ('awin', 'MediaMarkt', 'mediamarkt', 'electronics', 2.00, 5.00, 30, true, 5, ARRAY['DE'], 'manual'),
  ('awin', 'Saturn', 'saturn', 'electronics', 2.00, 5.00, 30, true, 5, ARRAY['DE'], 'manual'),
  ('impact', 'Best Buy', 'bestbuy', 'electronics', 1.00, 4.00, 7, true, 4, ARRAY['US'], 'manual'),

  -- Fashion (better than Amazon's 4%)
  ('awin', 'Zalando', 'zalando', 'fashion', 6.00, 12.00, 30, true, 5, ARRAY['DE', 'UK', 'FR', 'IT', 'ES'], 'manual'),
  ('awin', 'AboutYou', 'aboutyou', 'fashion', 8.00, 15.00, 30, true, 5, ARRAY['DE'], 'manual'),
  ('awin', 'ASOS', 'asos', 'fashion', 5.00, 10.00, 45, true, 5, ARRAY['UK', 'DE', 'FR'], 'manual'),
  ('awin', 'H&M', 'hm', 'fashion', 4.00, 8.00, 30, true, 4, ARRAY['DE', 'UK', 'FR'], 'manual'),
  ('ltk', 'Zara', 'zara', 'fashion', 5.00, 10.00, 30, true, 4, ARRAY['DE', 'UK', 'US'], 'manual'),
  ('shareasale', 'Nordstrom', 'nordstrom', 'fashion', 2.00, 11.00, 14, true, 4, ARRAY['US'], 'manual'),

  -- Beauty (better than Amazon's 1-3%)
  ('awin', 'Sephora', 'sephora', 'beauty', 5.00, 10.00, 30, true, 5, ARRAY['DE', 'FR', 'UK'], 'manual'),
  ('awin', 'Douglas', 'douglas', 'beauty', 6.00, 12.00, 30, true, 5, ARRAY['DE'], 'manual'),
  ('awin', 'Flaconi', 'flaconi', 'beauty', 8.00, 15.00, 30, true, 5, ARRAY['DE'], 'manual'),
  ('shareasale', 'Ulta Beauty', 'ulta', 'beauty', 2.00, 5.00, 30, true, 4, ARRAY['US'], 'manual'),
  ('direct', 'Charlotte Tilbury', 'charlottetilbury', 'beauty', 8.00, 12.00, 30, true, 4, ARRAY['UK', 'US'], 'manual'),

  -- Home & Furniture (better than Amazon's 3%)
  ('awin', 'IKEA', 'ikea', 'home', 3.00, 7.00, 30, true, 4, ARRAY['DE', 'UK', 'FR'], 'manual'),
  ('awin', 'Wayfair', 'wayfair', 'home', 5.00, 10.00, 7, true, 4, ARRAY['DE', 'UK', 'US'], 'manual'),
  ('awin', 'Westwing', 'westwing', 'home', 6.00, 12.00, 30, true, 5, ARRAY['DE'], 'manual'),

  -- Sports (better than Amazon's 3%)
  ('awin', 'Nike', 'nike', 'sports', 5.00, 11.00, 30, true, 5, ARRAY['DE', 'UK', 'FR', 'US'], 'manual'),
  ('awin', 'Adidas', 'adidas', 'sports', 5.00, 10.00, 30, true, 5, ARRAY['DE', 'UK', 'FR'], 'manual'),
  ('awin', 'Under Armour', 'underarmour', 'sports', 5.00, 8.00, 30, true, 4, ARRAY['DE', 'UK', 'US'], 'manual'),

  -- SaaS / Software (much better than Amazon)
  ('partnerstack', 'Shopify', 'shopify', 'software', 20.00, 30.00, 30, true, 5, ARRAY['US', 'UK', 'DE'], 'manual'),
  ('partnerstack', 'HubSpot', 'hubspot', 'software', 15.00, 30.00, 90, true, 5, ARRAY['US', 'UK', 'DE'], 'manual'),
  ('impact', 'Canva', 'canva', 'software', 25.00, 40.00, 30, true, 4, ARRAY['US', 'UK', 'DE'], 'manual'),
  ('direct', 'Notion', 'notion', 'software', 50.00, 50.00, 90, true, 4, ARRAY['US', 'UK', 'DE'], 'manual')

ON CONFLICT (network, brand_slug) DO UPDATE SET
  commission_rate_low = EXCLUDED.commission_rate_low,
  commission_rate_high = EXCLUDED.commission_rate_high,
  cookie_duration = EXCLUDED.cookie_duration,
  updated_at = NOW();


-- ============================================================
-- 7. SEED DATA: Brand Aliases
-- ============================================================

INSERT INTO brand_aliases (brand_slug, alias, alias_type) VALUES
  -- Sony
  ('sony', 'sony', 'name'),
  ('sony', 'sony electronics', 'name'),
  ('sony', 'sony.com', 'domain'),
  ('sony', 'sony.de', 'domain'),

  -- Samsung
  ('samsung', 'samsung', 'name'),
  ('samsung', 'samsung electronics', 'name'),
  ('samsung', 'samsung.com', 'domain'),

  -- Nike
  ('nike', 'nike', 'name'),
  ('nike', 'nike inc', 'name'),
  ('nike', 'nike.com', 'domain'),
  ('nike', 'nike.de', 'domain'),

  -- Adidas
  ('adidas', 'adidas', 'name'),
  ('adidas', 'adidas originals', 'name'),
  ('adidas', 'adidas.com', 'domain'),
  ('adidas', 'adidas.de', 'domain'),

  -- Zalando
  ('zalando', 'zalando', 'name'),
  ('zalando', 'zalando.de', 'domain'),
  ('zalando', 'zalando.com', 'domain'),

  -- IKEA
  ('ikea', 'ikea', 'name'),
  ('ikea', 'ikea.com', 'domain'),
  ('ikea', 'ikea.de', 'domain')

ON CONFLICT (alias) DO NOTHING;


-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
  program_count INTEGER;
  alias_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO program_count FROM affiliate_programs;
  SELECT COUNT(*) INTO alias_count FROM brand_aliases;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'COMMISSION AGENT SCHEMA - SETUP COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '  - affiliate_programs      (% programs)', program_count;
  RAISE NOTICE '  - brand_aliases           (% aliases)', alias_count;
  RAISE NOTICE '  - link_analyses           (user analysis history)';
  RAISE NOTICE '  - platform_commission_rates (Amazon rates)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Create /api/optimizer/analyze endpoint';
  RAISE NOTICE '============================================================';
END $$;
