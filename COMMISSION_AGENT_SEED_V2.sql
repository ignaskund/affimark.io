-- ============================================================
-- COMMISSION AGENT SEED V2
-- ============================================================
-- Expanded affiliate programs (100+), brand aliases, and
-- multi-platform commission rates.
-- Run AFTER COMMISSION_AGENT_SCHEMA.sql
-- ============================================================


-- ============================================================
-- 1. COMMISSION AGENT SESSIONS TABLE (NEW)
-- ============================================================

CREATE TABLE IF NOT EXISTS commission_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'batch',
  products_analyzed INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  total_potential_gain_low DECIMAL(10,2) DEFAULT 0,
  total_potential_gain_high DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user
  ON commission_agent_sessions(user_id, created_at DESC);

ALTER TABLE commission_agent_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own sessions') THEN
    CREATE POLICY "Users can view own sessions" ON commission_agent_sessions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own sessions') THEN
    CREATE POLICY "Users can insert own sessions" ON commission_agent_sessions
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access sessions') THEN
    CREATE POLICY "Service role full access sessions" ON commission_agent_sessions
      FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;


-- ============================================================
-- 2. ADD COLUMNS TO link_analyses (SAFE IF ALREADY EXIST)
-- ============================================================

ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  session_id UUID REFERENCES commission_agent_sessions(id);
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  action_steps JSONB;
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  cookie_comparison JSONB;
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  yearly_projection_low DECIMAL(10,2);
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  yearly_projection_high DECIMAL(10,2);


-- ============================================================
-- 3. EXPANDED AFFILIATE PROGRAMS (100+)
-- ============================================================
-- Rates are ranges based on publicly available program info.
-- confidence_score: 3 = public directory, 4 = verified, 5 = official
-- last_verified_at set to current date of seed.

