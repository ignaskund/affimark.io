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
import { checkBudget, logOperationCost } from '../services/cost-governor';
import type { Env } from '../index';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors({
  origin: (origin) => {
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) return origin;
    const allowed = ['affimark.io', 'www.affimark.io', 'affimark-frontend.vercel.app'];
    if (origin && allowed.some(d => origin.includes(d))) return origin;
    // Reject unknown browser origins; server-to-server calls without Origin still work
    return null;
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

    // Verify the userId exists in the database (prevents unauthorized enumeration
    // when the backend is called directly, bypassing the authenticated frontend proxy)
    const supabaseUrl = (c.env as any).SUPABASE_URL;
    const supabaseKey = (c.env as any).SUPABASE_SERVICE_KEY;
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    };
    const userCheck = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=id`,
      { headers }
    );
    const users: any[] = userCheck.ok ? await userCheck.json() : [];
    if (!Array.isArray(users) || users.length === 0) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check cost budget before running expensive batch scoring
    const budgetCheck = await checkBudget(userId, 'portfolio_audit', c.env);
    if (!budgetCheck.allowed) {
      return c.json({ error: budgetCheck.message }, 429);
    }

    console.log(`[Portfolio Audit] Starting audit for user ${userId}`);

    // Load creator profile (for context — priorities, storefronts, social)
    const profile = await getCreatorProfile(userId, c.env);

    // Fetch all products with their IDs (getCreatorProfile doesn't return IDs)
    const productsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&select=id,title,brand,category,current_price,platform,product_url&limit=200`,
      { headers }
    );
    if (!productsRes.ok) {
      const errText = await productsRes.text().catch(() => 'unknown');
      console.error(`[Portfolio Audit] Supabase products query failed (${productsRes.status}): ${errText}`);
      return c.json({ error: 'Failed to fetch products', details: errText }, 502);
    }
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

    // Revenue Stability Index: revenue-weighted average of risk scores.
    // Weight = price × commissionRate (proxy for earnings contribution).
    // Products with unknown price/commission fall back to weight=1 (equal weight).
    const revenueStabilityIndex = (() => {
      if (analyzed.length === 0) return 0;
      let weightedSum = 0;
      let totalWeight = 0;
      for (const p of analyzed) {
        const price = p.price || 0;
        const rate = p.commissionRate || 0;
        const weight = price > 0 && rate > 0 ? price * rate : 1;
        weightedSum += (p.riskScore || 0) * weight;
        totalWeight += weight;
      }
      return Math.round(weightedSum / totalWeight);
    })();

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

    // Log cost after successful audit — include product count for observability
    await logOperationCost(userId, 'portfolio_audit', { tokensUsed: analyzed.length }, c.env);

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

/**
 * POST /api/portfolio/add-product
 * Adds a product URL to the user's portfolio for risk analysis.
 * Used when the onboarding scanner only captured storefront-level links.
 */
app.post('/add-product', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, productUrl, title } = body;

    if (!userId) return c.json({ error: 'userId is required' }, 401);
    if (!productUrl) return c.json({ error: 'productUrl is required' }, 400);

    const supabaseUrl = (c.env as any).SUPABASE_URL;
    const supabaseKey = (c.env as any).SUPABASE_SERVICE_KEY;
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    // Identify the product to get title, brand, category
    let productTitle = title || '';
    let brand = null;
    let category = null;

    try {
      const identified = await identifyProduct(productUrl, c.env);
      if (identified.confidence >= 20) {
        productTitle = productTitle || identified.title;
        brand = identified.brand;
        category = identified.category;
      }
    } catch (e) {
      console.warn('[Portfolio] Product identification failed:', e);
    }

    // Find the user's first storefront to link to
    const sfRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefronts?user_id=eq.${userId}&limit=1`,
      { headers }
    );
    const storefronts = await sfRes.json();
    const storefrontId = Array.isArray(storefronts) && storefronts.length > 0
      ? storefronts[0].id : null;

    // Insert into user_storefront_products
    const insertRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefront_products`,
      {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          user_id: userId,
          storefront_id: storefrontId,
          product_url: productUrl,
          title: productTitle || 'Unknown Product',
          brand,
          category,
          platform: 'manual',
        }),
      }
    );

    if (!insertRes.ok) {
      const err = await insertRes.text();
      console.error('[Portfolio] Insert failed:', err);
      return c.json({ error: 'Failed to add product' }, 500);
    }

    const inserted = await insertRes.json();
    console.log(`[Portfolio] Added product: "${productTitle}" for user ${userId}`);

    return c.json({
      success: true,
      product: Array.isArray(inserted) ? inserted[0] : inserted,
    });
  } catch (error: any) {
    console.error('[Portfolio Add] Error:', error);
    return c.json({ error: 'Failed to add product', message: error.message }, 500);
  }
});

/**
 * POST /api/portfolio/scan-storefront
 * Follows a storefront URL (e.g. urlgeni.us/amazon/SheaWhitney), discovers
 * the actual storefront page, and extracts individual product URLs from it.
 * Adds discovered products to user_storefront_products.
 */
