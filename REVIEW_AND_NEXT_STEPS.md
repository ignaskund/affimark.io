# AffiMark — Main Branch Review & Further Development Steps

**Date:** March 2026
**Branch reviewed:** `main` (commit `9db84f4`)
**Scope:** Verify implementation plan execution + chart next steps for a comprehensive alternative product search agent

---

## Part 1: Implementation Plan Execution Review

### Scorecard

| Phase | Planned | Done | Partial | Not Done | Score |
|-------|---------|------|---------|----------|-------|
| **0: Cleanup** | 6 categories | 4 | 0 | 2 | 67% |
| **1: Critical Bugs** | 4 items | 3 | 1 | 0 | 88% |
| **2: Agent Pipeline** | 6 items | 4 | 1 | 2 | 58% |
| **3: Scoring Integrity** | 3 items | 2 | 1 | 0 | 83% |
| **4: Frontend UX** | 7 items | 4 | 1 | 2 | 64% |
| **5: Infrastructure** | 7 items | 4 | 1 | 2 | 64% |
| **Overall** | **33 items** | **21** | **5** | **6** | **71%** |

---

### Phase 0: Cleanup — 67%

**Done:**
- `api.ts` reduced to 3 route mounts (finder, portfolio, migration)
- `index.ts` simplified, no scheduled handler
- Cron triggers removed from `wrangler.toml`
- Most frontend pages deleted (18/20 categories)
- Most backend API route files deleted
- `backend/src/services/verifier/` deleted
- `backend/src/workers/` deleted

**Not Done — 13 orphaned file groups still present:**

| Location | Files | Why It Matters |
|----------|-------|----------------|
| `backend/src/routes/agent-routes.ts` | 1 | Dead code, not mounted |
| `backend/src/services/agents/` | 6 | Dead code (context-aware-agent, brand-research, etc.) |
| `backend/src/merchants/` | 7 | Dead code (adapters for Amazon, Shopify, Gumroad, etc.) |
| `backend/src/services/` (non-core) | ~20 | Dead services: health-checker, csv-importer, scanner, commission-optimizer, waterfall-router, redirect-link-service, etc. |
| `frontend/app/onboarding/signup/` | 1 | Legacy onboarding page |
| `frontend/app/onboarding/account-type/` | 1 | Legacy onboarding page |
| `frontend/components/chat/` | 3 | Chat components (non-core) |
| `frontend/components/shop/` | 3 | Shop components (non-core) |
| `frontend/components/smartwrappers/` | 3 | SmartWrapper components (non-core) |
| `frontend/components/inventory/` | 3 | Inventory components (non-core) |
| `frontend/components/scanner/` | 3 | Scanner components (non-core) |
| `frontend/components/tax-export/` | 2 | Tax export components (non-core) |
| `frontend/hooks/useVerifier.ts` | 1 | Verifier hook (non-core) |
| `frontend/types/verifier.ts` | 1 | Verifier types (non-core) |
| `frontend/lib/context-aware-agent-client.ts` | 1 | Agent client (non-core) |
| `frontend/lib/stripe-config.ts` | 1 | Stripe config (non-core) |
| `frontend/lib/api/audit-api.ts` | 1 | Link Guard audit API (non-core) |
| `frontend/lib/mcp/` | 3 | MCP clients for TikTok/Twitter/YouTube (non-core) |
| `frontend/app/api/settings/agent/` | 1 | Agent settings route (imports non-existent export) |

---

### Phase 1: Critical Bugs — 88%

| Item | Status | Details |
|------|--------|---------|
| Sign Out button | **DONE** | Wired to `signOut({ callbackUrl: '/' })` |
| Dead links | **PARTIAL** | `/social-accounts` and `/storefronts` fixed. BUT: dashboard links to `/dashboard/settings` while the actual page is at `/settings` (no `/dashboard/settings` route exists). New user welcome links to `/dashboard/storefronts` (deleted). Issues summary links to `/dashboard/revenue-loss` (deleted). |
| Onboarding destination | **DONE** | `handleComplete` routes to `/dashboard`. (Skip still routes to `/dashboard/product-finder`.) |
| Secrets in env templates | **DONE** | Placeholders used throughout |

