# AffiMark Alternative Agent Dataflow Audit Report

**Date:** 2026-03-13
**Test URLs:**
- Linktree 1: `https://linktr.ee/aprilldobrowski`
- Linktree 2: `https://linktr.ee/laneysites`
- Linktree 3: `https://linktr.ee/angtillson5`
- Product: `https://orthomol-sport.de/products/orthomol-sport-perform`

---

## Executive Summary

The AffiMark alternative search agent has **critical vulnerabilities** in its dataflow that prevent user context from being fully utilized. The system has excellent architecture (profile builder, dual scoring, KPI system) but several silent failure modes cause it to operate without personalization data, producing generic/empty results.

**Severity**: 5 critical, 6 major, 4 minor issues found.

---

## CRITICAL Issues (Fix ASAP)

### 1. Profile Builder Silent Supabase Failure
**Severity:** CRITICAL | **Impact:** 100% of personalization lost
**Component:** `backend/src/services/profile-builder.ts` + `backend/src/mcp/tools.ts`

**Finding:** When Supabase REST API queries fail (invalid key, network timeout, or auth error), the profile builder returns empty arrays for ALL data (priorities, socials, storefronts) with `confidenceScore: 0`. No error is logged, no fallback is triggered.

**Evidence:**
- Test user `8acd050f` has 5 product priorities, 5 brand priorities, 4 social accounts, 2 storefronts, 3 products in DB
- Profile builder returned: `confidenceScore: 0`, empty arrays for everything
- Root cause: `getUserPriorities()`, `analyzeSocialAccounts()`, `analyzeStorefronts()` all swallow fetch errors

**Impact:**
- Search agent operates without ANY user context
- All 16 KPIs score at neutral defaults (50)
- Brand priorities (commission, cookie_duration, etc.) are ignored
- Product priorities (quality, price, etc.) are ignored
- Preferred networks, price range, brand familiarity — all lost

**Fix Applied:**
- Added error logging for Supabase query failures in `profile-builder.ts`
- Added fallback: when fresh build returns empty but cached profile has data, return cached
- Added guard: don't overwrite cached profile with empty data
- Added error checking in `mcp/tools.ts` `getCreatorProfile`

**Remaining work:** Need retry logic + circuit breaker for Supabase queries.

---

### 2. Search Query Generation Failure for Non-English/Specialty Products
**Severity:** CRITICAL | **Impact:** 0 relevant alternatives found
**Component:** `backend/src/mcp/agent.ts` → `generateProductTypeQueries()`

**Finding:** For the product URL `orthomol-sport.de/products/orthomol-sport-perform`:
- URL slug extraction correctly gets "orthomol sport perform"
- Brand stripping correctly removes "orthomol" → leaves "sport perform"
- But the AI distillation fails to convert "sport perform" to useful queries like "sports supplement" or "sports nutrition drink"
- Datafeedr returns 200 candidates for "sport perform" but ALL are generic sports gear (shoes, equipment), not supplements
- The semantic filter correctly rejects all 200 as irrelevant to nutrition

**Search strategies generated:**
1. `"sport perform"` → 100 candidates, 0 relevant (all sports gear)
2. `"perform"` → 100 candidates, 0 relevant (too generic)

**Comparison with v1 search:** Category search "sports nutrition supplement" finds 5 excellent alternatives via the same Datafeedr API.

**Root cause:** The AI distillation prompt doesn't receive enough context about the product domain. "sport perform" is ambiguous — the AI needs the category hint "Health & Nutrition" and the full product context to produce "sports supplement".

**Fix needed:**
- Pass the inferred category to the AI distillation prompt more prominently
- When the product category is "Health & Nutrition" or "Sports Nutrition", explicitly steer search queries toward supplement-related terms
- Add a fallback strategy: if initial queries return 0 relevant results, generate broader category-based queries using the category name itself

---

### 3. Social Account Extraction Inconsistent Across Linktree Profiles
**Severity:** MAJOR (downgraded from CRITICAL) | **Impact:** Some creators lose social context
**Component:** `backend/src/api/migration-routes.ts` + `MigrationScraper`

**Finding:** Social account extraction works for creators with visible social links on their Linktree pages, but fails when Linktree doesn't expose social URLs in the scraped HTML.