app.post('/scan-storefront', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, storefrontUrl } = body;

    if (!userId) return c.json({ error: 'userId is required' }, 401);
    if (!storefrontUrl) return c.json({ error: 'storefrontUrl is required' }, 400);

    console.log(`[Portfolio Scan] Scanning storefront: ${storefrontUrl} for user ${userId}`);

    // Step 1: Follow redirects to get the real URL
    let resolvedUrl = storefrontUrl;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(storefrontUrl, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      clearTimeout(timer);
      resolvedUrl = res.url;
      console.log(`[Portfolio Scan] Resolved: ${storefrontUrl} → ${resolvedUrl}`);
    } catch (e) {
      console.warn('[Portfolio Scan] URL resolution failed, using original:', e);
    }

    // Step 2: Fetch the page and extract product links
    const productUrls: Array<{ url: string; title: string }> = [];
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const pageRes = await fetch(resolvedUrl, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timer);

      if (pageRes.ok) {
        const html = await pageRes.text();
        extractAmazonProductsFromHtml(html, productUrls);
        console.log(`[Portfolio Scan] Static scrape found ${productUrls.length} product URLs`);
      }
    } catch (e) {
      console.warn('[Portfolio Scan] Static page fetch failed:', e);
    }

    // If static scrape found nothing, try Browser Rendering for JS-heavy pages
    if (productUrls.length === 0 && (c.env as any).BROWSER) {
      try {
        const puppeteer = await import('@cloudflare/puppeteer');
        const browser = await puppeteer.default.launch((c.env as any).BROWSER);
        const page = await browser.newPage();
        await page.goto(resolvedUrl, { waitUntil: 'networkidle2', timeout: 20000 });
        const html = await page.content();
        await browser.close();

        extractAmazonProductsFromHtml(html, productUrls);
        console.log(`[Portfolio Scan] Browser Rendering found ${productUrls.length} product URLs`);
      } catch (e: any) {
        console.warn('[Portfolio Scan] Browser Rendering failed:', e?.message || e);
      }
    }

    if (productUrls.length === 0) {
      return c.json({
        message: 'No product URLs found on this storefront page. The page may require JavaScript rendering.',
        productsFound: 0,
        resolvedUrl,
      });
    }

    // Step 3: Add discovered products to user_storefront_products
    const supabaseUrl = (c.env as any).SUPABASE_URL;
    const supabaseKey = (c.env as any).SUPABASE_SERVICE_KEY;
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };

    // Get storefront ID
    const sfRes = await fetch(
      `${supabaseUrl}/rest/v1/user_storefronts?user_id=eq.${userId}&limit=1`, { headers }
    );
    const storefronts = await sfRes.json();
    const storefrontId = Array.isArray(storefronts) && storefronts.length > 0 ? storefronts[0].id : null;

    let added = 0;
    for (const product of productUrls.slice(0, 50)) {
      try {
        // Check if already exists
        const checkRes = await fetch(
          `${supabaseUrl}/rest/v1/user_storefront_products?user_id=eq.${userId}&product_url=eq.${encodeURIComponent(product.url)}&select=id&limit=1`,
          { headers }
        );
        const existing = await checkRes.json();
        if (Array.isArray(existing) && existing.length > 0) continue;

        await fetch(`${supabaseUrl}/rest/v1/user_storefront_products`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            user_id: userId,
            storefront_id: storefrontId,
            product_url: product.url,
            title: product.title || 'Discovered Product',
            platform: 'amazon',
          }),
        });
        added++;
      } catch (e) {
        console.warn('[Portfolio Scan] Failed to add product:', e);
      }
    }

    console.log(`[Portfolio Scan] Added ${added} new products for user ${userId}`);

    return c.json({
      message: `Discovered ${productUrls.length} products, added ${added} new ones`,
      productsFound: productUrls.length,
      productsAdded: added,
      resolvedUrl,
    });
  } catch (error: any) {
    console.error('[Portfolio Scan] Error:', error);
    return c.json({ error: 'Scan failed', message: error.message }, 500);
  }
});

function extractAmazonProductsFromHtml(html: string, productUrls: Array<{ url: string; title: string }>) {
  const amazonPattern = /https?:\/\/(?:www\.)?amazon\.[a-z.]+\/(?:[^"'\s]*\/)?dp\/([A-Z0-9]{10})[^"'\s]*/gi;
  const matches = html.matchAll(amazonPattern);
  const seenAsins = new Set(productUrls.map(p => {
    const m = p.url.match(/\/dp\/([A-Z0-9]{10})/i);
    return m ? m[1] : '';
  }));

  for (const match of matches) {
    const asin = match[1];
    if (seenAsins.has(asin)) continue;
    seenAsins.add(asin);
    productUrls.push({ url: `https://www.amazon.com/dp/${asin}`, title: '' });
  }

  const linkPattern = /<a[^>]*href="([^"]*\/dp\/([A-Z0-9]{10})[^"]*)"[^>]*>([^<]*)</gi;
  const linkMatches = html.matchAll(linkPattern);
  for (const m of linkMatches) {
    const titleText = m[3]?.trim();
    const asin = m[2];
    if (titleText && titleText.length > 5 && asin) {
      const existing = productUrls.find(p => p.url.includes(asin));
      if (existing && !existing.title) existing.title = titleText;
    }
  }
}

export default app;
