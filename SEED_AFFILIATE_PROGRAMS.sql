-- ========================================
-- Seed Affiliate Programs Database
-- Run this in Supabase SQL Editor after V2_MIGRATION
-- ========================================

-- Clear existing data (optional - comment out if you want to keep existing data)
-- DELETE FROM affiliate_programs;

-- ========================================
-- AMAZON PROGRAMS (Various Regions)
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('amazon', 'amazon-de', 'Amazon', 'Electronics', 2.0, 2.5, 24, 'DE', false, 5, NOW(), 'official'),
('amazon', 'amazon-de', 'Amazon', 'Fashion', 3.5, 4.0, 24, 'DE', false, 5, NOW(), 'official'),
('amazon', 'amazon-de', 'Amazon', 'Beauty', 2.5, 3.0, 24, 'DE', false, 5, NOW(), 'official'),
('amazon', 'amazon-de', 'Amazon', 'Home', 3.0, 3.5, 24, 'DE', false, 5, NOW(), 'official'),

('amazon', 'amazon-uk', 'Amazon', 'Electronics', 2.0, 2.5, 24, 'UK', false, 5, NOW(), 'official'),
('amazon', 'amazon-uk', 'Amazon', 'Fashion', 3.5, 4.0, 24, 'UK', false, 5, NOW(), 'official'),

('amazon', 'amazon-us', 'Amazon', 'Electronics', 2.0, 2.5, 24, 'US', false, 5, NOW(), 'official'),
('amazon', 'amazon-us', 'Amazon', 'Fashion', 3.5, 4.0, 24, 'US', false, 5, NOW(), 'official');

-- ========================================
-- FASHION & APPAREL (Awin, Tradedoubler)
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '15589', 'Zara', 'Fashion', 4.0, 5.0, 30, 'EU', true, 4, NOW() - INTERVAL '3 days', 'api'),
('awin', '15642', 'H&M', 'Fashion', 5.0, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '5 days', 'api'),
('awin', '10270', 'Nike', 'Fashion', 6.0, 8.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '13063', 'Adidas', 'Fashion', 5.5, 7.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '13694', 'Zalando', 'Fashion', 5.0, 6.0, 30, 'EU', true, 5, NOW() - INTERVAL '1 day', 'api'),
('awin', '2041', 'ASOS', 'Fashion', 7.0, 9.0, 30, 'EU', true, 5, NOW() - INTERVAL '1 day', 'api'),
('awin', '17121', 'Mango', 'Fashion', 4.5, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '7 days', 'api'),
('awin', '18538', 'COS', 'Fashion', 5.0, 6.5, 30, 'EU', true, 4, NOW() - INTERVAL '10 days', 'api'),

('tradedoubler', '26584', 'Zara', 'Fashion', 4.0, 5.0, 30, 'EU', true, 3, NOW() - INTERVAL '14 days', 'manual'),
('tradedoubler', '22791', 'Zalando', 'Fashion', 5.0, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '8 days', 'api');

-- ========================================
-- BEAUTY & COSMETICS
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '14862', 'Sephora', 'Beauty', 8.0, 10.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '15247', 'Douglas', 'Beauty', 6.0, 8.0, 30, 'DE', true, 4, NOW() - INTERVAL '5 days', 'api'),
('awin', '17893', 'Notino', 'Beauty', 7.0, 9.0, 30, 'EU', true, 4, NOW() - INTERVAL '6 days', 'api'),
('awin', '16745', 'Lookfantastic', 'Beauty', 8.0, 10.0, 30, 'EU', true, 5, NOW() - INTERVAL '3 days', 'api'),
('awin', '18234', 'Cult Beauty', 'Beauty', 9.0, 12.0, 30, 'EU', true, 5, NOW() - INTERVAL '1 day', 'api'),

('ltk', 'ltk-sephora', 'Sephora', 'Beauty', 5.0, 8.0, 30, 'US', false, 4, NOW() - INTERVAL '10 days', 'manual');

-- ========================================
-- ELECTRONICS & TECH
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '19284', 'MediaMarkt', 'Electronics', 3.0, 4.0, 30, 'DE', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '19285', 'Saturn', 'Electronics', 3.0, 4.0, 30, 'DE', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '18756', 'Sony', 'Electronics', 8.0, 12.0, 30, 'EU', true, 4, NOW() - INTERVAL '4 days', 'api'),
('awin', '17642', 'Apple', 'Electronics', 1.0, 2.0, 30, 'EU', true, 5, NOW() - INTERVAL '1 day', 'official'),
('awin', '19874', 'Samsung', 'Electronics', 5.0, 8.0, 30, 'EU', true, 4, NOW() - INTERVAL '6 days', 'api'),
('awin', '16523', 'Dell', 'Electronics', 6.0, 8.0, 30, 'EU', true, 4, NOW() - INTERVAL '8 days', 'api'),

