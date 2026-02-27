# AffiMark Alternative Product Search — Test Report

**Date:** 2026-02-27
**Tested by:** Cloud Agent (autonomous review)
**Branch:** `cursor/alternative-product-agent-review-f0a7`

---

## Executive Summary

The alternative product search system has a **sophisticated architecture** with dual scoring (match + outcome feasibility), semantic reranking, enrichment pipelines, and profile-aware personalization. However, testing reveals **critical issues at every layer** that prevent the system from delivering quality results. The most fundamental problems are:

1. **Product identification frequently fails** — `original_product` is null in stored sessions
2. **Datafeedr returns wildly irrelevant results** — "Weighted Pod" returns $2,000+ slimming machines
3. **Missing database tables** break the profile builder — `connected_accounts` and `affiliate_transactions` return 404
4. **Storefront products are unenriched** — no category, brand, or price data despite 3 products stored
5. **Local dev is broken** — Datafeedr API keys missing from `.dev.vars` / `.env.local.recommended`

---

## Test Flow Executed

### 1. Database State Review (Supabase)

**User tested:** `ignas.kundrotas2014@gmail.com` (user_id: `8acd050f-...`)

| Data Point | Status | Detail |
|---|---|---|
| Profile exists | ✅ | `onboarding_completed: true` |
| Priorities set | ✅ | Product: quality > price > sustainability > reviews > shipping |
| | | Brand: commission > return_policy > customer_service > reputation > payment_speed |
| Storefronts | ⚠️ | 2 storefronts (Amazon, Affiliate) but `product_count: 0` on both |
| Products | ⚠️ | 3 products stored, but NO category/brand/price enrichment |
| Social links | ✅ | YouTube, Facebook, Instagram, TikTok (Shea Whitney) |
| Product profile | ⚠️ | `confidence_score: 40` (priorities only — social/storefront empty) |
| Finder sessions | ✅ | 32 sessions stored |

**Critical finding:** The user product profile has:
- `dominant_categories: []` — empty
- `top_brands: []` — empty
- `avg_price_point: 0` — zero
- `preferred_networks: []` — empty
- `content_categories: []` — empty
- `social_platforms: []` — empty

This means the search system has **zero storefront/social context** to personalize with. The entire C-component of the match score (category alignment, brand familiarity, price fit, network affinity) defaults to neutral/50.

### 2. Profile Builder Analysis

The profile builder (`profile-builder.ts`) queries two tables that **don't exist** in the Supabase schema:
- `connected_accounts` → 404
- `affiliate_transactions` → 404

The schema uses `user_storefronts` and `user_storefront_products` instead, but the profile builder doesn't query these. This is why the profile has 0 context.

### 3. Previous Search Results Analysis

Analyzed the 2 most recent successful searches with stored alternatives:

#### Test A: Ulta.com "Weighted Pod for Your Body"

**Input:** `https://www.ulta.com/p/weighted-pod-your-body-pimprod2051635?...`

| # | Alternative Returned | Price | Category | Relevant? |
|---|---|---|---|---|
| 1 | Korea Slimming Product Anti Cellulite Fat Removal Machine | $2,090 | Slimming Machine | ❌ |
| 2 | Multi-Functional Painless Fat Reduction Cryo Machine | £3,258 | Slimming Machine | ❌ |
| 3 | Professional LLLT 10D MaxLipo Body Slimming Machine | $4,854 | Slimming Machine | ❌ |
| 4 | Desktop EMSzero EMS Sculpt Weight Loss Machine | £2,428 | Slimming Machine | ❌ |
| 5 | EMSzero EMS Sculpting Muscle Building Machine | £2,428 | Slimming Machine | ❌ |

**Verdict: 0/5 relevant.** The user's product is a ~$50 wellness/body pod. All results are $2,000-$5,000 industrial slimming machines from DHgate. All from the same merchant. All in the same wrong category.

#### Test B: Amazon LED Light Strip (ASIN B0CR6ZD61D)

**Input:** `https://www.amazon.com/dp/B0CR6ZD61D?...`

| # | Alternative Returned | Price | Category | Relevant? |
|---|---|---|---|---|
| 1 | Philips Hue Play Gradient Lightstrip for PC | £169 | Electronics; Audio Equipment | ⚠️ Wrong category label |
| 2 | TOPRenddon Micro Bluetooth Speaker LED Light Bulb | $2.67 | Smart Speakers | ❌ |
| 3 | Philips Hue White Lightstrip Plus V4 | £59.84 | Electronics; Audio Equipment | ⚠️ |
| 4 | QIACHIP ZigBee Wifi Smart Lamp Holder | $219 | Power Plug Adapter | ❌ |
| 5 | Tuya GU10 Lamp WiFi Smart Bulb | $187 | Power Plug Adapter | ❌ |