---

### Phase 2: Agent Pipeline — 58%

| Item | Status | Details |
|------|--------|---------|
| Agent timeout (45s) | **DONE** | `Promise.race` with `AGENT_TIMEOUT_MS = 45000` |
| Degradation indicator | **DONE** | `degradation` field in types, tracked in agent |
| Amazon domain detection | **DONE** | `detectAmazonDomain()` reads URL hostname |
| Supabase `.ok` validation | **PARTIAL** | Done in `tools.ts`; NOT done in `portfolio-routes.ts` (line 77: `productsRes.json()` without `.ok` check) |
| Typed `env` | **NOT DONE** | `env: any` remains in `agent.ts` and `tools.ts` |
| Datafeedr failure distinction | **NOT DONE** | `searchAlternatives` still returns `[]` on error with no way to distinguish from empty results |

---

### Phase 3: Scoring & Data Integrity — 83%

| Item | Status | Details |
|------|--------|---------|
| Division-by-zero guards | **DONE** | All critical locations guarded |
| JSON.parse safety | **PARTIAL** | `safeJsonParse` in `finder-routes.ts`. NOT wrapped in `tools.ts` (lines 69, 73, 96, 97) or `profile-builder.ts` |
| Profile builder price parsing | **DONE** | Filters NaN/invalid prices before averaging |

---

### Phase 4: Frontend UX — 64%

| Item | Status | Details |
|------|--------|---------|
| Dashboard navigation | **DONE** | Portfolio Audit (★), Product Finder in "Risk Intelligence" group |
| QuickActionsGrid | **DONE** | 3 core actions only |
| ProductRiskCard on mobile | **DONE** | Visible in mobile layout |
| Landing page CTAs | **DONE** | All point to working routes |
| Dashboard page | **PARTIAL** | Still has RevenueHeroWidget, UpliftAlert, InsightsPanel (non-core), issues summary linking to deleted `/dashboard/revenue-loss`, "Recent Activity coming soon" placeholder |
| Error retry in Finder | **NOT DONE** | Error banner has dismiss (X) but no Retry button |
| Portfolio audit caching | **NOT DONE** | `PortfolioHealthCard` fetches fresh on every mount |

---

### Phase 5: Infrastructure — 64%