**Evidence:**
- `linktr.ee/aprilldobrowski`: 3 social accounts found (Instagram, TikTok, YouTube) ✅
- `linktr.ee/laneysites`: 0 social accounts found ⚠️ (social links may be in Linktree's social icons, not main links)
- `linktr.ee/angtillson5`: 2 social accounts found (Instagram, TikTok) ✅

**Impact:**
- Creator 2 loses social context → no content category inference, no audience targeting
- Profile confidence drops by 30% for affected creators

**Root cause:** Linktree has two types of social links: (1) regular links in the link list, and (2) social icon buttons at the top/bottom of the profile. The scraper only extracts type 1. Type 2 requires parsing the Linktree page structure more carefully.

---

### 4. Portfolio Audit Returns 0 Products
**Severity:** CRITICAL | **Impact:** Portfolio audit feature non-functional
**Component:** `backend/src/routes/portfolio-routes.ts`

**Finding:** `POST /api/portfolio/audit` returns `totalProducts: 0` even though the test user has 3 products in `user_storefront_products`.

**Root cause:** Same as #1 — the audit endpoint uses `getCreatorProfile()` which calls Supabase REST API. When Supabase is unreachable, no products are returned. The audit should directly query the products table as a fallback.

---

### 5. Product Identification Weak for European/Non-Amazon URLs
**Severity:** CRITICAL | **Impact:** Products misidentified → wrong category → wrong alternatives
**Component:** `backend/src/mcp/tools.ts` → `identifyProduct()`

**Finding:** For `orthomol-sport.de/products/orthomol-sport-perform`:
- Category: "General" (should be "Health & Nutrition" or "Sports Nutrition")
- Brand: "orthomol sport perform" (entire title used as brand)
- Confidence: 50% (from URL slug, AI strategies not triggered)
- No price extracted

**Fix Applied:**
- Added "Health & Nutrition" category with supplement/nutrition keywords
- Fixed brand extraction: reject brand when it equals the full title
- Added supplement-related words to product word exclusions
- Updated AI slug parsing prompt with Health & Nutrition category

**After fix:**
- Category: "Health & Nutrition" ✅
- Brand: "orthomol" ✅
- But search queries still poor → see issue #2

---

## MAJOR Issues

### 6. Storefront Product Data Quality
**Impact:** Avg price point = 0, no brands, no categories
**Component:** Onboarding → `user_storefront_products`

**Finding:** Test user's 3 products have:
- `brand: null`, `category: null`, `current_price: null` for ALL products
- Product titles are generic: "TIKTOK/REELS links✨", "My Amazon Storefront", "Vegamour (code: SHEA20)"

These are not actual product names — they're storefront link labels. The product enrichment endpoint (`POST /api/finder/enrich-products`) should be called post-onboarding to extract actual product data, but it appears this step is missed.

**Impact:**
- `storefrontContext.avgPricePoint` = 0 → price band targeting disabled
- `storefrontContext.topBrands` = [] → brand familiarity scoring disabled
- `storefrontContext.dominantCategories` = generic → category alignment weak

### 7. Price Extraction Inconsistency from Linktree Scraping
**Impact:** Product price data unreliable
**Component:** `MigrationScraper`

**Finding:** Prices from Linktree scraping are inconsistent:
- Some show `"$$50.99$50.99"` (duplicated dollar signs)
- Some show `"This item may be unavailable..."` as the price
- Most show `"?"` for price

### 8. Storefront Metadata Missing
**Impact:** Display names and URLs not captured
**Component:** `MigrationScraper` → storefront extraction

**Finding:** Storefronts extracted from Linktree have:
- `display_name: "?"` (should be the creator's storefront name)
- `storefront_url: "?"` (should be the actual storefront URL)

### 9. V2 Agent Ignores Product Category When Generating Search Queries
**Impact:** Search returns irrelevant products
**Component:** `backend/src/mcp/agent.ts` → `generateSearchStrategies()`

**Finding:** The search strategies only use `productTypeQueries` (stripped brand title) but don't leverage the inferred category. When the category is "Health & Nutrition" but the query is "sport perform", Datafeedr returns sports equipment.

**Fix needed:** Add a category-anchored search strategy that combines the category name with the product type.

### 10. Dynamic Enrichment Fails Silently
**Impact:** Quality/reviews KPIs show proxy data
**Component:** `backend/src/services/enrichment/product-page-enricher.ts`

**Finding:** Dynamic enrichment (fetching product pages for real ratings/reviews) runs for top results but often fails for European/JS-heavy sites. When it fails, KPIs like "Quality & Durability" and "Customer Reviews" show proxy scores based on brand tier rather than actual data.

### 11. Cost Governor Always Returns "Free" Tier
**Impact:** No budget enforcement
**Component:** `backend/src/services/cost-governor.ts`

**Finding:** `getUserBudget()` is TODO and always returns `free` tier ($1/day, $10/mo). No actual cost tracking is enforced.

---

## MINOR Issues

### 12. Inconsistent API Response Shapes Between V1 and V2 Search
The v1 search (`/api/finder/search`) and v2 search (`/api/finder/search-v2`) return different response shapes. V2 normalizes fields but some field names differ (`matchScore` vs `combinedScore`, `productPriorityKpis` vs `productKpis`).

### 13. Environment Variable Naming Mismatch
`NEXT_PUBLIC_API_URL` is used in frontend code but `.env.local.recommended` only defines `NEXT_PUBLIC_BACKEND_URL`.

### 14. Datafeedr Credentials Missing from .env.local.recommended
The `backend/.env.local.recommended` has placeholder values for `DATAFEEDR_ACCESS_ID` and `DATAFEEDR_SECRET_KEY`. The real values are in `.env.example` but not in the recommended file.

### 15. Product Intent Analyzer Different from MCP Tools
`/api/finder/intent/analyze` uses `product-intent-analyzer.ts` which has different category inference logic than `mcp/tools.ts`. This means the same product may get different categories depending on which path is used.

---

## Recommendations for UX Enhancement

### Immediate (Sprint 1)

1. **Show profile confidence on dashboard** — Display the profile confidence score (0-100) so users know their search quality. Add a "Complete your profile" CTA when confidence < 70.

2. **Auto-trigger product enrichment** — After onboarding, automatically call `/api/finder/enrich-products` to extract real product data (brand, category, price) from stored URLs.

3. **Add category-based fallback search** — When product-type queries return 0 relevant results, automatically generate a category-based query (e.g., "sports supplement" for Health & Nutrition products).

4. **Show search query transparency** — In the product finder UI, show users what queries were sent to the search engine. This builds trust and helps debug poor results.

### Medium-term (Sprint 2-3)

5. **Implement Supabase query retry with exponential backoff** — Add retry logic (3 attempts with 1s, 2s, 4s delays) for all Supabase REST API calls.

6. **Add circuit breaker for external services** — When Datafeedr, OpenAI, or Supabase are down, gracefully degrade with cached data and clear error messages.

7. **Fix social account extraction from Linktree** — The scraper should classify Instagram, TikTok, YouTube, etc. links as social accounts, not just generic links.

8. **Unify product identification logic** — Merge `product-intent-analyzer.ts` and `mcp/tools.ts` identification into a single pipeline to ensure consistent results.

9. **Add search quality metrics** — Track: % of searches returning >0 alternatives, avg semantic score, avg KPI confidence level, category match rate.

### Long-term (Sprint 4+)

10. **Multi-language product identification** — The orthomol example shows that German/EU product sites need better handling. Consider: translated product pages, multi-language scraping, EU-specific product databases.

11. **Price normalization across currencies** — Products from EU stores have prices in EUR but the system defaults to USD. Implement automatic currency detection and conversion.

12. **Onboarding quality gate** — Don't let users proceed to the dashboard until at least 3 products have been enriched with real brand/category/price data.

---

## Test Summary

| Test | Status | Details |
|------|--------|---------|
| Profile Builder (test user) | ❌ FAIL | Returns empty due to Supabase connectivity |
| MCP Creator Profile | ⚠️ DEGRADED | Loads from cache when available, empty on cold start |
| Product Identification (orthomol) | ✅ FIXED | Category: Health & Nutrition, Brand: orthomol |
| Datafeedr Search (orthomol) | ❌ FAIL | 200 candidates found, 0 relevant (query quality issue) |
| Portfolio Audit | ❌ FAIL | 0 products due to Supabase connectivity |
| Linktree Scrape (creator 1) | ✅ PASS | 3 socials, 3 storefronts, 8 products |
| Linktree Scrape (creator 2) | ⚠️ PARTIAL | 0 socials (icon-based), 2 storefronts, 2 products |
| Linktree Scrape (creator 3) | ✅ PASS | 2 socials, 2 storefronts, 3 products |
| V1 Category Search | ✅ PASS | "sports nutrition supplement" → 5 alternatives |
| KPI System | ✅ PASS | 16 KPIs compute correctly with enrichment data |
| Outcome Feasibility Scorer | ✅ PASS | 4 risk signals computed correctly |
| Semantic Ranker | ✅ PASS | Correctly rejects irrelevant products |

---

## Fixes Applied in This Commit

1. **Profile builder fallback** — Returns cached profile when fresh build fails
2. **Profile builder guard** — Won't overwrite cached profile with empty data
3. **Supabase error logging** — All query failures now logged with status codes
4. **Product identification** — Added Health & Nutrition category with supplement keywords
5. **Brand extraction** — Prevented using entire title as brand name
6. **Category inference** — Added sports nutrition, supplements, vitamins to category rules
7. **AI slug parsing** — Updated prompt to include Health & Nutrition category
8. **Outcome feasibility** — Added nutrition/supplements as low refund risk
