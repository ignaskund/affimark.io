/**
 * Portfolio Risk Audit Routes
 *
 * POST /api/portfolio/audit — Analyzes every product in a creator's portfolio
 * for revenue risk, computes per-product verdicts (keep/review/replace), and
 * returns portfolio-level aggregates (Revenue Stability Index, merchant
 * concentration, avg risk dimensions).
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCreatorProfile, identifyProduct } from '../mcp/tools';
import { enrichStatic } from '../services/enrichment';
import { scoreOutcomeFeasibility } from '../services/outcome-feasibility-scorer';

const app = new Hono();

app.use('/*', cors({
  origin: (origin) => {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return origin;
    const allowed = ['affimark.io', 'www.affimark.io', 'affimark-frontend.vercel.app'];
    if (origin && allowed.some(d => origin.includes(d))) return origin;
    return origin || '*';
  },
  credentials: true,
}));

/**
 * POST /api/portfolio/audit
 * Input: { userId: string }
 */
app.post('/audit', async (c) => {
  const startTime = Date.now();

  try {
    const body = await c.req.json();
    const { userId } = body;

    if (!userId) {
      return c.json({ error: 'userId is required' }, 401);
    }

    console.log(`[Portfolio Audit] Starting audit for user ${userId}`);

    const supabaseUrl = (c.env as any).SUPABASE_URL;
    const supabaseKey = (c.env as any).SUPABASE_SERVICE_KEY;
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };

    // Load creator profile (for context — priorities, storefronts, social)
    const profile = await getCreatorProfile(userId, c.env);

    // Fetch all products with their IDs (getCreatorProfile doesn't return IDs)
    const productsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=id,title,brand,category,current_price,platform,product_url&limit=200`,
      { headers }
    );
    const products: any[] = await productsRes.json();

    if (!Array.isArray(products) || products.length === 0) {
      return c.json({
        portfolioSummary: {
          totalProducts: 0, analyzed: 0, highRisk: 0, moderateRisk: 0, stable: 0, unanalyzed: 0,
          revenueStabilityIndex: 0,
          merchantConcentration: { topMerchant: 'None', percentage: 0 },
          avgMerchantStability: 0, avgRefundRisk: 0, avgCommissionDurability: 0,
        },
        products: [],
        topRisks: [],
        meta: { duration: Date.now() - startTime },
      });
    }

    console.log(`[Portfolio Audit] Analyzing ${products.length} products`);

    // Score each product in parallel (with rate limiting to avoid overwhelming services)
    const BATCH_SIZE = 5;
    const productResults: any[] = [];

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (product) => {
        // Products without a URL cannot be analyzed
        if (!product.product_url) {
          return {
            id: product.id,
            title: product.title || 'Unknown Product',
            brand: product.brand || null,
            category: product.category || 'General',
            price: product.current_price ? parseFloat(product.current_price) : null,
            platform: product.platform || '',
            productUrl: null,
            verdict: 'unanalyzed' as const,
            riskScore: null,
            riskBreakdown: null,
            warnings: [],
            confidence: 0,
            commissionRate: null,
            cookieDuration: null,
          };
        }

        try {
          // Step 3a: Identify product from URL (multi-strategy)
          let identified: any = null;
          try {
            identified = await identifyProduct(product.product_url, c.env);
          } catch (e) {
            console.warn(`[Portfolio Audit] identifyProduct failed for ${product.product_url}:`, e);
          }

          const name = product.title || identified?.title || 'Unknown Product';
          const brand = product.brand || identified?.brand || '';
          const category = product.category || identified?.category || 'General';
          const price = product.current_price
            ? parseFloat(product.current_price)
            : (identified?.price || 0);

          // Step 3b: Static enrichment — get commission rate, cookie duration, merchant profile
          const signals = enrichStatic({
            name,
            brand,
            category,
            price,
            currency: identified?.currency || 'USD',
            affiliateNetwork: product.platform || '',
            merchant: brand,
            inStock: true,
          });

          // Step 3c: Outcome feasibility scoring — 4 risk dimensions
          const feasibility = await scoreOutcomeFeasibility({
            name,
            brand,
            category,
            price,
            currency: identified?.currency || 'USD',
            affiliateNetwork: product.platform || '',
            merchantName: brand,
            commissionRate: signals.commissionRate,
            cookieDuration: signals.cookieDurationDays,
          }, c.env);

          // Verdict thresholds
          let verdict: 'keep' | 'review' | 'replace';
          if (feasibility.overall >= 70) verdict = 'keep';
          else if (feasibility.overall >= 50) verdict = 'review';
          else verdict = 'replace';

          return {
            id: product.id,
            title: name,
            brand: brand || null,
            category,
            price,
            platform: product.platform || '',
            productUrl: product.product_url,
            verdict,
            riskScore: feasibility.overall,
            riskBreakdown: {
              merchantRisk: feasibility.merchantRisk,
              refundRisk: feasibility.refundRisk,
              demandEvidence: feasibility.demandEvidence,
              programFriction: feasibility.programFriction,
            },
            warnings: feasibility.warnings || [],
            confidence: feasibility.confidence,
            commissionRate: signals.commissionRate != null ? signals.commissionRate : null,
            cookieDuration: signals.cookieDurationDays != null ? signals.cookieDurationDays : null,
          };
        } catch (e: any) {
          console.error(`[Portfolio Audit] Error scoring product ${product.id}:`, e?.message);
          return {
            id: product.id,
            title: product.title || 'Unknown Product',
            brand: product.brand || null,
            category: product.category || 'General',
            price: product.current_price ? parseFloat(product.current_price) : null,
            platform: product.platform || '',
            productUrl: product.product_url,
            verdict: 'unanalyzed' as const,
            riskScore: null,
            riskBreakdown: null,
            warnings: ['Analysis failed — verify product URL'],
            confidence: 0,
            commissionRate: null,
            cookieDuration: null,
          };
        }
      }));
      productResults.push(...batchResults);
    }

    // === Portfolio-Level Aggregates ===

    const analyzed = productResults.filter(p => p.verdict !== 'unanalyzed');
    const highRisk = analyzed.filter(p => p.verdict === 'replace').length;
    const moderateRisk = analyzed.filter(p => p.verdict === 'review').length;
    const stable = analyzed.filter(p => p.verdict === 'keep').length;
    const unanalyzed = productResults.filter(p => p.verdict === 'unanalyzed').length;

    // Revenue Stability Index: weighted average of all overall scores
    const revenueStabilityIndex = analyzed.length > 0
      ? Math.round(analyzed.reduce((sum, p) => sum + (p.riskScore || 0), 0) / analyzed.length)
      : 0;

    // Merchant concentration: what % come from the top merchant/brand
    const merchantCounts: Record<string, number> = {};
    for (const p of productResults) {
      const key = p.brand || p.platform || 'Unknown';
      merchantCounts[key] = (merchantCounts[key] || 0) + 1;
    }
    const sortedMerchants = Object.entries(merchantCounts).sort((a, b) => b[1] - a[1]);
    const topMerchantEntry = sortedMerchants[0];
    const merchantConcentration = {
      topMerchant: topMerchantEntry?.[0] || 'Unknown',
      percentage: productResults.length > 0
        ? Math.round(((topMerchantEntry?.[1] || 0) / productResults.length) * 100)
        : 0,
    };

    // Average merchant stability
    const avgMerchantStability = analyzed.length > 0
      ? Math.round(analyzed.reduce((sum, p) => sum + (p.riskBreakdown?.merchantRisk || 0), 0) / analyzed.length)
      : 0;

    // Average refund risk (higher = lower risk)
    const avgRefundRisk = analyzed.length > 0
      ? Math.round(analyzed.reduce((sum, p) => sum + (p.riskBreakdown?.refundRisk || 0), 0) / analyzed.length)
      : 0;

    // Average commission durability: commissionRate * cookieDurationDays / 30
    const withCommission = analyzed.filter(p => p.commissionRate != null && p.cookieDuration != null);
    const avgCommissionDurability = withCommission.length > 0
      ? Math.round(
          withCommission.reduce((sum, p) => sum + ((p.commissionRate || 0) * (p.cookieDuration || 1) / 30), 0)
          / withCommission.length
        )
      : 0;

    // Top 3 products by lowest risk score (worst first)
    const topRisks = [...analyzed]
      .sort((a, b) => (a.riskScore || 0) - (b.riskScore || 0))
      .slice(0, 3)
      .map(p => ({
        title: p.title,
        riskScore: p.riskScore,
        warnings: p.warnings || [],
      }));

    // Sort all products: worst first (null riskScore = unanalyzed, goes last)
    const sortedProducts = [...productResults].sort((a, b) => {
      if (a.riskScore == null && b.riskScore == null) return 0;
      if (a.riskScore == null) return 1;
      if (b.riskScore == null) return -1;
      return a.riskScore - b.riskScore;
    });

    const duration = Date.now() - startTime;
    console.log(`[Portfolio Audit] Complete: ${analyzed.length}/${productResults.length} analyzed in ${duration}ms`);
    console.log(`[Portfolio Audit] Stability index: ${revenueStabilityIndex} | stable: ${stable} | review: ${moderateRisk} | replace: ${highRisk}`);

    return c.json({
      portfolioSummary: {
        totalProducts: productResults.length,
        analyzed: analyzed.length,
        highRisk,
        moderateRisk,
        stable,
        unanalyzed,
        revenueStabilityIndex,
        merchantConcentration,
        avgMerchantStability,
        avgRefundRisk,
        avgCommissionDurability,
      },
      products: sortedProducts,
      topRisks,
      meta: { duration, profileConfidence: profile.confidenceScore },
    });
  } catch (error: any) {
    console.error('[Portfolio Audit] Error:', error);
    return c.json({ error: 'Portfolio audit failed', message: error.message }, 500);
  }
});

export default app;
