-- =====================================================
-- DROP ALL AFFIMARK TABLES (COMPLETE RESET)
-- =====================================================
-- WARNING: This will delete ALL AffiMark data
-- Use this for complete fresh start or testing only
-- =====================================================

-- Drop v2 Creator Ops tables (newest first)
DROP TABLE IF EXISTS platform_reliability_stats CASCADE;
DROP TABLE IF EXISTS link_optimizations CASCADE;
DROP TABLE IF EXISTS affiliate_programs CASCADE;
DROP TABLE IF EXISTS tax_personas CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS affiliate_transactions CASCADE;
DROP TABLE IF EXISTS connected_accounts CASCADE;
DROP TABLE IF EXISTS user_creator_preferences CASCADE;

-- Drop Link Audit tables (from LINK_AUDIT_SCHEMA.sql)
DROP TABLE IF EXISTS click_stats_daily CASCADE;
DROP TABLE IF EXISTS leech_scans CASCADE;
DROP TABLE IF EXISTS commission_alerts CASCADE;
DROP TABLE IF EXISTS product_matches CASCADE;
DROP TABLE IF EXISTS commission_rates CASCADE;
DROP TABLE IF EXISTS custom_domains CASCADE;
DROP TABLE IF EXISTS ab_tests CASCADE;
DROP TABLE IF EXISTS smartwrapper_schedules CASCADE;
DROP TABLE IF EXISTS smartwrapper_destinations CASCADE;
DROP TABLE IF EXISTS redirect_link_swaps CASCADE;
DROP TABLE IF EXISTS redirect_link_clicks CASCADE;
DROP TABLE IF EXISTS redirect_links CASCADE;
DROP TABLE IF EXISTS link_audit_preferences CASCADE;
DROP TABLE IF EXISTS revenue_health_history CASCADE;
DROP TABLE IF EXISTS tracked_link_pages CASCADE;
DROP TABLE IF EXISTS link_health_alerts CASCADE;
DROP TABLE IF EXISTS link_audit_actions CASCADE;
DROP TABLE IF EXISTS issue_recommendations CASCADE;
DROP TABLE IF EXISTS link_health_issues CASCADE;
DROP TABLE IF EXISTS link_health_status CASCADE;
DROP TABLE IF EXISTS link_audit_runs CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS get_top_storefronts(UUID, INTEGER, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_earnings_growth(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_total_earnings(UUID, DATE, DATE) CASCADE;
DROP FUNCTION IF EXISTS get_healthy_destinations(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_active_schedule(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_revenue_health_score(UUID) CASCADE;
DROP FUNCTION IF EXISTS generate_short_code() CASCADE;
DROP FUNCTION IF EXISTS update_redirect_link_timestamp() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- COMPLETE - All AffiMark tables dropped
-- =====================================================
-- Next steps:
-- 1. Run LINK_AUDIT_SCHEMA.sql (base schema)
-- 2. Run V2_MIGRATION_ADD_CREATOR_OPS.sql (v2 features)
-- =====================================================
