-- =====================================================
-- LINK MONETIZATION GUARD - Database Schema
-- =====================================================
-- Core tables for link health monitoring and audit system
-- Run this AFTER existing shop/inventory tables
-- =====================================================

-- =====================================================
-- LINK AUDIT INFRASTRUCTURE
-- =====================================================

-- Link audit runs (scheduled daily audits)
CREATE TABLE link_audit_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Audit scope
  audit_type TEXT NOT NULL DEFAULT 'full', -- 'full', 'incremental', 'emergency'
  links_audited INTEGER DEFAULT 0,
  issues_found INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Results summary
  revenue_health_score DECIMAL(5,2), -- 0-100
  critical_issues INTEGER DEFAULT 0,
  warning_issues INTEGER DEFAULT 0,
  info_issues INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_runs_user ON link_audit_runs(user_id);
CREATE INDEX idx_audit_runs_status ON link_audit_runs(status, created_at DESC);

-- Link health status (per affiliate link)
CREATE TABLE link_health_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  affiliate_link_id UUID REFERENCES affiliate_links(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,

  -- Link details
  link_url TEXT NOT NULL,
  destination_url TEXT, -- Final resolved URL

  -- Health metrics
  health_score DECIMAL(5,2) NOT NULL DEFAULT 100, -- 0-100
  is_broken BOOLEAN DEFAULT FALSE,
  is_stock_out BOOLEAN DEFAULT FALSE,
  has_low_commission BOOLEAN DEFAULT FALSE,
  has_drift BOOLEAN DEFAULT FALSE,

  -- Redirect chain
  redirect_count INTEGER DEFAULT 0,
  redirect_chain JSONB, -- [{url, status_code, timestamp}]

  -- Response metrics
  last_check_at TIMESTAMPTZ,
  response_time_ms INTEGER,
  status_code INTEGER,

  -- Stock status
  stock_status TEXT, -- 'in_stock', 'out_of_stock', 'low_stock', 'unknown'
  stock_checked_at TIMESTAMPTZ,

  -- Destination fingerprint
  destination_fingerprint TEXT, -- Hash of page content
  fingerprint_updated_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_link_health_user ON link_health_status(user_id);
CREATE INDEX idx_link_health_affiliate ON link_health_status(affiliate_link_id);
CREATE INDEX idx_link_health_inventory ON link_health_status(inventory_item_id);
CREATE INDEX idx_link_health_broken ON link_health_status(is_broken, user_id);
CREATE INDEX idx_link_health_stock ON link_health_status(is_stock_out, user_id);

-- Link health issues (detected problems)
CREATE TABLE link_health_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audit_run_id UUID REFERENCES link_audit_runs(id) ON DELETE SET NULL,
  link_health_id UUID REFERENCES link_health_status(id) ON DELETE CASCADE,

  -- Issue classification
  issue_type TEXT NOT NULL, -- 'broken_link', 'stock_out', 'low_commission', 'destination_drift', 'redirect_drift', 'link_decay', 'geo_mismatch', 'program_expired'
  severity TEXT NOT NULL, -- 'critical', 'warning', 'info'

  -- Impact assessment
  revenue_impact_estimate DECIMAL(10,2), -- Estimated $ lost per month
  confidence_score DECIMAL(5,2), -- 0-100, how confident are we?

  -- Issue details
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB, -- Structured evidence data

  -- Resolution
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'false_positive', 'wont_fix'
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT, -- 'user', 'system', 'auto'
  resolution_note TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_issues_user ON link_health_issues(user_id);
CREATE INDEX idx_issues_audit ON link_health_issues(audit_run_id);
CREATE INDEX idx_issues_link ON link_health_issues(link_health_id);
CREATE INDEX idx_issues_status ON link_health_issues(status, severity);
CREATE INDEX idx_issues_type ON link_health_issues(issue_type);

-- Issue recommendations (suggested fixes)
CREATE TABLE issue_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES link_health_issues(id) ON DELETE CASCADE,

  -- Recommendation details
  action_type TEXT NOT NULL, -- 'replace_link', 'update_tag', 'switch_program', 'remove_link', 'add_backup'
  priority INTEGER DEFAULT 0, -- Higher = more important

  -- Action data
  title TEXT NOT NULL,
  description TEXT,
  action_payload JSONB, -- Data needed to execute action

  -- Expected impact
  estimated_revenue_gain DECIMAL(10,2),
  implementation_difficulty TEXT, -- 'easy', 'medium', 'hard'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recommendations_issue ON issue_recommendations(issue_id);
CREATE INDEX idx_recommendations_type ON issue_recommendations(action_type);

-- =====================================================
-- LINK AUDIT ACTIONS
-- =====================================================

-- Link audit actions (user/system actions taken)
CREATE TABLE link_audit_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES link_health_issues(id) ON DELETE SET NULL,
  recommendation_id UUID REFERENCES issue_recommendations(id) ON DELETE SET NULL,

  -- Action details
  action_type TEXT NOT NULL, -- 'generated_link', 'replaced_link', 'switched_program', 'removed_link', 'snoozed_issue'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'

  -- Action data
  action_data JSONB, -- {old_link, new_link, reason, etc}

  -- Results
  result_message TEXT,
  error_message TEXT,

  -- Tracking
  executed_by TEXT, -- 'user', 'system', 'auto'
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_actions_user ON link_audit_actions(user_id);
CREATE INDEX idx_actions_issue ON link_audit_actions(issue_id);
CREATE INDEX idx_actions_type ON link_audit_actions(action_type);
CREATE INDEX idx_actions_status ON link_audit_actions(status);

-- =====================================================
-- ALERTING SYSTEM
-- =====================================================

-- Link health alerts (notifications sent to users)
CREATE TABLE link_health_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audit_run_id UUID REFERENCES link_audit_runs(id) ON DELETE SET NULL,

  -- Alert details
  alert_type TEXT NOT NULL, -- 'revenue_health_drop', 'critical_issue', 'multiple_failures', 'weekly_summary'
  severity TEXT NOT NULL, -- 'critical', 'warning', 'info'

  -- Content
  title TEXT NOT NULL,
  message TEXT,
  issue_ids UUID[], -- Array of related issue IDs

  -- Delivery
  channels TEXT[], -- ['email', 'in_app', 'webhook']
  sent_at TIMESTAMPTZ,
  email_sent BOOLEAN DEFAULT FALSE,
  in_app_read BOOLEAN DEFAULT FALSE,
  in_app_read_at TIMESTAMPTZ,

  -- Alert data
  alert_data JSONB, -- {revenue_health_score, issue_count, etc}

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON link_health_alerts(user_id);
CREATE INDEX idx_alerts_audit ON link_health_alerts(audit_run_id);
CREATE INDEX idx_alerts_unread ON link_health_alerts(user_id, in_app_read);
CREATE INDEX idx_alerts_created ON link_health_alerts(created_at DESC);

-- =====================================================
-- LINK-IN-BIO PAGE TRACKING
-- =====================================================

-- Tracked link pages (Linktree, Beacons, etc.)
CREATE TABLE tracked_link_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Page details
  page_url TEXT NOT NULL,
  page_type TEXT, -- 'linktree', 'beacons', 'stan', 'bio.fm', 'custom', 'other'
  page_title TEXT,

  -- Audit settings
  audit_enabled BOOLEAN DEFAULT TRUE,
  audit_frequency TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'weekly'
  last_audited_at TIMESTAMPTZ,
  next_audit_at TIMESTAMPTZ,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Crawl metadata
  last_crawl_status TEXT, -- 'success', 'failed', 'rate_limited'
  last_crawl_error TEXT,
  links_found_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracked_pages_user ON tracked_link_pages(user_id);
CREATE INDEX idx_tracked_pages_audit ON tracked_link_pages(audit_enabled, next_audit_at);
CREATE INDEX idx_tracked_pages_active ON tracked_link_pages(is_active);

-- =====================================================
-- REVENUE HEALTH SCORE HISTORY
-- =====================================================

-- Revenue health history (track score over time)
CREATE TABLE revenue_health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  audit_run_id UUID REFERENCES link_audit_runs(id) ON DELETE SET NULL,

  -- Score
  health_score DECIMAL(5,2) NOT NULL, -- 0-100

  -- Breakdown
  links_total INTEGER,
  links_healthy INTEGER,
  links_broken INTEGER,
  links_stock_out INTEGER,
  links_low_commission INTEGER,

  -- Issues
  critical_issues INTEGER,
  warning_issues INTEGER,
  info_issues INTEGER,

  -- Metadata
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_history_user ON revenue_health_history(user_id, recorded_at DESC);
CREATE INDEX idx_health_history_audit ON revenue_health_history(audit_run_id);

-- =====================================================
-- USER PREFERENCES FOR LINK AUDITING
-- =====================================================

-- Add columns to existing user_preferences table (or create if doesn't exist)
-- ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS audit_preferences JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS link_audit_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- Audit settings
  auto_audit_enabled BOOLEAN DEFAULT TRUE,
  audit_frequency TEXT DEFAULT 'daily',

  -- Alert preferences
  email_alerts_enabled BOOLEAN DEFAULT TRUE,
  alert_threshold TEXT DEFAULT 'critical', -- 'all', 'critical', 'critical_and_warning'
  weekly_summary_enabled BOOLEAN DEFAULT TRUE,

  -- Auto-fix settings
  auto_fix_enabled BOOLEAN DEFAULT FALSE, -- Opt-in for automatic fixes
  auto_fix_types TEXT[], -- ['broken_links', 'stock_updates']

  -- Thresholds
  min_health_score_alert DECIMAL(5,2) DEFAULT 70, -- Alert if score drops below
  revenue_impact_threshold DECIMAL(10,2) DEFAULT 100, -- Alert if estimated loss > $100/mo

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE link_audit_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_health_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_health_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_audit_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_link_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_audit_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own audit data
CREATE POLICY audit_runs_policy ON link_audit_runs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY link_health_policy ON link_health_status FOR ALL USING (auth.uid() = user_id);
CREATE POLICY issues_policy ON link_health_issues FOR ALL USING (auth.uid() = user_id);
CREATE POLICY recommendations_policy ON issue_recommendations FOR SELECT USING (
  EXISTS (SELECT 1 FROM link_health_issues WHERE link_health_issues.id = issue_recommendations.issue_id AND link_health_issues.user_id = auth.uid())
);
CREATE POLICY actions_policy ON link_audit_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY alerts_policy ON link_health_alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY tracked_pages_policy ON tracked_link_pages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY health_history_policy ON revenue_health_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY audit_prefs_policy ON link_audit_preferences FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to calculate revenue health score
CREATE OR REPLACE FUNCTION calculate_revenue_health_score(p_user_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_score DECIMAL(5,2);
  v_total_links INTEGER;
  v_healthy_links INTEGER;
  v_critical_issues INTEGER;
  v_broken_links INTEGER;
  v_stock_out_links INTEGER;
BEGIN
  -- Count total links
  SELECT COUNT(*) INTO v_total_links
  FROM link_health_status
  WHERE user_id = p_user_id;

  IF v_total_links = 0 THEN
    RETURN 100.0;
  END IF;

  -- Count healthy links
  SELECT COUNT(*) INTO v_healthy_links
  FROM link_health_status
  WHERE user_id = p_user_id
    AND NOT is_broken
    AND NOT is_stock_out
    AND health_score >= 80;

  -- Count critical issues
  SELECT COUNT(*) INTO v_critical_issues
  FROM link_health_issues
  WHERE user_id = p_user_id
    AND status = 'open'
    AND severity = 'critical';

  -- Count broken and stock-out links
  SELECT
    SUM(CASE WHEN is_broken THEN 1 ELSE 0 END),
    SUM(CASE WHEN is_stock_out THEN 1 ELSE 0 END)
  INTO v_broken_links, v_stock_out_links
  FROM link_health_status
  WHERE user_id = p_user_id;

  -- Calculate score (weighted)
  v_score :=
    (v_healthy_links::DECIMAL / v_total_links * 50) + -- 50% weight on healthy links
    (GREATEST(0, 30 - v_critical_issues * 10)) + -- -10 points per critical issue (max -30)
    (GREATEST(0, 20 - v_broken_links * 5)); -- -5 points per broken link (max -20)

  RETURN GREATEST(0, LEAST(100, v_score));
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE link_audit_runs IS 'Scheduled audit runs that check all links for a user';
COMMENT ON TABLE link_health_status IS 'Current health status of each affiliate link';
COMMENT ON TABLE link_health_issues IS 'Detected problems with links (broken, stock-out, drift, etc)';
COMMENT ON TABLE issue_recommendations IS 'AI-generated recommendations to fix issues';
COMMENT ON TABLE link_audit_actions IS 'Actions taken by user or system to resolve issues';
COMMENT ON TABLE link_health_alerts IS 'Notifications sent to users about link health';
COMMENT ON TABLE tracked_link_pages IS 'Link-in-bio pages (Linktree, etc) that are monitored';
COMMENT ON TABLE revenue_health_history IS 'Historical Revenue Health Score for trend tracking';
COMMENT ON TABLE link_audit_preferences IS 'User preferences for audit frequency and alerts';

COMMENT ON FUNCTION calculate_revenue_health_score IS 'Calculates 0-100 score based on link health, issues, and failures';

-- =====================================================
-- AFFIMARK REDIRECT LINKS (AUTO-FIX SYSTEM)
-- =====================================================

-- AffiMark redirect links (affimark.io/go/xyz - the autopilot system)
CREATE TABLE redirect_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Short code (unique identifier)
  short_code TEXT UNIQUE NOT NULL, -- "abc123" -> affimark.io/go/abc123

  -- Destination management
  destination_url TEXT NOT NULL, -- Current destination (can be auto-swapped)
  original_url TEXT NOT NULL, -- What it was created for (reference)
  fallback_url TEXT, -- Where to go if primary product is out of stock

  -- Link metadata
  link_label TEXT, -- User-friendly name ("My Camera Link", "Microphone Affiliate")
  product_name TEXT, -- Product being promoted
  merchant_name TEXT, -- Amazon, Best Buy, etc.
  affiliate_network TEXT, -- Amazon Associates, Impact.com, etc.

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_autopilot_enabled BOOLEAN DEFAULT TRUE, -- Allow auto-swapping?

  -- Tracking
  click_count INTEGER DEFAULT 0,
  last_clicked_at TIMESTAMPTZ,

  -- Auto-swap history
  swap_count INTEGER DEFAULT 0,
  last_swapped_at TIMESTAMPTZ,
  last_swap_reason TEXT, -- "stock_out", "broken_link", "manual"

  -- Associated audit data
  link_health_id UUID REFERENCES link_health_status(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_redirect_links_user ON redirect_links(user_id);
CREATE INDEX idx_redirect_links_code ON redirect_links(short_code);
CREATE INDEX idx_redirect_links_active ON redirect_links(is_active, user_id);
CREATE INDEX idx_redirect_links_health ON redirect_links(link_health_id);

-- Redirect link clicks (click tracking for analytics)
CREATE TABLE redirect_link_clicks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  redirect_link_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,

  -- Click metadata
  clicked_at TIMESTAMPTZ DEFAULT NOW(),
  destination_url TEXT NOT NULL, -- Where they were sent

  -- User agent / tracking
  user_agent TEXT,
  ip_address TEXT,
  referer TEXT,
  country_code TEXT,

  -- Click attribution
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT
);

CREATE INDEX idx_clicks_redirect ON redirect_link_clicks(redirect_link_id, clicked_at DESC);
CREATE INDEX idx_clicks_date ON redirect_link_clicks(clicked_at DESC);

-- Redirect link swap history (auto-fix audit trail)
CREATE TABLE redirect_link_swaps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  redirect_link_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,

  -- Swap details
  old_destination TEXT NOT NULL,
  new_destination TEXT NOT NULL,
  swap_reason TEXT NOT NULL, -- "stock_out", "broken_link", "better_commission", "manual"

  -- Trigger info
  triggered_by TEXT, -- "system", "user", "auto"
  issue_id UUID REFERENCES link_health_issues(id) ON DELETE SET NULL,

  -- Impact
  estimated_revenue_impact DECIMAL(10,2), -- Potential loss prevented

  swapped_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_swaps_redirect ON redirect_link_swaps(redirect_link_id, swapped_at DESC);
CREATE INDEX idx_swaps_issue ON redirect_link_swaps(issue_id);

-- Row Level Security for redirect links
ALTER TABLE redirect_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirect_link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE redirect_link_swaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY redirect_links_policy ON redirect_links FOR ALL USING (auth.uid() = user_id);
CREATE POLICY redirect_clicks_policy ON redirect_link_clicks FOR SELECT USING (
  EXISTS (SELECT 1 FROM redirect_links WHERE redirect_links.id = redirect_link_clicks.redirect_link_id AND redirect_links.user_id = auth.uid())
);
CREATE POLICY redirect_swaps_policy ON redirect_link_swaps FOR SELECT USING (
  EXISTS (SELECT 1 FROM redirect_links WHERE redirect_links.id = redirect_link_swaps.redirect_link_id AND redirect_links.user_id = auth.uid())
);

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

    SELECT EXISTS(SELECT 1 FROM redirect_links WHERE short_code = result) INTO code_exists;

    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_redirect_link_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER redirect_links_updated_at
BEFORE UPDATE ON redirect_links
FOR EACH ROW
EXECUTE FUNCTION update_redirect_link_timestamp();

COMMENT ON TABLE redirect_links IS 'AffiMark redirect links (affimark.io/go/xyz) for auto-fix autopilot';
COMMENT ON TABLE redirect_link_clicks IS 'Click tracking for redirect links';
COMMENT ON TABLE redirect_link_swaps IS 'History of automatic destination swaps';
COMMENT ON FUNCTION generate_short_code IS 'Generates unique 6-character alphanumeric short codes';

-- =====================================================
-- SMARTWRAPPER DESTINATIONS (WATERFALL ROUTING)
-- =====================================================

-- Priority-based destination chain for waterfall routing
CREATE TABLE smartwrapper_destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  
  priority INTEGER NOT NULL, -- 1 = primary, 2 = backup, etc.
  destination_url TEXT NOT NULL,
  retailer TEXT, -- 'amazon', 'target', 'walmart', etc.
  affiliate_tag TEXT,
  commission_rate DECIMAL(5,2),
  
  -- Health status (cached for fast routing)
  health_status TEXT DEFAULT 'unknown', -- 'healthy', 'out_of_stock', 'broken', 'unknown'
  last_health_check_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(smartwrapper_id, priority)
);

CREATE INDEX idx_destinations_smartwrapper ON smartwrapper_destinations(smartwrapper_id, priority);
CREATE INDEX idx_destinations_health ON smartwrapper_destinations(health_status, last_health_check_at);

-- =====================================================
-- FLASH SALE SCHEDULER
-- =====================================================

-- Time-based destination overrides
CREATE TABLE smartwrapper_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT,
  destination_url TEXT NOT NULL,
  
  -- Timing
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  timezone TEXT DEFAULT 'UTC',
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- iCal RRULE format: 'FREQ=WEEKLY;BYDAY=FR'
  
  -- Status
  is_active BOOLEAN DEFAULT FALSE, -- Activated by cron when time matches
  notification_enabled BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schedules_smartwrapper ON smartwrapper_schedules(smartwrapper_id);
CREATE INDEX idx_schedules_active ON smartwrapper_schedules(is_active, starts_at, ends_at);
CREATE INDEX idx_schedules_time ON smartwrapper_schedules(starts_at, ends_at);

-- =====================================================
-- A/B TESTING
-- =====================================================

-- Split traffic tests
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  name TEXT,
  status TEXT DEFAULT 'running', -- 'running', 'completed', 'cancelled'
  
  -- Variants
  variant_a_url TEXT NOT NULL,
  variant_a_weight INTEGER DEFAULT 50, -- percentage
  variant_b_url TEXT NOT NULL,
  variant_b_weight INTEGER DEFAULT 50,
  
  -- Results
  variant_a_clicks INTEGER DEFAULT 0,
  variant_a_conversions INTEGER DEFAULT 0,
  variant_b_clicks INTEGER DEFAULT 0,
  variant_b_conversions INTEGER DEFAULT 0,
  
  -- Limits
  max_clicks INTEGER,
  ends_at TIMESTAMPTZ,
  
  winner TEXT, -- 'a', 'b', NULL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ab_tests_smartwrapper ON ab_tests(smartwrapper_id, status);

-- =====================================================
-- CUSTOM DOMAINS
-- =====================================================

-- User's branded domains (links.yourname.com)
CREATE TABLE custom_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  domain TEXT UNIQUE NOT NULL, -- 'links.jessicaphoto.com'
  
  -- Verification
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'failed'
  verification_token TEXT,
  
  -- SSL
  ssl_status TEXT DEFAULT 'pending', -- 'pending', 'active', 'expired'
  ssl_expires_at TIMESTAMPTZ,
  
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_domains_user ON custom_domains(user_id);
CREATE INDEX idx_domains_lookup ON custom_domains(domain) WHERE is_active = true;

-- =====================================================
-- COMMISSION OPTIMIZATION
-- =====================================================

-- Commission rates by retailer/category
CREATE TABLE commission_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retailer TEXT NOT NULL,
  category TEXT,
  commission_rate DECIMAL(5,2),
  source TEXT, -- 'affiliate_network', 'manual', 'scraped'
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_retailer ON commission_rates(retailer, category);

-- Product matches across retailers
CREATE TABLE product_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT,
  product_name TEXT,
  
  retailer_a TEXT,
  retailer_a_url TEXT,
  retailer_a_commission DECIMAL(5,2),
  
  retailer_b TEXT,
  retailer_b_url TEXT,
  retailer_b_commission DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_matches_sku ON product_matches(sku);

-- Commission optimization alerts
CREATE TABLE commission_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  smartwrapper_id UUID REFERENCES redirect_links(id) ON DELETE CASCADE,
  
  current_retailer TEXT,
  current_commission DECIMAL(5,2),
  suggested_retailer TEXT,
  suggested_commission DECIMAL(5,2),
  estimated_monthly_gain DECIMAL(10,2),
  
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_alerts_user ON commission_alerts(user_id, status);

-- =====================================================
-- LEECH DETECTOR (AFFILIATE ID HIJACK PREVENTION)
-- =====================================================

-- Scan results for affiliate ID verification
CREATE TABLE leech_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Scan results
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  expected_affiliate_id TEXT,
  found_affiliate_id TEXT,
  id_match BOOLEAN,
  
  -- Evidence
  redirect_chain JSONB, -- [{url, status_code, cookies}]
  final_url TEXT,
  final_cookies JSONB,
  screenshot_url TEXT,
  
  -- Verdict
  verdict TEXT, -- 'clean', 'tag_stripped', 'tag_hijacked', 'suspicious'
  confidence_score DECIMAL(5,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leech_scans_smartwrapper ON leech_scans(smartwrapper_id, scanned_at DESC);
CREATE INDEX idx_leech_scans_verdict ON leech_scans(verdict) WHERE verdict != 'clean';

-- =====================================================
-- CLICK ANALYTICS (AGGREGATED)
-- =====================================================

-- Daily rollup for fast dashboard queries
CREATE TABLE click_stats_daily (
  smartwrapper_id UUID NOT NULL REFERENCES redirect_links(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  
  total_clicks INTEGER DEFAULT 0,
  unique_clicks INTEGER DEFAULT 0,
  mobile_clicks INTEGER DEFAULT 0,
  desktop_clicks INTEGER DEFAULT 0,
  tablet_clicks INTEGER DEFAULT 0,
  
  top_country TEXT,
  top_utm_source TEXT,
  
  PRIMARY KEY (smartwrapper_id, date)
);

CREATE INDEX idx_click_stats_user ON click_stats_daily(user_id, date DESC);
CREATE INDEX idx_click_stats_date ON click_stats_daily(date DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE smartwrapper_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE smartwrapper_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leech_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_stats_daily ENABLE ROW LEVEL SECURITY;

-- Destinations policy (via smartwrapper ownership)
CREATE POLICY destinations_policy ON smartwrapper_destinations FOR ALL USING (
  EXISTS (SELECT 1 FROM redirect_links WHERE redirect_links.id = smartwrapper_destinations.smartwrapper_id AND redirect_links.user_id = auth.uid())
);

-- Schedules policy
CREATE POLICY schedules_policy ON smartwrapper_schedules FOR ALL USING (auth.uid() = user_id);

-- A/B tests policy
CREATE POLICY ab_tests_policy ON ab_tests FOR ALL USING (auth.uid() = user_id);

-- Custom domains policy
CREATE POLICY domains_policy ON custom_domains FOR ALL USING (auth.uid() = user_id);

-- Commission alerts policy
CREATE POLICY commission_alerts_policy ON commission_alerts FOR ALL USING (auth.uid() = user_id);

-- Leech scans policy
CREATE POLICY leech_scans_policy ON leech_scans FOR ALL USING (auth.uid() = user_id);

-- Click stats policy
CREATE POLICY click_stats_policy ON click_stats_daily FOR ALL USING (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Get active schedule for a smartwrapper
CREATE OR REPLACE FUNCTION get_active_schedule(p_smartwrapper_id UUID)
RETURNS TABLE (
  id UUID,
  destination_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.destination_url
  FROM smartwrapper_schedules s
  WHERE s.smartwrapper_id = p_smartwrapper_id
    AND s.is_active = TRUE
    AND s.starts_at <= NOW()
    AND (s.ends_at IS NULL OR s.ends_at > NOW())
  ORDER BY s.starts_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Get healthy destinations by priority
CREATE OR REPLACE FUNCTION get_healthy_destinations(p_smartwrapper_id UUID)
RETURNS TABLE (
  id UUID,
  priority INTEGER,
  destination_url TEXT,
  health_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT d.id, d.priority, d.destination_url, d.health_status
  FROM smartwrapper_destinations d
  WHERE d.smartwrapper_id = p_smartwrapper_id
    AND d.is_active = TRUE
  ORDER BY d.priority ASC;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE smartwrapper_destinations IS 'Priority chain of destinations for waterfall routing';
COMMENT ON TABLE smartwrapper_schedules IS 'Time-based destination overrides (Flash Sale Scheduler)';
COMMENT ON TABLE ab_tests IS 'A/B testing for SmartWrappers with traffic splitting';
COMMENT ON TABLE custom_domains IS 'User branded domains (links.yourname.com)';
COMMENT ON TABLE commission_rates IS 'Commission rates by retailer/category for optimization';
COMMENT ON TABLE commission_alerts IS 'Optimization suggestions for better commission rates';
COMMENT ON TABLE leech_scans IS 'Affiliate ID hijack detection scans with evidence';
COMMENT ON TABLE click_stats_daily IS 'Aggregated daily click statistics for fast queries';

