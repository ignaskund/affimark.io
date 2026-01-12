-- =====================================================
-- AFFIMARK - DROP ALL TABLES SCRIPT
-- =====================================================
-- Run this BEFORE applying LINK_AUDIT_SCHEMA.sql
-- Drops tables in reverse dependency order to avoid FK errors
-- =====================================================

-- Disable triggers temporarily
SET session_replication_role = 'replica';

-- =====================================================
-- DROP POLICIES FIRST (to avoid errors)
-- =====================================================

DROP POLICY IF EXISTS click_stats_policy ON click_stats_daily;
DROP POLICY IF EXISTS leech_scans_policy ON leech_scans;
DROP POLICY IF EXISTS commission_alerts_policy ON commission_alerts;
DROP POLICY IF EXISTS domains_policy ON custom_domains;
DROP POLICY IF EXISTS ab_tests_policy ON ab_tests;
DROP POLICY IF EXISTS schedules_policy ON smartwrapper_schedules;
DROP POLICY IF EXISTS destinations_policy ON smartwrapper_destinations;
DROP POLICY IF EXISTS redirect_swaps_policy ON redirect_link_swaps;
DROP POLICY IF EXISTS redirect_clicks_policy ON redirect_link_clicks;
DROP POLICY IF EXISTS redirect_links_policy ON redirect_links;
DROP POLICY IF EXISTS link_audit_preferences_policy ON link_audit_preferences;
DROP POLICY IF EXISTS revenue_health_history_policy ON revenue_health_history;
DROP POLICY IF EXISTS tracked_link_pages_policy ON tracked_link_pages;
DROP POLICY IF EXISTS link_health_alerts_policy ON link_health_alerts;
DROP POLICY IF EXISTS link_audit_actions_policy ON link_audit_actions;
DROP POLICY IF EXISTS issue_recommendations_policy ON issue_recommendations;
DROP POLICY IF EXISTS link_health_issues_policy ON link_health_issues;
DROP POLICY IF EXISTS link_health_status_policy ON link_health_status;
DROP POLICY IF EXISTS link_audit_runs_policy ON link_audit_runs;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================

DROP FUNCTION IF EXISTS get_healthy_destinations(UUID);
DROP FUNCTION IF EXISTS get_active_schedule(UUID);
DROP FUNCTION IF EXISTS update_redirect_link_timestamp() CASCADE;
DROP FUNCTION IF EXISTS generate_short_code();
DROP FUNCTION IF EXISTS calculate_revenue_health_score(UUID);
DROP FUNCTION IF EXISTS increment(TEXT, UUID, TEXT);

-- =====================================================
-- DROP TRIGGERS
-- =====================================================

DROP TRIGGER IF EXISTS redirect_links_updated_at ON redirect_links;

-- =====================================================
-- DROP TABLES (children first, then parents)
-- =====================================================

-- SmartWrapper system tables (newest)
DROP TABLE IF EXISTS click_stats_daily CASCADE;
DROP TABLE IF EXISTS leech_scans CASCADE;
DROP TABLE IF EXISTS commission_alerts CASCADE;
DROP TABLE IF EXISTS product_matches CASCADE;
DROP TABLE IF EXISTS commission_rates CASCADE;
DROP TABLE IF EXISTS custom_domains CASCADE;
DROP TABLE IF EXISTS ab_tests CASCADE;
DROP TABLE IF EXISTS smartwrapper_schedules CASCADE;
DROP TABLE IF EXISTS smartwrapper_destinations CASCADE;

-- Redirect link system
DROP TABLE IF EXISTS redirect_link_swaps CASCADE;
DROP TABLE IF EXISTS redirect_link_clicks CASCADE;
DROP TABLE IF EXISTS redirect_links CASCADE;

-- Link audit system (original tables)
DROP TABLE IF EXISTS link_audit_preferences CASCADE;
DROP TABLE IF EXISTS revenue_health_history CASCADE;
DROP TABLE IF EXISTS tracked_link_pages CASCADE;
DROP TABLE IF EXISTS link_health_alerts CASCADE;
DROP TABLE IF EXISTS link_audit_actions CASCADE;
DROP TABLE IF EXISTS issue_recommendations CASCADE;
DROP TABLE IF EXISTS link_health_issues CASCADE;
DROP TABLE IF EXISTS link_health_status CASCADE;
DROP TABLE IF EXISTS link_audit_runs CASCADE;

-- =====================================================
-- DROP ANY ORPHANED INDEXES (just in case)
-- =====================================================

DROP INDEX IF EXISTS idx_click_stats_date;
DROP INDEX IF EXISTS idx_click_stats_user;
DROP INDEX IF EXISTS idx_leech_scans_verdict;
DROP INDEX IF EXISTS idx_leech_scans_smartwrapper;
DROP INDEX IF EXISTS idx_commission_alerts_user;
DROP INDEX IF EXISTS idx_product_matches_sku;
DROP INDEX IF EXISTS idx_commission_retailer;
DROP INDEX IF EXISTS idx_domains_lookup;
DROP INDEX IF EXISTS idx_domains_user;
DROP INDEX IF EXISTS idx_ab_tests_smartwrapper;
DROP INDEX IF EXISTS idx_schedules_time;
DROP INDEX IF EXISTS idx_schedules_active;
DROP INDEX IF EXISTS idx_schedules_smartwrapper;
DROP INDEX IF EXISTS idx_destinations_health;
DROP INDEX IF EXISTS idx_destinations_smartwrapper;
DROP INDEX IF EXISTS idx_swaps_issue;
DROP INDEX IF EXISTS idx_swaps_redirect;
DROP INDEX IF EXISTS idx_clicks_date;
DROP INDEX IF EXISTS idx_clicks_redirect;
DROP INDEX IF EXISTS idx_redirect_links_health;
DROP INDEX IF EXISTS idx_redirect_links_active;
DROP INDEX IF EXISTS idx_redirect_links_code;
DROP INDEX IF EXISTS idx_redirect_links_user;
DROP INDEX IF EXISTS idx_preferences_user;
DROP INDEX IF EXISTS idx_health_history_user;
DROP INDEX IF EXISTS idx_tracked_pages_user;
DROP INDEX IF EXISTS idx_alerts_user;
DROP INDEX IF EXISTS idx_alerts_audit;
DROP INDEX IF EXISTS idx_actions_status;
DROP INDEX IF EXISTS idx_actions_type;
DROP INDEX IF EXISTS idx_actions_issue;
DROP INDEX IF EXISTS idx_actions_user;
DROP INDEX IF EXISTS idx_recommendations_type;
DROP INDEX IF EXISTS idx_recommendations_issue;
DROP INDEX IF EXISTS idx_issues_type;
DROP INDEX IF EXISTS idx_issues_status;
DROP INDEX IF EXISTS idx_issues_link;
DROP INDEX IF EXISTS idx_issues_audit;
DROP INDEX IF EXISTS idx_issues_user;
DROP INDEX IF EXISTS idx_link_health_stock;
DROP INDEX IF EXISTS idx_link_health_broken;
DROP INDEX IF EXISTS idx_link_health_inventory;
DROP INDEX IF EXISTS idx_link_health_affiliate;
DROP INDEX IF EXISTS idx_link_health_user;
DROP INDEX IF EXISTS idx_audit_runs_status;
DROP INDEX IF EXISTS idx_audit_runs_user;

-- Re-enable triggers
SET session_replication_role = 'origin';

-- =====================================================
-- DONE - Now run LINK_AUDIT_SCHEMA.sql
-- =====================================================

SELECT 'All tables dropped successfully. Now run LINK_AUDIT_SCHEMA.sql' AS status;