**Verdict: 1-2/5 somewhat relevant.** Philips Hue lightstrips are in the right general space (smart lighting). But: a $2.67 Bluetooth speaker and $187 smart lamp holders are completely wrong. 4/5 products are out of stock. Category labels are wrong ("Audio Equipment" for light strips).

### 4. Local API Testing (Fresh Searches)

Ran 3 searches against local backend:

| Test | Input | Status | Alternatives |
|---|---|---|---|
| Dyson Airwrap (Amazon URL) | `amazon.com/Dyson-Airwrap-Multi-Styler-Complete/dp/B0CB1BYD8Z` | `ready` | **0 results** |
| Sephora Rare Beauty Blush | `sephora.com/product/rare-beauty-soft-pinch-liquid-blush-P97989757` | `ready` | **0 results** |
| Text: "wireless noise cancelling headphones" | Text search | `ready` | **0 results** |

**Root cause:** `DATAFEEDR_ACCESS_ID` and `DATAFEEDR_SECRET_KEY` are not in `.env.local.recommended` or `.dev.vars`, so the search silently returns `[]`.

### 5. Intent Analysis Quality

| URL | Extracted searchQuery | Category | Confidence | Quality |
|---|---|---|---|---|
| Amazon Dyson Airwrap (slug URL) | "Dyson Airwrap Multi Styler Complete" | General | 50 | ⚠️ Category "General" instead of "Beauty" |
| Sephora Rare Beauty | "rare beauty by selena gomez soft pinch liquid blus" | General | 30 | ❌ Low confidence, wrong category |
| Amazon bare ASIN (no slug) | Falls to ASIN lookup chain | General | 10-50 | ⚠️ Depends on API availability |

---

## Root Cause Analysis

### CRITICAL — Category 1: Product Identification

| Issue | Impact | Location |
|---|---|---|
| Amazon URLs without slug: all enrichment methods fail sequentially (Rainforest → Keepa → slug → scrape → Datafeedr → AI ASIN) with no guarantee any succeed | Product not identified → bad search query → irrelevant results | `product-intent-analyzer.ts` |
| Non-Amazon URLs: AI analysis has low confidence because it can only read URL structure, not page content | Category defaults to "General", query is unreliable | `product-intent-analyzer.ts:analyzeWithAI()` |
| `original_product` is null in ALL stored sessions | No ground truth to compare alternatives against | `finder-routes.ts` — never populated |

### CRITICAL — Category 2: Search Relevance (Datafeedr)

| Issue | Impact | Location |
|---|---|---|
| Datafeedr `name LIKE` is pure keyword matching — no semantic understanding | "weighted pod" matches "weight loss" in industrial machines | `datafeedr-client.ts:buildQueryArray()` |
| No in-stock filtering applied in some code paths | OOS products shown as alternatives | `multi-network-search.ts` |
| No minimum semantic similarity threshold | Products with 28-29 match scores shown to users | `multi-network-search.ts` combined threshold too low |
| DHgate products dominate results | Low-quality marketplace items crowd out reputable alternatives | No merchant quality filtering |
| Price band filtering uses avgPricePoint=0 (no user data) → no price filtering at all | $2,000 results for $50 products | `multi-network-search.ts:searchViaDatafeedr()` |

### CRITICAL — Category 3: Profile Builder Broken

| Issue | Impact | Location |
|---|---|---|
| Queries `connected_accounts` table — doesn't exist | Profile has no social platform data | `profile-builder.ts` |
| Queries `affiliate_transactions` table — doesn't exist | Profile has no storefront context | `profile-builder.ts` |
| `user_storefront_products` exist (3 rows) but are never used by profile builder | Wasted onboarding data | Gap between schema and code |
| `user_social_links` exist (4 rows) but never queried by profile builder | Social context always empty | Gap between schema and code |
| `confidence_score: 40` — only priorities contribute | Search personalization severely degraded | Cascading from above |

### HIGH — Category 4: Scoring & Filtering

| Issue | Impact | Location |
|---|---|---|
| Combined threshold too low (15-20 for low-confidence profiles) | Garbage products pass the quality gate | `multi-network-search.ts` |
| `categoriesMatch()` has broad alias groups but intent category is often "General" | Category gate doesn't fire when it should | `multi-network-search.ts:categoriesMatch()` |
| White-label penalty (-15) too small | DHgate products still dominate despite quality user priorities | `multi-network-search.ts:calculateProfileMatchScore()` |
| All match scores cluster at 28-29 | No meaningful differentiation | Scoring formula |
| `excludeOriginalBrand` defaults true but brand often unknown | Doesn't help when brand extraction fails | `finder-routes.ts` |