| Item | Status | Details |
|------|--------|---------|
| Build checks re-enabled | **DONE** | `ignoreDuringBuilds: false`, `ignoreBuildErrors: false` |
| Images config | **DONE** | Uses `remotePatterns` |
| CORS tightened | **DONE** | Specific origins, no wildcard |
| Wrangler production config | **DONE** | `[env.production]` with `NODE_ENV = "production"` |
| TypeScript strict mode | **NOT DONE** | `strict: false` in `frontend/tsconfig.json` |
| Unused dependencies | **NOT DONE** | 6 unused deps still in `frontend/package.json`: `@anthropic-ai/sdk`, `@tanstack/react-table`, `cmdk`, `react-day-picker`, `recharts`, `tailwindcss-animate` |
| Backend URL standardized | **PARTIAL** | Two vars still in use: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_BACKEND_URL` |

---

### Build Status

| Check | Result |
|-------|--------|
| `backend: npx tsc --noEmit` | **PASS** (0 errors) |
| `frontend: npx next build` | **FAIL** — 2 issues: (1) `app/api/auth/twitter/callback/route.ts` is an empty file causing "not a module" error. (2) `app/api/settings/agent/route.ts` imports `createSupabaseServerClient` which doesn't exist in `@/lib/supabase-server`. |

---

## Part 2: Remaining Work Before Deployment

These must be addressed before the app can deploy successfully.

### Blocking (Build Failures)

1. **Delete or fix empty file:** `frontend/app/api/auth/twitter/callback/route.ts` — empty file causes TypeScript "not a module" error.
2. **Delete or fix orphan route:** `frontend/app/api/settings/agent/route.ts` — imports non-existent `createSupabaseServerClient`.

### High Priority (Correctness & UX)

3. **Delete remaining orphaned files** — ~60 files across frontend and backend that are dead code. They add confusion, slow builds, and could break if dependencies change.
4. **Fix dashboard dead links:** New user welcome links to deleted `/dashboard/storefronts`. Issues summary links to deleted `/dashboard/revenue-loss`. Dashboard settings links to `/dashboard/settings` but page is at `/settings`.
5. **Simplify dashboard page** — Remove non-core widgets (RevenueHeroWidget uses RPCs that may not exist, UpliftAlert queries `link_optimizations`, Issues summary queries `link_health_issues`). Replace with audit-focused content.
6. **Add `safeJsonParse`** to `backend/src/mcp/tools.ts` and `backend/src/services/profile-builder.ts`.
7. **Add Supabase `.ok` check** in `backend/src/routes/portfolio-routes.ts` before `productsRes.json()`.

### Medium Priority (Quality)

8. **Add Retry button** to Product Finder error state.
9. **Add `sessionStorage` caching** to PortfolioHealthCard (~5 min TTL).
10. **Type `env`** properly in `agent.ts` and `tools.ts` (replace `any` with `Env`).
11. **Distinguish Datafeedr failure** from empty results in `searchAlternatives`.
12. **Remove unused frontend dependencies** (6 packages).
13. **Enable TypeScript strict mode** in frontend.

---

## Part 3: Further Development Steps for a Comprehensive Alternative Product Search Agent

The current agent works but is at MVP quality. Here is a detailed roadmap to make it a best-in-class alternative product search system.

### Tier 1: Agent Intelligence Improvements

#### 1.1 Semantic Product Matching (High Impact)

**Current state:** The agent uses keyword-based queries derived from AI distillation of the product title, falling back to `product.title.slice(0, 50)` when AI fails. Semantic scoring computes cosine similarity via OpenAI embeddings, but only as a reranking signal (35% weight).

**Problem:** Keyword search is brittle. "Dry texture hair spray" might not match "texturizing mist" even though they're the same product type. When AI distillation fails, the title-based fallback often contains brand names that pollute the search.

**Improvement:**
- Use embeddings at the **query generation** stage, not just reranking. Generate an embedding of the identified product, then search Datafeedr with multiple category-anchored queries informed by the embedding's nearest neighbors in a product taxonomy.
- Build a **product type taxonomy** (e.g., Hair Care → Styling → Texture Sprays) and map products into it. Use the taxonomy to generate structurally diverse search queries.
- Implement **negative query filtering**: strip brand names, model numbers, and color variants from search queries to avoid returning the exact same product.

#### 1.2 Multi-Strategy Search Expansion (Medium Impact)

**Current state:** 4 strategies: broad, refined, niche, rescue. Each generates queries and searches Datafeedr.

**Problem:** All strategies use the same data source (Datafeedr). If Datafeedr doesn't index a product category well, all strategies fail.

**Improvement:**
- Add **Awin product feed search** as a secondary data source. Awin has a product search API that covers European merchants well.
- Add **Amazon Product Advertising API** for products where the original was on Amazon — this ensures direct alternatives are available.
- Implement a **source router** that picks the best data source based on the product category and the user's preferred networks.

#### 1.3 Context-Aware Price Intelligence (Medium Impact)

**Current state:** Price range is `originalPrice * 0.3` to `originalPrice * 3.0`, then refined by storefront context.

**Problem:** This is too wide for most categories and too narrow for some. A $15 mascara shouldn't return $45 alternatives. A $200 headphone search shouldn't include $60 earbuds.

**Improvement:**
- Build **category-specific price bands** from the user's existing storefront products. If the user sells 5 beauty products averaging $25, anchor beauty alternatives to $15-$35.
- Implement **tier detection** (budget/mid/premium) from the original product, using price + brand + merchant positioning.
- Weight alternatives by **price proximity** within the tier, not just absolute price.

#### 1.4 Brand Affinity Intelligence (High Impact)

**Current state:** The agent filters OUT the original brand and penalizes white-label merchants (Temu, Wish, etc.). Brand familiarity scoring checks if the alternative brand already exists in the user's storefronts.

**Problem:** The agent doesn't understand brand positioning. It might suggest a mass-market brand as an alternative to a premium brand, or suggest an unknown brand when the user's audience trusts established names.

**Improvement:**
- Build a **brand positioning matrix** that maps brands to tiers (luxury, premium, mid-range, budget, mass-market) per category.
- When the user promotes Brand X (premium headphones), only suggest alternatives from the same tier or adjacent tier.
- Use the user's existing brand portfolio to infer their **brand positioning preference** — if they sell all premium brands, don't suggest budget alternatives even if the commission is higher.

### Tier 2: User Experience Enhancements

#### 2.1 Search Feedback Loop (High Impact)

**Current state:** Users see results and can save alternatives. No mechanism to improve future searches.

**Improvement:**
- Track which alternatives users **save**, **dismiss**, and **click "Find Better Alternative" on** from the portfolio audit.
- Use this signal to adjust future search weights: if a user consistently dismisses low-price alternatives, increase the price proximity weight.
- Implement a simple **thumbs up/down** on each alternative card. Store this as implicit priority refinement.

#### 2.2 Batch Alternative Search from Audit (High Impact)

**Current state:** Users must click "Find Better Alternative" on each product individually, which navigates to the Product Finder.

**Problem:** If a user has 8 REPLACE-verdict products, they need to run 8 separate searches. This is tedious.

**Improvement:**
- Add a **"Find Alternatives for All Risky Products"** button on the portfolio audit page.
- Run batch searches in the background (queue up to 5 concurrent searches).
- Display results in a **comparison table**: original product vs. best alternative, with delta scores.
- Allow one-click **"Replace in Storefront"** (save the alternative to their portfolio).

#### 2.3 Alternative Comparison View (Medium Impact)

**Current state:** Alternatives shown as a card stack. Users swipe through one at a time.

**Problem:** Card stacks are good for discovery but bad for comparison. Users can't see 3 alternatives side by side.

**Improvement:**
- Add a **comparison mode** toggle: Card Stack (default) vs. Comparison Table.
- In table mode, show: Original Product | Alternative 1 | Alternative 2 | Alternative 3.
- Highlight differences: commission rate delta, cookie window, merchant rating, match score.
- Allow sorting by any column.

#### 2.4 Search History & Re-search (Low Impact)

**Current state:** No search history. Users can't revisit previous searches.

**Improvement:**
- Store search sessions with query, results, and user actions.
- Show "Recent Searches" on the Product Finder page.
- Allow re-running a search to see if new alternatives have appeared.

### Tier 3: Data Quality & Coverage

#### 3.1 Enrichment Expansion (High Impact)

**Current state:** Static enrichment covers ~20 affiliate networks and their programs. Dynamic enrichment scrapes product pages for reviews, ratings, and availability.

**Problem:** Many merchants and programs are not in the static database. Enrichment falls back to EU baseline defaults, which makes scores for unknown merchants coarse (everyone gets the same score).

**Improvement:**
- Build an **enrichment cache** in Supabase: when a new merchant/program is encountered, scrape their affiliate terms page and cache the result.
- Integrate **Awin publisher API** to get real commission rates for the user's specific Awin account (if connected).
- Add **Keepa price history** integration: use 90-day price trends to assess demand stability and detect products that are frequently discounted (sign of weak demand).

#### 3.2 Category Taxonomy Refinement (Medium Impact)

**Current state:** Products are categorized into broad categories (e.g., "Beauty", "Electronics", "Fashion"). The `General` category bypasses the category gate entirely.

**Problem:** "Beauty" is too broad — "moisturizer" and "hair dryer" are both "Beauty" but shouldn't be alternatives to each other. The `General` category leak is a quality issue.

**Improvement:**
- Implement **2-level categorization**: Category (Beauty) → Subcategory (Skincare / Haircare / Makeup / Tools).
- Require subcategory match for alternative search, not just category match.
- Remove the `General` category bypass — instead, use the AI intent analyzer to assign a specific category.
- Build a mapping from Datafeedr's category taxonomy to AffiMark's internal taxonomy.

#### 3.3 Commission Rate Verification (Medium Impact)

**Current state:** Commission rates come from static enrichment data. Rates can be outdated.

**Improvement:**
- Add a `last_verified` timestamp to all enrichment data.
- For alternatives shown to users, verify the commission rate is still current before displaying.
- Show **data freshness indicators** on alternative cards: "Rate verified 3 days ago" vs. "Rate from 6+ months ago — may have changed".
- Allow users to **report incorrect rates** with a simple flag button.

### Tier 4: Infrastructure for Scale

#### 4.1 Search Result Caching (High Impact)

**Current state:** Every search hits Datafeedr, runs AI analysis, and computes scores from scratch.

**Problem:** Same product searched by different users (or the same user twice) repeats all expensive operations.

**Improvement:**
- Cache Datafeedr results by `{category, priceRange, network}` key in KV with 24h TTL.
- Cache product identification results by URL in KV with 7-day TTL.
- Cache AI embeddings by product ID.
- Only user-specific scoring needs to run fresh; data fetching and identification can be cached.

#### 4.2 Background Processing for Portfolio Audit (Medium Impact)

**Current state:** Portfolio audit processes all products sequentially in a single request. For large portfolios (50+ products), this can exceed the Cloudflare Workers CPU limit.

**Improvement:**
- Use **Cloudflare Durable Objects** or **Queues** to process products in batches of 5.
- Return an audit ID immediately, then stream results as they complete.
- Frontend polls for completion or uses Server-Sent Events.
- Add a progress indicator: "Analyzing product 12 of 47..."

#### 4.3 Observability & Monitoring (Medium Impact)

**Current state:** Errors are logged to `console.error` / `console.warn`. No structured logging, no alerting, no metrics.

**Improvement:**
- Add structured JSON logging with fields: `userId`, `operation`, `duration`, `success`, `degradation`.
- Track key metrics: search latency (p50/p95/p99), Datafeedr success rate, AI distillation success rate, average alternatives returned per search.
- Alert on: Datafeedr failure rate > 20%, search latency p95 > 30s, zero-result rate > 50%.
- Use Cloudflare Analytics Engine or a lightweight external service.

---

## Summary: Recommended Execution Order

### Immediate (Before Deploy)

1. Fix build failures (2 empty/broken files)
2. Delete remaining orphaned files (~60 files)
3. Fix dashboard dead links and simplify dashboard page
4. Add missing `safeJsonParse` and `.ok` checks

### Next Sprint (Agent Quality)

5. Semantic product matching improvements (1.1)
6. Brand affinity intelligence (1.4)
7. Category taxonomy refinement (3.2)
8. Batch alternative search from audit (2.2)

### Following Sprint (UX + Data)

9. Search feedback loop (2.1)
10. Context-aware price intelligence (1.3)
11. Enrichment expansion (3.1)
12. Alternative comparison view (2.3)

### Ongoing (Infrastructure)

13. Search result caching (4.1)
14. Background processing for audit (4.2)
15. Observability & monitoring (4.3)
16. Multi-strategy search expansion (1.2)
