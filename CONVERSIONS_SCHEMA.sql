-- =====================================================
-- CONVERSION TRACKING SCHEMA
-- =====================================================
-- Add this to your LINK_AUDIT_SCHEMA.sql or run separately
-- Tracks conversions (sales, signups, leads) from SmartWrapper clicks

-- Conversions table
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  click_id UUID REFERENCES redirect_link_clicks(id) ON DELETE SET NULL,

  -- Conversion details
  conversion_type TEXT NOT NULL DEFAULT 'sale', -- 'sale', 'signup', 'lead', 'other'
  status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'rejected'

  -- Revenue metrics
  revenue DECIMAL(10,2) DEFAULT 0, -- Total order value
  commission DECIMAL(10,2) DEFAULT 0, -- Commission earned
  order_value DECIMAL(10,2) DEFAULT 0, -- Gross order value

  -- Order details
  order_id TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversions_smartwrapper ON conversions(smartwrapper_id, converted_at DESC);
CREATE INDEX idx_conversions_user ON conversions(user_id, converted_at DESC);
CREATE INDEX idx_conversions_click ON conversions(click_id);
CREATE INDEX idx_conversions_status ON conversions(status, converted_at DESC);

-- Row Level Security
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversions_policy ON conversions FOR ALL USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE conversions IS 'Conversion tracking for SmartWrappers (sales, signups, leads)';
COMMENT ON COLUMN conversions.revenue IS 'Total revenue from this conversion';
COMMENT ON COLUMN conversions.commission IS 'Commission earned from this conversion';
COMMENT ON COLUMN conversions.order_value IS 'Gross order value (before commission)';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get conversion rate for a SmartWrapper
CREATE OR REPLACE FUNCTION get_conversion_rate(p_smartwrapper_id UUID, p_days INTEGER DEFAULT 30)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_clicks INTEGER;
  v_conversions INTEGER;
BEGIN
  -- Count clicks in period
  SELECT COUNT(*) INTO v_clicks
  FROM redirect_link_clicks
  WHERE redirect_link_id = p_smartwrapper_id
    AND clicked_at >= NOW() - (p_days || ' days')::INTERVAL;

  -- Count conversions in period
  SELECT COUNT(*) INTO v_conversions
  FROM conversions
  WHERE smartwrapper_id = p_smartwrapper_id
    AND converted_at >= NOW() - (p_days || ' days')::INTERVAL
    AND status = 'approved';

  IF v_clicks = 0 THEN
    RETURN 0;
  END IF;

  RETURN (v_conversions::DECIMAL / v_clicks * 100);
END;
$$ LANGUAGE plpgsql;

-- Get revenue metrics for a SmartWrapper
CREATE OR REPLACE FUNCTION get_revenue_metrics(p_smartwrapper_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_conversions BIGINT,
  total_revenue DECIMAL(10,2),
  total_commission DECIMAL(10,2),
  avg_order_value DECIMAL(10,2),
  conversion_rate DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(c.revenue), 0)::DECIMAL(10,2),
    COALESCE(SUM(c.commission), 0)::DECIMAL(10,2),
    COALESCE(AVG(c.order_value), 0)::DECIMAL(10,2),
    get_conversion_rate(p_smartwrapper_id, p_days)
  FROM conversions c
  WHERE c.smartwrapper_id = p_smartwrapper_id
    AND c.converted_at >= NOW() - (p_days || ' days')::INTERVAL
    AND c.status = 'approved';
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT * FROM get_revenue_metrics('smartwrapper-uuid-here', 30);
-- Returns: total_conversions, total_revenue, total_commission, avg_order_value, conversion_rate