### MEDIUM — Category 5: Environment & DevX

| Issue | Impact | Location |
|---|---|---|
| Datafeedr API keys missing from recommended env files | Local dev returns 0 results silently | `.env.local.recommended` |
| `KEEPA_API_KEY` not in env file | One enrichment path always fails | `.dev.vars` |
| No error surfacing when Datafeedr call fails | Developers can't diagnose issues | `multi-network-search.ts` |
| Supabase logs show 404s for nonexistent tables | Confusing error noise | Profile builder |

---

## Recommended Fixes (Priority Order)

### P0 — Must Fix (Search is broken without these)

1. **Fix profile builder to use existing tables.**
   Change `connected_accounts` → `user_social_links` and `affiliate_transactions` → `user_storefront_products`. The data is there, the code just queries the wrong tables.

2. **Add product page scraping for non-Amazon URLs.**
   Currently non-Amazon URLs rely on URL structure parsing, which is unreliable. Add a fetch+scrape step (like the Amazon enrichment) to get the actual product title from any product page. Use `<title>`, `og:title`, or JSON-LD.

3. **Use the original product's price as context for search.**
   When intent analysis identifies a price (from Rainforest, scrape, or Datafeedr lookup), pass it to `searchViaDatafeedr()` as a price anchor. Filter alternatives to ±200% of the original price. This alone would prevent $2,000 machines appearing for $50 products.

4. **Add Datafeedr credentials to `.env.local.recommended`.**
   Add `DATAFEEDR_ACCESS_ID` and `DATAFEEDR_SECRET_KEY` placeholder entries so local development works.

### P1 — High Priority (Search quality)

5. **Raise semantic similarity minimum threshold.**
   Products with embedding similarity below 40 should be filtered out, not just penalized. The current system lets products with matchScore=28 through.

6. **Increase white-label merchant penalty.**
   Change DHgate/Temu/AliExpress penalty from -15 to -30 or add a hard block when user's top priority is quality/brand_recognition.

7. **Add merchant diversity constraint.**
   Current `maxPerMerchant: 2` still allows 2 DHgate products. When quality is top priority, reduce to `maxPerMerchant: 1` for white-label merchants.

8. **Filter out-of-stock products more aggressively.**
   Many results show `inStock: false`. OOS products should not appear in the top 5 unless fewer than 5 in-stock alternatives exist.

9. **Populate `original_product` in finder sessions.**
   The backend returns intent data but never stores it as `original_product`. This loses the ground truth for quality evaluation.

### P2 — Important (User experience)

10. **Enrich storefront products during onboarding.**
    The 3 products from Linktree scan have no category/brand/price. Run `analyzeProductTitle()` on them during the magic onboarding flow.

11. **Add category inference from intent to search.**
    When intent says "Beauty & Health", add a Datafeedr category filter to exclude "Electronics > Slimming Machine" type results.

12. **Surface search failures clearly.**
    When Datafeedr returns 0 relevant results, tell the user "We couldn't find good alternatives for this product" instead of showing nothing.

13. **Add product name fallback in UI.**
    When URL-based identification fails, the UI should immediately ask "What product is this?" rather than showing empty results.

---

## What I Need From You to Run a Full Live Test

To conduct a proper end-to-end test through the deployed production system (not just local), I need:

1. **Datafeedr API credentials** (`DATAFEEDR_ACCESS_ID` and `DATAFEEDR_SECRET_KEY`) — these are required for the product search to return any results locally.

2. **A test Linktree URL** — a real creator's link-in-bio URL to test the full onboarding scan flow. I can use the existing Shea Whitney data already in the system.

3. **3-5 product URLs to test** — specific product URLs that represent your target use cases:
   - An Amazon product (with ASIN in URL)
   - A Sephora/Ulta beauty product
   - An LTK/ShopMy product link
   - A fashion product (Zara, H&M, etc.)
   - A tech product (direct brand site)

4. **Access to Cloudflare Worker logs** — I couldn't authenticate `wrangler` to see production logs. Either deploy the latest code or provide Cloudflare API credentials.

5. **Expected behavior baseline** — What would "good" alternatives look like for your test products? This helps me evaluate whether results meet quality standards.

---

## Architecture Assessment

The codebase is well-structured with clear separation of concerns:
- Intent analysis → Profile building → Search → Enrichment → Scoring → Filtering → Diversity selection
- The enrichment pipeline (static + dynamic) is sophisticated
- KPI-based scoring tied to user priorities is the right approach
- Semantic reranking via embeddings is excellent design

The core problems are **data pipeline gaps** (profile builder queries wrong tables) and **search relevance** (Datafeedr returns too many irrelevant results that pass through weak filters). Fixing these 4-5 issues would dramatically improve quality.