INSERT INTO affiliate_programs (
  network, brand_name, brand_slug, category, subcategory,
  commission_type, commission_rate_low, commission_rate_high,
  cookie_duration, requires_application, approval_difficulty,
  regions, confidence_score, last_verified_at, source,
  signup_url
) VALUES

  -- ============================================================
  -- ELECTRONICS (20 programs)
  -- ============================================================
  ('awin', 'Sony', 'sony', 'electronics', 'audio',
   'cps', 3.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Samsung', 'samsung', 'electronics', 'smartphones',
   'cps', 2.00, 6.00, 30, true, 'medium',
   ARRAY['DE','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'MediaMarkt', 'mediamarkt', 'electronics', 'retail',
   'cps', 2.00, 5.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Saturn', 'saturn', 'electronics', 'retail',
   'cps', 2.00, 5.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Best Buy', 'bestbuy', 'electronics', 'retail',
   'cps', 1.00, 4.00, 7, true, 'medium',
   ARRAY['US'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Bose', 'bose', 'electronics', 'audio',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'JBL', 'jbl', 'electronics', 'audio',
   'cps', 3.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Dyson', 'dyson', 'electronics', 'home_appliances',
   'cps', 4.00, 8.00, 14, true, 'hard',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Philips', 'philips', 'electronics', 'home_appliances',
   'cps', 3.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Dell', 'dell', 'electronics', 'computers',
   'cps', 2.00, 6.00, 14, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('impact', 'HP', 'hp', 'electronics', 'computers',
   'cps', 2.00, 5.00, 14, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Lenovo', 'lenovo', 'electronics', 'computers',
   'cps', 2.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'LG', 'lg', 'electronics', 'displays',
   'cps', 2.00, 5.00, 30, true, 'medium',
   ARRAY['DE','UK'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Logitech', 'logitech', 'electronics', 'peripherals',
   'cps', 3.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('impact', 'Razer', 'razer', 'electronics', 'gaming',
   'cps', 3.00, 6.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Sennheiser', 'sennheiser', 'electronics', 'audio',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Panasonic', 'panasonic', 'electronics', 'cameras',
   'cps', 2.00, 5.00, 30, true, 'medium',
   ARRAY['DE','UK'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'GoPro', 'gopro', 'electronics', 'cameras',
   'cps', 3.00, 5.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Canon', 'canon', 'electronics', 'cameras',
   'cps', 2.00, 5.00, 30, true, 'medium',
   ARRAY['DE','UK'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Anker', 'anker', 'electronics', 'accessories',
   'cps', 3.00, 8.00, 30, true, 'easy',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),


  -- ============================================================
  -- FASHION (25 programs)
  -- ============================================================
  ('awin', 'Zalando', 'zalando', 'fashion', 'marketplace',
   'cps', 6.00, 12.00, 30, true, 'easy',
   ARRAY['DE','UK','FR','IT','ES'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'AboutYou', 'aboutyou', 'fashion', 'marketplace',
   'cps', 8.00, 15.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'ASOS', 'asos', 'fashion', 'marketplace',
   'cps', 5.00, 10.00, 45, true, 'easy',
   ARRAY['UK','DE','FR'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'H&M', 'hm', 'fashion', 'fast_fashion',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('ltk', 'Zara', 'zara', 'fashion', 'fast_fashion',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   NULL),

  ('shareasale', 'Nordstrom', 'nordstrom', 'fashion', 'department_store',
   'cps', 2.00, 11.00, 14, true, 'medium',
   ARRAY['US'], 4, NOW(), 'manual',
   'https://www.shareasale.com/newsignup.cfm'),

  ('awin', 'Nike', 'nike', 'fashion', 'sportswear',
   'cps', 5.00, 11.00, 30, true, 'medium',
   ARRAY['DE','UK','FR','US'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Adidas', 'adidas', 'fashion', 'sportswear',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Puma', 'puma', 'fashion', 'sportswear',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Lululemon', 'lululemon', 'fashion', 'activewear',
   'cps', 5.00, 10.00, 30, true, 'hard',
   ARRAY['US','UK'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Gymshark', 'gymshark', 'fashion', 'activewear',
   'cps', 6.00, 10.00, 30, true, 'medium',
   ARRAY['UK','US','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'NA-KD', 'nakd', 'fashion', 'fast_fashion',
   'cps', 8.00, 15.00, 30, true, 'easy',
   ARRAY['DE','UK','SE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Mango', 'mango', 'fashion', 'mid_range',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['DE','UK','FR','ES'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'COS', 'cos', 'fashion', 'mid_range',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', '& Other Stories', 'andotherstories', 'fashion', 'mid_range',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Uniqlo', 'uniqlo', 'fashion', 'basics',
   'cps', 3.00, 6.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Under Armour', 'underarmour', 'fashion', 'sportswear',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'The North Face', 'thenorthface', 'fashion', 'outdoor',
   'cps', 4.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'New Balance', 'newbalance', 'fashion', 'sportswear',
   'cps', 4.00, 8.00, 14, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Boohoo', 'boohoo', 'fashion', 'fast_fashion',
   'cps', 6.00, 10.00, 30, true, 'easy',
   ARRAY['UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('shareasale', 'Revolve', 'revolve', 'fashion', 'mid_range',
   'cps', 5.00, 10.00, 7, true, 'medium',
   ARRAY['US'], 4, NOW(), 'manual',
   'https://www.shareasale.com/newsignup.cfm'),

  ('impact', 'ASICS', 'asics', 'fashion', 'sportswear',
   'cps', 4.00, 7.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Converse', 'converse', 'fashion', 'sneakers',
   'cps', 4.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Vans', 'vans', 'fashion', 'sneakers',
   'cps', 4.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Tommy Hilfiger', 'tommyhilfiger', 'fashion', 'premium',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- BEAUTY (20 programs)
  -- ============================================================
  ('awin', 'Sephora', 'sephora', 'beauty', 'marketplace',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','FR','UK'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Douglas', 'douglas', 'beauty', 'marketplace',
   'cps', 6.00, 12.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Flaconi', 'flaconi', 'beauty', 'marketplace',
   'cps', 8.00, 15.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('shareasale', 'Ulta Beauty', 'ulta', 'beauty', 'marketplace',
   'cps', 2.00, 5.00, 30, true, 'medium',
   ARRAY['US'], 4, NOW(), 'manual',
   'https://www.shareasale.com/newsignup.cfm'),

  ('direct', 'Charlotte Tilbury', 'charlottetilbury', 'beauty', 'luxury',
   'cps', 8.00, 12.00, 30, true, 'hard',
   ARRAY['UK','US'], 4, NOW(), 'manual',
   NULL),

  ('awin', 'MAC Cosmetics', 'mac', 'beauty', 'makeup',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'NARS', 'nars', 'beauty', 'makeup',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('rakuten', 'Clinique', 'clinique', 'beauty', 'skincare',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['US','UK'], 4, NOW(), 'manual',
   'https://rakutenadvertising.com/publisher/'),

  ('rakuten', 'Estee Lauder', 'esteelauder', 'beauty', 'luxury',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['US','UK'], 4, NOW(), 'manual',
   'https://rakutenadvertising.com/publisher/'),

  ('impact', 'The Ordinary', 'theordinary', 'beauty', 'skincare',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'CeraVe', 'cerave', 'beauty', 'skincare',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Paula''s Choice', 'paulaschoice', 'beauty', 'skincare',
   'cps', 7.00, 12.00, 30, true, 'easy',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('impact', 'Glossier', 'glossier', 'beauty', 'skincare',
   'cps', 8.00, 12.00, 30, true, 'hard',
   ARRAY['US','UK'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Urban Decay', 'urbandecay', 'beauty', 'makeup',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['UK','US','DE'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Too Faced', 'toofaced', 'beauty', 'makeup',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Benefit Cosmetics', 'benefit', 'beauty', 'makeup',
   'cps', 4.00, 8.00, 30, true, 'medium',
   ARRAY['UK','US','DE'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Fenty Beauty', 'fentybeauty', 'beauty', 'makeup',
   'cps', 5.00, 10.00, 30, true, 'hard',
   ARRAY['US','UK'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Lookfantastic', 'lookfantastic', 'beauty', 'marketplace',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['UK','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Notino', 'notino', 'beauty', 'marketplace',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['DE','FR','IT'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'NYX Professional', 'nyx', 'beauty', 'makeup',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- HOME & FURNITURE (10 programs)
  -- ============================================================
  ('awin', 'IKEA', 'ikea', 'home', 'furniture',
   'cps', 3.00, 7.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Wayfair', 'wayfair', 'home', 'furniture',
   'cps', 5.00, 10.00, 7, true, 'easy',
   ARRAY['DE','UK','US'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Westwing', 'westwing', 'home', 'furniture',
   'cps', 6.00, 12.00, 30, true, 'easy',
   ARRAY['DE'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'H&M Home', 'hmhome', 'home', 'decor',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Zara Home', 'zarahome', 'home', 'decor',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','UK','FR','ES'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'West Elm', 'westelm', 'home', 'furniture',
   'cps', 3.00, 7.00, 14, true, 'medium',
   ARRAY['US'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Made.com', 'madecom', 'home', 'furniture',
   'cps', 5.00, 8.00, 30, true, 'easy',
   ARRAY['UK','DE','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Article', 'article', 'home', 'furniture',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['US'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Lampenwelt', 'lampenwelt', 'home', 'lighting',
   'cps', 6.00, 10.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Home24', 'home24', 'home', 'furniture',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- SPORTS & OUTDOOR (8 programs, some overlap with fashion)
  -- ============================================================
  ('awin', 'Patagonia', 'patagonia', 'sports', 'outdoor',
   'cps', 5.00, 8.00, 30, true, 'hard',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Columbia', 'columbia', 'sports', 'outdoor',
   'cps', 4.00, 7.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Salomon', 'salomon', 'sports', 'outdoor',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','FR'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Garmin', 'garmin', 'sports', 'fitness',
   'cps', 3.00, 6.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('impact', 'Fitbit', 'fitbit', 'sports', 'fitness',
   'cps', 3.00, 5.00, 14, true, 'medium',
   ARRAY['US','UK'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Decathlon', 'decathlon', 'sports', 'retail',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','FR','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Bergfreunde', 'bergfreunde', 'sports', 'outdoor',
   'cps', 6.00, 10.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Sportscheck', 'sportscheck', 'sports', 'retail',
   'cps', 5.00, 8.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- SOFTWARE / SAAS (8 programs)
  -- ============================================================
  ('partnerstack', 'Shopify', 'shopify', 'software', 'ecommerce',
   'cps', 20.00, 30.00, 30, true, 'medium',
   ARRAY['US','UK','DE'], 5, NOW(), 'manual',
   'https://partnerstack.com/'),

  ('partnerstack', 'HubSpot', 'hubspot', 'software', 'crm',
   'cps', 15.00, 30.00, 90, true, 'medium',
   ARRAY['US','UK','DE'], 5, NOW(), 'manual',
   'https://partnerstack.com/'),

  ('impact', 'Canva', 'canva', 'software', 'design',
   'cps', 25.00, 40.00, 30, true, 'easy',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('direct', 'Notion', 'notion', 'software', 'productivity',
   'cps', 50.00, 50.00, 90, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   NULL),

  ('impact', 'SEMrush', 'semrush', 'software', 'seo',
   'cps', 20.00, 40.00, 120, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('partnerstack', 'ConvertKit', 'convertkit', 'software', 'email',
   'cps', 30.00, 30.00, 60, true, 'easy',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://partnerstack.com/'),

  ('impact', 'Teachable', 'teachable', 'software', 'education',
   'cps', 20.00, 30.00, 90, true, 'easy',
   ARRAY['US','UK'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('partnerstack', 'Ahrefs', 'ahrefs', 'software', 'seo',
   'cps', 15.00, 20.00, 60, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://partnerstack.com/'),


  -- ============================================================
  -- TRAVEL (6 programs)
  -- ============================================================
  ('awin', 'Booking.com', 'bookingcom', 'travel', 'hotels',
   'cps', 25.00, 40.00, 30, true, 'easy',
   ARRAY['DE','UK','FR','US'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Expedia', 'expedia', 'travel', 'hotels',
   'cps', 3.00, 6.00, 7, true, 'medium',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'Airbnb', 'airbnb', 'travel', 'accommodation',
   'cps', 3.00, 5.00, 30, true, 'hard',
   ARRAY['US','UK','DE'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'GetYourGuide', 'getyourguide', 'travel', 'activities',
   'cps', 8.00, 12.00, 30, true, 'easy',
   ARRAY['DE','UK','FR'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Skyscanner', 'skyscanner', 'travel', 'flights',
   'cpa', 0.50, 1.50, 30, true, 'easy',
   ARRAY['UK','DE','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Omio', 'omio', 'travel', 'transport',
   'cps', 4.00, 8.00, 30, true, 'easy',
   ARRAY['DE','UK','FR'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- FOOD & GROCERY (4 programs)
  -- ============================================================
  ('awin', 'HelloFresh', 'hellofresh', 'food', 'meal_kits',
   'cpa', 10.00, 20.00, 14, true, 'easy',
   ARRAY['DE','UK','US'], 5, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Foodspring', 'foodspring', 'food', 'supplements',
   'cps', 8.00, 15.00, 30, true, 'easy',
   ARRAY['DE','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('impact', 'iHerb', 'iherb', 'food', 'supplements',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['US','UK','DE'], 4, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'KoRo', 'koro', 'food', 'health_food',
   'cps', 8.00, 12.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- KIDS & BABY (5 programs)
  -- ============================================================
  ('awin', 'Vertbaudet', 'vertbaudet', 'kids', 'clothing',
   'cps', 6.00, 10.00, 30, true, 'easy',
   ARRAY['DE','FR','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'BabyBjorn', 'babybjorn', 'kids', 'gear',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['DE','UK','US'], 3, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('direct', 'Stokke', 'stokke', 'kids', 'furniture',
   'cps', 4.00, 8.00, 30, true, 'hard',
   ARRAY['DE','UK'], 3, NOW(), 'manual',
   NULL),

  ('awin', 'Windeln.de', 'windelnde', 'kids', 'essentials',
   'cps', 5.00, 8.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Baby-Walz', 'babywalz', 'kids', 'retail',
   'cps', 5.00, 10.00, 30, true, 'easy',
   ARRAY['DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),


  -- ============================================================
  -- LUXURY (6 programs)
  -- ============================================================
  ('rakuten', 'Net-a-Porter', 'netaporter', 'luxury', 'fashion',
   'cps', 5.00, 10.00, 14, true, 'hard',
   ARRAY['UK','US','DE'], 4, NOW(), 'manual',
   'https://rakutenadvertising.com/publisher/'),

  ('awin', 'Farfetch', 'farfetch', 'luxury', 'fashion',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['UK','US','DE'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('awin', 'Mytheresa', 'mytheresa', 'luxury', 'fashion',
   'cps', 5.00, 10.00, 30, true, 'medium',
   ARRAY['DE','UK'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers'),

  ('rakuten', 'Matchesfashion', 'matchesfashion', 'luxury', 'fashion',
   'cps', 5.00, 10.00, 14, true, 'medium',
   ARRAY['UK','US'], 3, NOW(), 'manual',
   'https://rakutenadvertising.com/publisher/'),

  ('impact', 'SSENSE', 'ssense', 'luxury', 'fashion',
   'cps', 5.00, 8.00, 30, true, 'medium',
   ARRAY['US','UK'], 3, NOW(), 'manual',
   'https://impact.com/partnerships/'),

  ('awin', 'Luisaviaroma', 'luisaviaroma', 'luxury', 'fashion',
   'cps', 6.00, 12.00, 30, true, 'medium',
   ARRAY['DE','UK','IT'], 4, NOW(), 'manual',
   'https://www.awin.com/gb/publishers')

ON CONFLICT (network, brand_slug) DO UPDATE SET
  commission_rate_low = EXCLUDED.commission_rate_low,
  commission_rate_high = EXCLUDED.commission_rate_high,
  cookie_duration = EXCLUDED.cookie_duration,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  approval_difficulty = EXCLUDED.approval_difficulty,
  regions = EXCLUDED.regions,
  confidence_score = EXCLUDED.confidence_score,
  last_verified_at = EXCLUDED.last_verified_at,
  signup_url = EXCLUDED.signup_url,
  updated_at = NOW();


-- ============================================================
-- 4. EXPANDED BRAND ALIASES
-- ============================================================

INSERT INTO brand_aliases (brand_slug, alias, alias_type) VALUES
  -- Electronics
  ('sony', 'sony', 'name'),
  ('sony', 'sony.com', 'domain'),
  ('sony', 'sony.de', 'domain'),
  ('sony', 'sony.co.uk', 'domain'),
  ('sony', 'store.sony.com', 'domain'),
  ('sony', 'sony electronics', 'name'),
  ('samsung', 'samsung', 'name'),
  ('samsung', 'samsung.com', 'domain'),
  ('samsung', 'samsung.de', 'domain'),
  ('samsung', 'samsung electronics', 'name'),
  ('samsung', 'samsung galaxy', 'name'),
  ('mediamarkt', 'mediamarkt', 'name'),
  ('mediamarkt', 'mediamarkt.de', 'domain'),
  ('mediamarkt', 'media markt', 'name'),
  ('saturn', 'saturn', 'name'),
  ('saturn', 'saturn.de', 'domain'),
  ('bestbuy', 'best buy', 'name'),
  ('bestbuy', 'bestbuy.com', 'domain'),
  ('bose', 'bose', 'name'),
  ('bose', 'bose.com', 'domain'),
  ('bose', 'bose.de', 'domain'),
  ('jbl', 'jbl', 'name'),
  ('jbl', 'jbl.com', 'domain'),
  ('dyson', 'dyson', 'name'),
  ('dyson', 'dyson.com', 'domain'),
  ('dyson', 'dyson.de', 'domain'),
  ('dyson', 'dyson.co.uk', 'domain'),
  ('philips', 'philips', 'name'),
  ('philips', 'philips.com', 'domain'),
  ('philips', 'philips.de', 'domain'),
  ('dell', 'dell', 'name'),
  ('dell', 'dell.com', 'domain'),
  ('dell', 'dell.de', 'domain'),
  ('hp', 'hp', 'name'),
  ('hp', 'hp.com', 'domain'),
  ('hp', 'hewlett packard', 'name'),
  ('lenovo', 'lenovo', 'name'),
  ('lenovo', 'lenovo.com', 'domain'),
  ('lg', 'lg', 'name'),
  ('lg', 'lg.com', 'domain'),
  ('logitech', 'logitech', 'name'),
  ('logitech', 'logitech.com', 'domain'),
  ('logitech', 'logitechg.com', 'domain'),
  ('razer', 'razer', 'name'),
  ('razer', 'razer.com', 'domain'),
  ('sennheiser', 'sennheiser', 'name'),
  ('sennheiser', 'sennheiser.com', 'domain'),
  ('panasonic', 'panasonic', 'name'),
  ('panasonic', 'panasonic.com', 'domain'),
  ('gopro', 'gopro', 'name'),
  ('gopro', 'gopro.com', 'domain'),
  ('gopro', 'go pro', 'name'),
  ('canon', 'canon', 'name'),
  ('canon', 'canon.com', 'domain'),
  ('canon', 'canon.de', 'domain'),
  ('anker', 'anker', 'name'),
  ('anker', 'anker.com', 'domain'),
  ('anker', 'ankertechnology', 'name'),

  -- Fashion
  ('zalando', 'zalando', 'name'),
  ('zalando', 'zalando.de', 'domain'),
  ('zalando', 'zalando.com', 'domain'),
  ('zalando', 'zalando.co.uk', 'domain'),
  ('zalando', 'zalando.fr', 'domain'),
  ('aboutyou', 'about you', 'name'),
  ('aboutyou', 'aboutyou', 'name'),
  ('aboutyou', 'aboutyou.de', 'domain'),
  ('asos', 'asos', 'name'),
  ('asos', 'asos.com', 'domain'),
  ('asos', 'asos.de', 'domain'),
  ('hm', 'h&m', 'name'),
  ('hm', 'hm', 'name'),
  ('hm', 'hm.com', 'domain'),
  ('hm', 'www2.hm.com', 'domain'),
  ('hm', 'h and m', 'name'),
  ('zara', 'zara', 'name'),
  ('zara', 'zara.com', 'domain'),
  ('zara', 'zara.de', 'domain'),
  ('nordstrom', 'nordstrom', 'name'),
  ('nordstrom', 'nordstrom.com', 'domain'),
  ('nike', 'nike', 'name'),
  ('nike', 'nike.com', 'domain'),
  ('nike', 'nike.de', 'domain'),
  ('nike', 'nike inc', 'name'),
  ('adidas', 'adidas', 'name'),
  ('adidas', 'adidas.com', 'domain'),
  ('adidas', 'adidas.de', 'domain'),
  ('adidas', 'adidas originals', 'name'),
  ('puma', 'puma', 'name'),
  ('puma', 'puma.com', 'domain'),
  ('lululemon', 'lululemon', 'name'),
  ('lululemon', 'lululemon.com', 'domain'),
  ('lululemon', 'lulu lemon', 'name'),
  ('gymshark', 'gymshark', 'name'),
  ('gymshark', 'gymshark.com', 'domain'),
  ('nakd', 'na-kd', 'name'),
  ('nakd', 'nakd', 'name'),
  ('nakd', 'nakd.com', 'domain'),
  ('mango', 'mango', 'name'),
  ('mango', 'mango.com', 'domain'),
  ('cos', 'cos', 'name'),
  ('cos', 'cos.com', 'domain'),
  ('cos', 'cosstores.com', 'domain'),
  ('andotherstories', '& other stories', 'name'),
  ('andotherstories', 'other stories', 'name'),
  ('andotherstories', 'stories.com', 'domain'),
  ('uniqlo', 'uniqlo', 'name'),
  ('uniqlo', 'uniqlo.com', 'domain'),
  ('underarmour', 'under armour', 'name'),
  ('underarmour', 'underarmour.com', 'domain'),
  ('underarmour', 'underarmour.de', 'domain'),
  ('thenorthface', 'the north face', 'name'),
  ('thenorthface', 'thenorthface.com', 'domain'),
  ('thenorthface', 'north face', 'name'),
  ('newbalance', 'new balance', 'name'),
  ('newbalance', 'newbalance.com', 'domain'),
  ('newbalance', 'newbalance.de', 'domain'),
  ('boohoo', 'boohoo', 'name'),
  ('boohoo', 'boohoo.com', 'domain'),
  ('revolve', 'revolve', 'name'),
  ('revolve', 'revolve.com', 'domain'),
  ('asics', 'asics', 'name'),
  ('asics', 'asics.com', 'domain'),
  ('converse', 'converse', 'name'),
  ('converse', 'converse.com', 'domain'),
  ('vans', 'vans', 'name'),
  ('vans', 'vans.com', 'domain'),
  ('tommyhilfiger', 'tommy hilfiger', 'name'),
  ('tommyhilfiger', 'tommy.com', 'domain'),
  ('tommyhilfiger', 'tommyhilfiger.com', 'domain'),

  -- Beauty
  ('sephora', 'sephora', 'name'),
  ('sephora', 'sephora.com', 'domain'),
  ('sephora', 'sephora.de', 'domain'),
  ('sephora', 'sephora.fr', 'domain'),
  ('douglas', 'douglas', 'name'),
  ('douglas', 'douglas.de', 'domain'),
  ('douglas', 'douglas.com', 'domain'),
  ('flaconi', 'flaconi', 'name'),
  ('flaconi', 'flaconi.de', 'domain'),
  ('ulta', 'ulta', 'name'),
  ('ulta', 'ulta.com', 'domain'),
  ('ulta', 'ulta beauty', 'name'),
  ('charlottetilbury', 'charlotte tilbury', 'name'),
  ('charlottetilbury', 'charlottetilbury.com', 'domain'),
  ('mac', 'mac cosmetics', 'name'),
  ('mac', 'mac', 'name'),
  ('mac', 'maccosmetics.com', 'domain'),
  ('nars', 'nars', 'name'),
  ('nars', 'narscosmetics.com', 'domain'),
  ('clinique', 'clinique', 'name'),
  ('clinique', 'clinique.com', 'domain'),
  ('esteelauder', 'estee lauder', 'name'),
  ('esteelauder', 'esteelauder.com', 'domain'),
  ('theordinary', 'the ordinary', 'name'),
  ('theordinary', 'theordinary.com', 'domain'),
  ('cerave', 'cerave', 'name'),
  ('cerave', 'cerave.com', 'domain'),
  ('paulaschoice', 'paulas choice', 'name'),
  ('paulaschoice', 'paula''s choice', 'name'),
  ('paulaschoice', 'paulaschoice.com', 'domain'),
  ('glossier', 'glossier', 'name'),
  ('glossier', 'glossier.com', 'domain'),
  ('urbandecay', 'urban decay', 'name'),
  ('urbandecay', 'urbandecay.com', 'domain'),
  ('toofaced', 'too faced', 'name'),
  ('toofaced', 'toofaced.com', 'domain'),
  ('benefit', 'benefit cosmetics', 'name'),
  ('benefit', 'benefit', 'name'),
  ('benefit', 'benefitcosmetics.com', 'domain'),
  ('fentybeauty', 'fenty beauty', 'name'),
  ('fentybeauty', 'fentybeauty.com', 'domain'),
  ('lookfantastic', 'lookfantastic', 'name'),
  ('lookfantastic', 'lookfantastic.com', 'domain'),
  ('lookfantastic', 'lookfantastic.de', 'domain'),
  ('notino', 'notino', 'name'),
  ('notino', 'notino.de', 'domain'),
  ('notino', 'notino.com', 'domain'),
  ('nyx', 'nyx', 'name'),
  ('nyx', 'nyx professional', 'name'),
  ('nyx', 'nyxcosmetics.com', 'domain'),

  -- Home
  ('ikea', 'ikea', 'name'),
  ('ikea', 'ikea.com', 'domain'),
  ('ikea', 'ikea.de', 'domain'),
  ('wayfair', 'wayfair', 'name'),
  ('wayfair', 'wayfair.com', 'domain'),
  ('wayfair', 'wayfair.de', 'domain'),
  ('westwing', 'westwing', 'name'),
  ('westwing', 'westwing.de', 'domain'),
  ('hmhome', 'h&m home', 'name'),
  ('hmhome', 'hm home', 'name'),
  ('zarahome', 'zara home', 'name'),
  ('zarahome', 'zarahome.com', 'domain'),
  ('westelm', 'west elm', 'name'),
  ('westelm', 'westelm.com', 'domain'),
  ('madecom', 'made.com', 'domain'),
  ('madecom', 'made', 'name'),
  ('article', 'article', 'name'),
  ('article', 'article.com', 'domain'),
  ('home24', 'home24', 'name'),
  ('home24', 'home24.de', 'domain'),

  -- Sports
  ('patagonia', 'patagonia', 'name'),
  ('patagonia', 'patagonia.com', 'domain'),
  ('columbia', 'columbia', 'name'),
  ('columbia', 'columbia.com', 'domain'),
  ('columbia', 'columbia sportswear', 'name'),
  ('salomon', 'salomon', 'name'),
  ('salomon', 'salomon.com', 'domain'),
  ('garmin', 'garmin', 'name'),
  ('garmin', 'garmin.com', 'domain'),
  ('fitbit', 'fitbit', 'name'),
  ('fitbit', 'fitbit.com', 'domain'),
  ('decathlon', 'decathlon', 'name'),
  ('decathlon', 'decathlon.de', 'domain'),
  ('decathlon', 'decathlon.com', 'domain'),

  -- Software
  ('shopify', 'shopify', 'name'),
  ('shopify', 'shopify.com', 'domain'),
  ('hubspot', 'hubspot', 'name'),
  ('hubspot', 'hubspot.com', 'domain'),
  ('canva', 'canva', 'name'),
  ('canva', 'canva.com', 'domain'),
  ('notion', 'notion', 'name'),
  ('notion', 'notion.so', 'domain'),
  ('semrush', 'semrush', 'name'),
  ('semrush', 'semrush.com', 'domain'),
  ('convertkit', 'convertkit', 'name'),
  ('convertkit', 'convertkit.com', 'domain'),
  ('ahrefs', 'ahrefs', 'name'),
  ('ahrefs', 'ahrefs.com', 'domain'),

  -- Travel
  ('bookingcom', 'booking.com', 'domain'),
  ('bookingcom', 'booking', 'name'),
  ('expedia', 'expedia', 'name'),
  ('expedia', 'expedia.com', 'domain'),
  ('expedia', 'expedia.de', 'domain'),
  ('airbnb', 'airbnb', 'name'),
  ('airbnb', 'airbnb.com', 'domain'),
  ('getyourguide', 'getyourguide', 'name'),
  ('getyourguide', 'getyourguide.com', 'domain'),
  ('getyourguide', 'get your guide', 'name'),
  ('skyscanner', 'skyscanner', 'name'),
  ('skyscanner', 'skyscanner.com', 'domain'),
  ('omio', 'omio', 'name'),
  ('omio', 'omio.com', 'domain'),

  -- Food
  ('hellofresh', 'hellofresh', 'name'),
  ('hellofresh', 'hellofresh.com', 'domain'),
  ('hellofresh', 'hellofresh.de', 'domain'),
  ('hellofresh', 'hello fresh', 'name'),
  ('koro', 'koro', 'name'),
  ('koro', 'korodrogerie.de', 'domain'),

  -- Kids
  ('vertbaudet', 'vertbaudet', 'name'),
  ('vertbaudet', 'vertbaudet.de', 'domain'),
  ('babybjorn', 'babybjorn', 'name'),
  ('babybjorn', 'babybjorn.com', 'domain'),
  ('babybjorn', 'baby bjorn', 'name'),
  ('stokke', 'stokke', 'name'),
  ('stokke', 'stokke.com', 'domain'),

  -- Luxury
  ('netaporter', 'net-a-porter', 'name'),
  ('netaporter', 'net a porter', 'name'),
  ('netaporter', 'netaporter.com', 'domain'),
  ('farfetch', 'farfetch', 'name'),
  ('farfetch', 'farfetch.com', 'domain'),
  ('mytheresa', 'mytheresa', 'name'),
  ('mytheresa', 'mytheresa.com', 'domain'),
  ('matchesfashion', 'matchesfashion', 'name'),
  ('matchesfashion', 'matchesfashion.com', 'domain'),
  ('matchesfashion', 'matches fashion', 'name'),
  ('ssense', 'ssense', 'name'),
  ('ssense', 'ssense.com', 'domain'),
  ('luisaviaroma', 'luisaviaroma', 'name'),
  ('luisaviaroma', 'luisaviaroma.com', 'domain')

ON CONFLICT (alias) DO NOTHING;


-- ============================================================
-- 5. EXPANDED PLATFORM COMMISSION RATES
-- ============================================================

INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  -- Amazon UK
  ('amazon_uk', 'amazon_games', 20.00, 'official'),
  ('amazon_uk', 'luxury_beauty', 10.00, 'official'),
  ('amazon_uk', 'luxury_stores', 10.00, 'official'),
  ('amazon_uk', 'digital_music', 5.00, 'official'),
  ('amazon_uk', 'handmade', 5.00, 'official'),
  ('amazon_uk', 'kindle', 4.50, 'official'),
  ('amazon_uk', 'fashion', 4.00, 'official'),
  ('amazon_uk', 'home_garden', 4.00, 'official'),
  ('amazon_uk', 'furniture', 3.00, 'official'),
  ('amazon_uk', 'toys', 3.00, 'official'),
  ('amazon_uk', 'sports', 3.00, 'official'),
  ('amazon_uk', 'books', 3.00, 'official'),
  ('amazon_uk', 'beauty', 3.00, 'official'),
  ('amazon_uk', 'baby', 3.00, 'official'),
  ('amazon_uk', 'kitchen', 3.00, 'official'),
  ('amazon_uk', 'electronics', 1.00, 'official'),
  ('amazon_uk', 'computers', 1.00, 'official'),
  ('amazon_uk', 'video_games', 1.00, 'official'),
  ('amazon_uk', 'health', 1.00, 'official'),
  ('amazon_uk', 'default', 3.00, 'official'),

  -- Amazon US
  ('amazon_us', 'amazon_games', 20.00, 'official'),
  ('amazon_us', 'luxury_beauty', 10.00, 'official'),
  ('amazon_us', 'luxury_stores', 10.00, 'official'),
  ('amazon_us', 'digital_music', 5.00, 'official'),
  ('amazon_us', 'handmade', 5.00, 'official'),
  ('amazon_us', 'kindle', 4.50, 'official'),
  ('amazon_us', 'fashion', 4.00, 'official'),
  ('amazon_us', 'home_garden', 4.00, 'official'),
  ('amazon_us', 'furniture', 3.00, 'official'),
  ('amazon_us', 'toys', 3.00, 'official'),
  ('amazon_us', 'sports', 3.00, 'official'),
  ('amazon_us', 'books', 3.00, 'official'),
  ('amazon_us', 'beauty', 3.00, 'official'),
  ('amazon_us', 'baby', 3.00, 'official'),
  ('amazon_us', 'kitchen', 3.00, 'official'),
  ('amazon_us', 'electronics', 1.00, 'official'),
  ('amazon_us', 'computers', 1.00, 'official'),
  ('amazon_us', 'video_games', 1.00, 'official'),
  ('amazon_us', 'health', 1.00, 'official'),
  ('amazon_us', 'default', 3.00, 'official'),

  -- Amazon FR
  ('amazon_fr', 'amazon_games', 20.00, 'official'),
  ('amazon_fr', 'luxury_beauty', 10.00, 'official'),
  ('amazon_fr', 'fashion', 4.00, 'official'),
  ('amazon_fr', 'home_garden', 4.00, 'official'),
  ('amazon_fr', 'furniture', 3.00, 'official'),
  ('amazon_fr', 'toys', 3.00, 'official'),
  ('amazon_fr', 'sports', 3.00, 'official'),
  ('amazon_fr', 'beauty', 3.00, 'official'),
  ('amazon_fr', 'electronics', 1.00, 'official'),
  ('amazon_fr', 'default', 3.00, 'official'),

  -- Amazon IT
  ('amazon_it', 'fashion', 4.00, 'official'),
  ('amazon_it', 'home_garden', 4.00, 'official'),
  ('amazon_it', 'beauty', 3.00, 'official'),
  ('amazon_it', 'electronics', 1.00, 'official'),
  ('amazon_it', 'default', 3.00, 'official'),

  -- Amazon ES
  ('amazon_es', 'fashion', 4.00, 'official'),
  ('amazon_es', 'home_garden', 4.00, 'official'),
  ('amazon_es', 'beauty', 3.00, 'official'),
  ('amazon_es', 'electronics', 1.00, 'official'),
  ('amazon_es', 'default', 3.00, 'official'),

  -- LTK estimated rates
  ('ltk', 'fashion', 10.00, 'manual'),
  ('ltk', 'beauty', 12.00, 'manual'),
  ('ltk', 'home', 8.00, 'manual'),
  ('ltk', 'luxury', 8.00, 'manual'),
  ('ltk', 'kids', 8.00, 'manual'),
  ('ltk', 'default', 10.00, 'manual')

ON CONFLICT (platform, category) DO UPDATE SET
  commission_rate = EXCLUDED.commission_rate,
  last_updated_at = NOW();


-- ============================================================
-- VERIFICATION
-- ============================================================

DO $$
DECLARE
  program_count INTEGER;
  alias_count INTEGER;
  rate_count INTEGER;
  session_table_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO program_count FROM affiliate_programs;
  SELECT COUNT(*) INTO alias_count FROM brand_aliases;
  SELECT COUNT(*) INTO rate_count FROM platform_commission_rates;
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name = 'commission_agent_sessions'
  ) INTO session_table_exists;

  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'COMMISSION AGENT SEED V2 - COMPLETE';
  RAISE NOTICE '============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Data summary:';
  RAISE NOTICE '  - affiliate_programs:       % programs', program_count;
  RAISE NOTICE '  - brand_aliases:            % aliases', alias_count;
  RAISE NOTICE '  - platform_commission_rates: % rates', rate_count;
  RAISE NOTICE '  - commission_agent_sessions: %', CASE WHEN session_table_exists THEN 'CREATED' ELSE 'MISSING' END;
  RAISE NOTICE '  - link_analyses columns:    ADDED (session_id, action_steps, cookie_comparison, yearly_projection)';
  RAISE NOTICE '';
  RAISE NOTICE '============================================================';
END $$;
