/**
 * REST API endpoints for frontend
 * Link Guard Core API Routes
 */

import { Hono } from 'hono';
import type { Env } from './index';

type Bindings = Env;

const api = new Hono<{ Bindings: Bindings }>();

// CORS middleware
api.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
});

// Handle OPTIONS requests
api.options('*', (c) => c.text('', 204));

// =====================================================
// ACTIVE ROUTES (Link Audit Platform)
// =====================================================

// Link Audit Routes (Core audit functionality)
import linkAuditRoutes from './api/link-audit-routes';
api.route('/api/audit', linkAuditRoutes);

// Action Routes (Fix execution for Link Guard)
import actionRoutes from './api/action-routes';
api.route('/api/actions', actionRoutes);

// Affiliate Links Routes (Affiliate link management)
import affiliateLinksRoutes from './api/affiliate-links-routes';
api.route('/api/affiliate-links', affiliateLinksRoutes);

// Merchants Routes (Merchant credentials for stock checks)
import merchantsRoutes from './api/merchants-routes';
api.route('/api/merchants', merchantsRoutes);

// Products Routes (Product data for stock checking)
import productsRoutes from './api/products-routes';
api.route('/api/products', productsRoutes);

// Inventory Routes (Link inventory management)
import inventoryRoutes from './api/inventory-routes';
api.route('/api/inventory', inventoryRoutes);

// Redirect Links Routes (AffiMark autopilot system - affimark.io/go/xyz)
import redirectRoutes from './api/redirect-routes';
api.route('/api/redirects', redirectRoutes);

// SmartWrapper Routes (Priority chain management with waterfall routing)
import smartwrapperRoutes from './api/smartwrapper-routes';
api.route('/api/smartwrappers', smartwrapperRoutes);

// Schedule Routes (Flash Sale Scheduler) - TODO: Implement
// import scheduleRoutes from './api/schedule-routes';
// api.route('/api/smartwrappers', scheduleRoutes);
// api.route('/api', scheduleRoutes);

// A/B Test Routes (Traffic splitting and winner application) - TODO: Implement
// import abTestRoutes from './api/ab-test-routes';
// api.route('/api/smartwrappers', abTestRoutes);
// api.route('/api/ab-tests', abTestRoutes);

// Analytics Routes (SmartWrapper performance metrics)
import analyticsRoutes from './api/analytics-routes';
api.route('/api/analytics', analyticsRoutes);

// Conversion Tracking Routes
import conversionRoutes from './api/conversion-routes';
api.route('/api/conversions', conversionRoutes);

// Custom Domain Routes (Branded domains)
import domainRoutes from './api/domain-routes';
api.route('/api/domains', domainRoutes);

// =====================================================
// V2 CREATOR OPS PLATFORM ROUTES
// =====================================================

// Connected Accounts Routes (Multi-storefront connections)
import accountsRoutes from './api/accounts-routes';
api.route('/api/accounts', accountsRoutes);

// Affiliate Transactions Routes (Unified earnings with multi-currency)
import transactionsRoutes from './api/transactions-routes';
api.route('/api/transactions', transactionsRoutes);

// Tax Export Routes (CSV/PDF generation with personas)
import exportRoutes from './api/export-routes';
api.route('/api/export', exportRoutes);

// Smart Link Optimizer Routes (Phase 4 Hero Feature)
import optimizerRoutes from './api/optimizer-routes';
api.route('/api/optimizer', optimizerRoutes);

// Attribution Test Routes (Link diagnostics for V2)
import attributionTestRoutes from './api/attribution-test-routes';
api.route('/api/attribution', attributionTestRoutes);

// Commission Optimization Routes
import commissionRoutes from './api/commission-routes';
api.route('/api/commission', commissionRoutes);

// Migration Routes (Import from Linktree/Beacons/Stan)
import migrationRoutes from './api/migration-routes';
api.route('/api/migration', migrationRoutes);

// Awin OAuth Routes (Automated earnings sync)
import awinOAuthRoutes from './api/awin-oauth-routes';
api.route('/api/awin', awinOAuthRoutes);

// Tradedoubler OAuth Routes (Automated earnings sync)
import tradedoublerOAuthRoutes from './api/tradedoubler-oauth-routes';
api.route('/api/tradedoubler', tradedoublerOAuthRoutes);

// Security Routes (Leech detection and affiliate ID protection) - TODO: Implement
// import securityRoutes from './api/security-routes';
// api.route('/api/security', securityRoutes);

// =====================================================
// ARCHIVED ROUTES (Campaign Marketplace - 2025-12-01)
// =====================================================
// The following routes were part of the old campaign marketplace system.
// Files moved to /backend/src/api/legacy/
// Database tables moved to archived_campaign_marketplace schema
// See PHASE1_MIGRATION.sql and /backend/src/api/legacy/README.md
//
// Archived imports (do not uncomment without restoring files):
// - campaigns-routes (campaign management)
// - fairness-routes (fairness scoring)
// - messaging-routes (brand-creator messaging)
// - notifications-routes (notification system)
// - deliverables-routes (content review workflow)
// - matching-routes (smart matching)
// - files-routes (file upload management)
// - reviews-routes (reviews & ratings)
// - payments-routes (payment & escrow)
// - contracts-routes (contract system)
// - disputes-routes (dispute resolution)
// - verification-routes (identity verification)
// - benchmarks-routes (rate benchmarking)
// - search-routes (advanced search)
// - saved-searches-routes (saved searches & alerts)
// - webhooks-routes (webhook system)
// - performance-payments-routes (performance-based payments)
// - audience-intelligence-routes (audience demographics)
// - recurring-revenue-routes (ambassador programs)
// - campaign-automation-routes (auto-outreach)
// - pricing-intelligence-routes (pricing benchmarks)
// - creator-portfolio-routes (creator portfolios)
// =====================================================

export default api;

