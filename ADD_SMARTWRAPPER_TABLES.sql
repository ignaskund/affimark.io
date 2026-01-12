-- ========================================
-- Add SmartWrapper Tables
-- Run this after V2_MIGRATION
-- ========================================

-- SmartWrapper Links (already exists in schema, but ensuring it's there)
CREATE TABLE IF NOT EXISTS smartwrappers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  short_code TEXT UNIQUE NOT NULL,
  name TEXT,
  destination_url TEXT NOT NULL,
  affiliate_tag TEXT,
  fallback_url TEXT,
  fallback_type TEXT, -- 'search', 'category', 'custom'
  fallback_active BOOLEAN DEFAULT false,
  auto_fallback_enabled BOOLEAN DEFAULT false,
  click_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  redirect_chain_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE smartwrappers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own smartwrappers"
  ON smartwrappers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own smartwrappers"
  ON smartwrappers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smartwrappers"
  ON smartwrappers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own smartwrappers"
  ON smartwrappers FOR DELETE
  USING (auth.uid() = user_id);

-- SmartWrapper Click Tracking
CREATE TABLE IF NOT EXISTS smartwrapper_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartwrapper_id UUID NOT NULL REFERENCES smartwrappers(id) ON DELETE CASCADE,
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  device_type TEXT, -- 'mobile', 'tablet', 'desktop'
  country TEXT,
  referrer TEXT,
  is_in_app_browser BOOLEAN DEFAULT false,
  redirect_url TEXT NOT NULL
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_smartwrapper_clicks_smartwrapper_id
  ON smartwrapper_clicks(smartwrapper_id, clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_smartwrappers_short_code
  ON smartwrappers(short_code) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_smartwrappers_user_id
  ON smartwrappers(user_id, created_at DESC);

-- Tracked Products (for link health monitoring)
CREATE TABLE IF NOT EXISTS tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  smartwrapper_id UUID REFERENCES smartwrappers(id) ON DELETE SET NULL,
  product_url TEXT NOT NULL,
  product_name TEXT,
  platform TEXT,
  asin TEXT,
  current_price DECIMAL(10,2),
  stock_status TEXT DEFAULT 'unknown', -- 'in_stock', 'out_of_stock', 'unknown'
  health_status TEXT DEFAULT 'healthy', -- 'healthy', 'warning', 'broken'
  last_checked TIMESTAMPTZ,
  last_healthy_at TIMESTAMPTZ DEFAULT NOW(),
  alert_enabled BOOLEAN DEFAULT true,
  fallback_search_url TEXT,
  auto_fallback_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tracked products"
  ON tracked_products FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tracked products"
  ON tracked_products FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracked products"
  ON tracked_products FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracked products"
  ON tracked_products FOR DELETE
  USING (auth.uid() = user_id);

-- Revenue Loss Ledger
CREATE TABLE IF NOT EXISTS revenue_loss_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tracked_product_id UUID REFERENCES tracked_products(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL, -- 'broken_link', 'out_of_stock', 'redirect_error', 'affiliate_tag_missing'
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  duration_hours DECIMAL(10,2),
  estimated_clicks_low INTEGER,
  estimated_clicks_high INTEGER,
  estimated_loss_low DECIMAL(10,2),
  estimated_loss_high DECIMAL(10,2),
  resolution_type TEXT, -- 'manual', 'auto_fallback', 'auto_recovered'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE revenue_loss_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own loss ledger"
  ON revenue_loss_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_revenue_loss_user_detected
  ON revenue_loss_ledger(user_id, detected_at DESC);

-- Platform Reliability Stats
-- NOTE: This table is already created in V2_MIGRATION_ADD_CREATOR_OPS.sql with stat_date column
-- Skipping duplicate creation to avoid conflicts

-- Add missing columns if they don't exist (for backwards compatibility)
DO $$
BEGIN
  BEGIN
    ALTER TABLE platform_reliability_stats ADD COLUMN IF NOT EXISTS total_checks INTEGER DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE platform_reliability_stats ADD COLUMN IF NOT EXISTS successful_checks INTEGER DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE platform_reliability_stats ADD COLUMN IF NOT EXISTS failed_checks INTEGER DEFAULT 0;
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
  BEGIN
    ALTER TABLE platform_reliability_stats ADD COLUMN IF NOT EXISTS uptime_percentage DECIMAL(5,2);
  EXCEPTION WHEN duplicate_column THEN NULL;
  END;
END $$;

-- Function to generate unique short codes
CREATE OR REPLACE FUNCTION generate_short_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check both smartwrappers and redirect_links tables for uniqueness
    SELECT EXISTS(
      SELECT 1 FROM smartwrappers WHERE short_code = result
      UNION ALL
      SELECT 1 FROM redirect_links WHERE short_code = result
    ) INTO code_exists;

    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get platform reliability
CREATE OR REPLACE FUNCTION get_platform_reliability(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  platform TEXT,
  uptime_percentage DECIMAL,
  total_issues INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    prs.platform,
    AVG(prs.uptime_percentage) as uptime_percentage,
    SUM(prs.issues_detected)::INTEGER as total_issues
  FROM platform_reliability_stats prs
  WHERE prs.user_id = p_user_id
    AND prs.stat_date >= CURRENT_DATE - p_days
  GROUP BY prs.platform
  ORDER BY uptime_percentage DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get revenue loss summary
CREATE OR REPLACE FUNCTION get_revenue_loss_summary(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_issues INTEGER,
  total_loss_low DECIMAL,
  total_loss_high DECIMAL,
  resolved_count INTEGER,
  pending_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_issues,
    COALESCE(SUM(estimated_loss_low), 0) as total_loss_low,
    COALESCE(SUM(estimated_loss_high), 0) as total_loss_high,
    COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::INTEGER as resolved_count,
    COUNT(*) FILTER (WHERE resolved_at IS NULL)::INTEGER as pending_count
  FROM revenue_loss_ledger
  WHERE user_id = p_user_id
    AND detected_at >= CURRENT_DATE - p_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'SmartWrapper tables created successfully!';
  RAISE NOTICE 'Tables: smartwrappers, smartwrapper_clicks, tracked_products, revenue_loss_ledger, platform_reliability_stats';
END $$;