('tradedoubler', '31247', 'MediaMarkt', 'Electronics', 2.5, 3.5, 30, 'DE', true, 4, NOW() - INTERVAL '7 days', 'api'),
('tradedoubler', '28934', 'Lenovo', 'Electronics', 4.0, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '12 days', 'manual');

-- ========================================
-- HOME & LIVING
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '15678', 'IKEA', 'Home', 2.0, 3.0, 30, 'EU', true, 4, NOW() - INTERVAL '15 days', 'manual'),
('awin', '16234', 'H&M Home', 'Home', 4.5, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '5 days', 'api'),
('awin', '17892', 'Wayfair', 'Home', 6.0, 8.0, 30, 'EU', true, 5, NOW() - INTERVAL '3 days', 'api'),
('awin', '18456', 'Made.com', 'Home', 5.0, 7.0, 30, 'EU', true, 4, NOW() - INTERVAL '9 days', 'api'),
('awin', '14523', 'Zara Home', 'Home', 4.0, 5.5, 30, 'EU', true, 4, NOW() - INTERVAL '8 days', 'api'),

('tradedoubler', '29456', 'Otto', 'Home', 3.5, 5.0, 30, 'DE', true, 4, NOW() - INTERVAL '10 days', 'manual');

-- ========================================
-- SPORTS & FITNESS
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '10270', 'Nike', 'Sports', 6.0, 8.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '13063', 'Adidas', 'Sports', 5.5, 7.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '17845', 'Decathlon', 'Sports', 4.0, 6.0, 30, 'EU', true, 4, NOW() - INTERVAL '6 days', 'api'),
('awin', '16789', 'Under Armour', 'Sports', 6.0, 8.0, 30, 'EU', true, 4, NOW() - INTERVAL '8 days', 'api'),
('awin', '18923', 'Gymshark', 'Sports', 7.0, 10.0, 30, 'EU', true, 5, NOW() - INTERVAL '3 days', 'api');

-- ========================================
-- LUXURY & ACCESSORIES
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '19234', 'Farfetch', 'Luxury', 8.0, 12.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'api'),
('awin', '17456', 'NET-A-PORTER', 'Luxury', 8.0, 10.0, 30, 'EU', true, 5, NOW() - INTERVAL '4 days', 'api'),
('awin', '16892', 'MyTheresa', 'Luxury', 7.0, 10.0, 30, 'EU', true, 4, NOW() - INTERVAL '6 days', 'api'),
('awin', '18745', 'Vestiaire Collective', 'Luxury', 10.0, 15.0, 30, 'EU', true, 4, NOW() - INTERVAL '8 days', 'manual');

-- ========================================
-- TRAVEL & LIFESTYLE
-- ========================================

INSERT INTO affiliate_programs (network, program_id, brand_name, category, commission_rate_low, commission_rate_high, cookie_duration, region, requires_application, confidence_score, last_verified, source) VALUES
('awin', '15892', 'Booking.com', 'Travel', 25.0, 40.0, 30, 'EU', true, 5, NOW() - INTERVAL '1 day', 'official'),
('awin', '14678', 'Expedia', 'Travel', 20.0, 30.0, 30, 'EU', true, 5, NOW() - INTERVAL '2 days', 'official'),
('awin', '16234', 'Airbnb', 'Travel', 15.0, 25.0, 30, 'EU', true, 4, NOW() - INTERVAL '10 days', 'manual'),

('tradedoubler', '27892', 'Hotels.com', 'Travel', 20.0, 35.0, 30, 'EU', true, 4, NOW() - INTERVAL '7 days', 'api');

-- ========================================
-- Verification
-- ========================================

SELECT
  network,
  COUNT(*) as program_count,
  AVG(commission_rate_high) as avg_high_rate,
  COUNT(DISTINCT brand_name) as unique_brands
FROM affiliate_programs
GROUP BY network
ORDER BY program_count DESC;

SELECT category, COUNT(*) as count
FROM affiliate_programs
GROUP BY category
ORDER BY count DESC;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully seeded % affiliate programs across % networks',
    (SELECT COUNT(*) FROM affiliate_programs),
    (SELECT COUNT(DISTINCT network) FROM affiliate_programs);
END $$;
