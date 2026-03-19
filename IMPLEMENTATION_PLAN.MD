# AffiMark — Deployment-Ready Implementation Plan

**Goal:** Strip AffiMark to its core value proposition, fix all identified issues, and make the application deployment-ready. The core is: **Onboarding → Understanding User Context → Portfolio Risk Audit → Alternative Product Insights.**

Everything else is removed for now.

---

## Table of Contents

1. [Core Architecture (Target State)](#1-core-architecture-target-state)
2. [Phase 0: Cleanup — Remove Non-Core Features](#2-phase-0-cleanup--remove-non-core-features)
3. [Phase 1: Fix Critical Bugs](#3-phase-1-fix-critical-bugs)
4. [Phase 2: Harden the Agent Pipeline](#4-phase-2-harden-the-agent-pipeline)
5. [Phase 3: Fix Scoring & Data Integrity](#5-phase-3-fix-scoring--data-integrity)
6. [Phase 4: Frontend UX — Core Flow Polish](#6-phase-4-frontend-ux--core-flow-polish)
7. [Phase 5: Infrastructure & Deploy Readiness](#7-phase-5-infrastructure--deploy-readiness)
8. [Phase 6: Testing & Validation](#8-phase-6-testing--validation)
9. [Files Inventory: Keep vs Remove](#9-files-inventory-keep-vs-remove)

---

## 1. Core Architecture (Target State)

After cleanup, the entire application is 4 screens + 1 API:

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER JOURNEY                             │
│                                                                 │
│  Sign Up → Magic Onboarding → Priority Ranking → Dashboard     │
│                                                    │            │
│                                          ┌─────────┴──────────┐│
│                                          │  Portfolio Audit    ││
│                                          │  (risk scores)      ││
│                                          └─────────┬──────────┘│
│                                                    │            │
│                                          ┌─────────▼──────────┐│
│                                          │  Product Finder    ││
│                                          │  (alternatives)     ││
│                                          └────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Frontend Pages (Keep)

| Page | Path | Purpose |
|------|------|---------|
| Landing | `/` | Value proposition + CTA |
| Sign In | `/sign-in` | Auth |
| Sign Up | `/sign-up` | Auth |
| Email Verify | `/verify-email` | OTP verification |
| Magic Onboarding | `/onboarding/magic` | Paste link-in-bio URL |
| Priorities | `/onboarding/priorities` | Rank product + brand priorities |
| Dashboard | `/dashboard` | Portfolio health summary + entry points |
| Portfolio Audit | `/dashboard/portfolio-audit` | Full risk analysis |
| Product Finder | `/dashboard/product-finder` | Alternative search |
| Saved Products | `/dashboard/product-finder/saved` | Saved alternatives |
| Settings | `/dashboard/settings` | Priority editor |

### Backend Routes (Keep)

| Route | Mount | Purpose |
|-------|-------|---------|
| Portfolio Audit | `/api/portfolio` | `audit`, `add-product`, `scan-storefront` |
| Product Finder | `/api/finder` | `search-v2`, `search`, profile, intent, enrich |
| Migration | `/api/migration` | `scrape`, `apply`, `history`, `debug` |

### Backend Services (Keep)

| Service | Purpose |
|---------|---------|
| `mcp/agent.ts` | Alternative search orchestrator |
| `mcp/tools.ts` | Product ID, search, scoring tools |
| `profile-builder.ts` | Build user profile from onboarding |
| `multi-network-search.ts` | Dual scoring search |
| `product-intent-analyzer.ts` | AI intent extraction from URLs |
| `dynamic-intent-analyzer.ts` | Session intent adjustment |
| `outcome-feasibility-scorer.ts` | Risk scoring engine |
| `datafeedr-client.ts` | Datafeedr API |
| `product-canonicalization.ts` | Deduplication |
| `enrichment/*` | Static + dynamic enrichment |
| `priority-kpi-specs.ts` | KPI definitions |
| `cost-governor.ts` | Budget/rate limiting |
| `migration-scraper.ts` | Link-in-bio scraping |
| `storefront-scraper.ts` | Storefront scraping |
| `browser-storefront-scraper.ts` | JS storefront scraping |
| `linktree-ingestion.ts` | Linktree ingestion |
| `lightweight-social-analyzer.ts` | Social context analysis |
| `context-hash.ts` | Context hashing |
| `ai-client.ts` | OpenAI client (used by core services) |

---

## 2. Phase 0: Cleanup — Remove Non-Core Features

**Goal:** Reduce surface area. Delete everything that isn't part of onboarding → audit → alternative search. This makes the codebase smaller, the build faster, and the UX focused.

### 2.1 Frontend — Pages to Delete

Delete entire directories:

```
frontend/app/dashboard/optimizer/
frontend/app/dashboard/storefronts/
frontend/app/dashboard/revenue-loss/
frontend/app/dashboard/tax-export/
frontend/app/dashboard/product-verifier/
frontend/app/dashboard/smartwrappers/
frontend/app/dashboard/scanner/
frontend/app/dashboard/attribution/
frontend/app/dashboard/reliability/
frontend/app/dashboard/products/
frontend/app/chat/
frontend/app/products/
frontend/app/merchants/
frontend/app/inventory/
frontend/app/scanner/
frontend/app/link-guard/
frontend/app/link-guard-dashboard/
frontend/app/shop/
frontend/app/migration-wizard/
frontend/app/review-queue/
frontend/app/accounts/
frontend/app/analytics/
frontend/app/billing/
```

Delete legacy onboarding:
```
frontend/app/onboarding/signup/
frontend/app/onboarding/link-setup/
frontend/app/onboarding/health-check/
frontend/app/onboarding/results/
frontend/app/onboarding/account-type/
```

Delete non-core API routes:
```
frontend/app/api/chat/
frontend/app/api/verifier/
frontend/app/api/optimizer/
frontend/app/api/stripe/
frontend/app/api/domains/
frontend/app/api/commission/
frontend/app/api/analytics/
frontend/app/api/security/
frontend/app/api/tools/
frontend/app/api/user/subscription/
frontend/app/api/products/ (enrich + route)
frontend/app/api/storefronts/ (route + summary)
frontend/app/c/ (SmartWrapper redirect)
```

### 2.2 Frontend — Components to Delete

```
frontend/components/optimizer/
frontend/components/verifier/
frontend/components/storefronts/
frontend/components/revenue-loss/
frontend/components/tax-export/
frontend/components/reliability/
frontend/components/attribution/
frontend/components/audit/ (Link Guard audit, not portfolio)
frontend/components/scanner/
frontend/components/chat/
frontend/components/shop/
frontend/components/smartwrappers/
frontend/components/inventory/
frontend/components/product-search/
frontend/components/layout/AppShell.tsx
frontend/components/layout/Header.tsx
frontend/components/CheckoutButton.tsx
frontend/components/Pricing.tsx
frontend/components/sign-in.tsx
frontend/components/icons/PlatformIcons.tsx
```

Delete non-core dashboard components:
```
frontend/components/dashboard/EarningsSummaryCard.tsx
frontend/components/dashboard/RecentTransactionsTable.tsx
frontend/components/dashboard/RevenueHealthScore.tsx
frontend/components/dashboard/CriticalAlertsBanner.tsx
frontend/components/dashboard/HealthOverview.tsx
frontend/components/dashboard/LinkHealthTable.tsx
frontend/components/dashboard/ProblemsResolved.tsx
frontend/components/dashboard/ProblemsDetected.tsx
frontend/components/dashboard/PriorityFixList.tsx
frontend/components/dashboard/IssueDetailModal.tsx
frontend/components/dashboard/StorefrontBreakdown.tsx (keep StorefrontBreakdownCard)
```

### 2.3 Frontend — Other Files to Delete

```
frontend/hooks/useVerifier.ts
frontend/types/verifier.ts
frontend/lib/stripe-config.ts
frontend/lib/api/audit-api.ts (Link Guard audit)
frontend/lib/context-aware-agent-client.ts
frontend/lib/mcp/ (tiktok.ts, twitter.ts, youtube.ts)
```

### 2.4 Backend — Routes to Delete from `api.ts`

Remove these route imports and mounts from `backend/src/api.ts`:

```
api/link-audit-routes.ts      → /api/audit
api/action-routes.ts           → /api/actions
api/affiliate-links-routes.ts  → /api/affiliate-links
api/merchants-routes.ts        → /api/merchants
api/products-routes.ts         → /api/products
api/inventory-routes.ts        → /api/inventory
api/redirect-routes.ts         → /api/redirects
api/smartwrapper-routes.ts     → /api/smartwrappers
api/analytics-routes.ts        → /api/analytics
api/conversion-routes.ts       → /api/conversions
api/domain-routes.ts           → /api/domains
api/accounts-routes.ts         → /api/accounts
api/transactions-routes.ts     → /api/transactions
api/export-routes.ts           → /api/export
api/optimizer-routes.ts        → /api/optimizer
api/attribution-test-routes.ts → /api/attribution
api/commission-routes.ts       → /api/commission
api/ai-routes.ts               → /api/ai
api/verifier-routes.ts         → /api/verifier
api/awin-oauth-routes.ts       → /api/awin
api/tradedoubler-oauth-routes.ts → /api/tradedoubler
routes/agent-routes.ts         → /api/agent
```

**Keep only:**
```
routes/finder-routes.ts    → /api/finder
routes/portfolio-routes.ts → /api/portfolio
api/migration-routes.ts    → /api/migration
```

### 2.5 Backend — Files to Delete

Delete entire directories/files:
```
backend/src/api/ (all files EXCEPT migration-routes.ts)
backend/src/routes/agent-routes.ts
backend/src/routes/api/ (reputation.ts)
backend/src/services/verifier/ (entire directory)
backend/src/services/agents/ (entire directory)
backend/src/merchants/ (entire directory)
backend/src/workers/ (entire directory — crons for non-core features)
```

Delete individual non-core services:
```
backend/src/services/link-audit-orchestrator.ts
backend/src/services/action-executor.ts
backend/src/services/redirect-link-service.ts
backend/src/services/redirect-resolver.ts
backend/src/services/health-checker.ts
backend/src/services/health-scorer.ts
backend/src/services/csv-importer.ts
backend/src/services/currency-converter.ts
backend/src/services/analytics-aggregation.ts
backend/src/services/conversion-sync.ts
backend/src/services/commission-optimizer.ts
backend/src/services/ai-extractor.ts
backend/src/services/reputation-scraper.ts
backend/src/services/product-data.ts
backend/src/services/scanner.ts
backend/src/services/waterfall-router.ts
backend/src/services/param-preserver.ts
backend/src/services/link-generator.ts
backend/src/services/destination-fingerprinter.ts
backend/src/services/dns-verifier.ts
backend/src/services/fallback-policy.ts
backend/src/services/alternative-suggester.ts
backend/src/services/semantic-ranker.ts
backend/src/services/diversity-selector.ts
backend/src/services/recommendation-confidence.ts
backend/src/services/storefront-eligibility.ts
backend/src/services/link-crawler.ts
backend/src/services/amazon-direct-scraper.ts
backend/src/services/impact-api.ts
backend/src/services/issue-detector.ts
backend/src/services/alert-generator.ts
backend/src/services/catalog-matcher.ts
backend/src/services/data-retention.ts
backend/src/services/email-service.ts
backend/src/services/monetization-detector.ts
backend/src/services/stock-checker.ts
backend/src/services/reason-code-engine.ts
```

### 2.6 Backend — Update `api.ts` After Cleanup

The new `api.ts` should be minimal:

```typescript
import { Hono } from 'hono';
import type { Env } from './index';

const api = new Hono<{ Bindings: Env }>();

// CORS
api.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
});
api.options('*', (c) => c.text('', 204));

// Core routes
import finderRoutes from './routes/finder-routes';
api.route('/api/finder', finderRoutes);

import portfolioRoutes from './routes/portfolio-routes';
api.route('/api/portfolio', portfolioRoutes);

import migrationRoutes from './api/migration-routes';
api.route('/api/migration', migrationRoutes);

export default api;
```

### 2.7 Backend — Update `index.ts` After Cleanup

Remove the scheduled handler (it runs non-core crons). Remove references to deleted workers.

### 2.8 Backend — Update `wrangler.toml` After Cleanup

Remove the `[triggers] crons` section since all cron workers are being deleted.

### 2.9 Frontend — Dependencies to Remove

After deleting non-core components, these dependencies may become unused:

```
@anthropic-ai/sdk        (Strategy Agent — non-core)
@tanstack/react-table    (tables — non-core)
cmdk                     (command palette — non-core)
react-day-picker         (date picker — non-core)
recharts                 (charts — non-core)
date-fns                 (date formatting — check if still used)
tailwindcss-animate      (never wired into config)
```

Run `npx depcheck` after cleanup to confirm.

---

## 3. Phase 1: Fix Critical Bugs

These must be fixed before any deployment.

### 3.1 Sign Out Button (5 min)

**File:** `frontend/app/dashboard/layout.tsx` line 132

The Sign Out button has no `onClick` handler. Wire it:

```tsx
import { signOut } from 'next-auth/react';

<button 
  onClick={() => signOut({ callbackUrl: '/' })}
  className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
>
  <LogOut className="w-5 h-5" />
  <span className="font-medium">Sign Out</span>
</button>
```

### 3.2 Dead Links (10 min)

**File:** `frontend/components/finder/ProductFinder.tsx`

- Line ~305: Change `/social-accounts` → `/dashboard/settings` (or remove)
- Line ~323: Change `/storefronts` → `/dashboard/settings` (or remove)

**File:** `frontend/components/dashboard/QuickActionsGrid.tsx`

- Line ~47: Remove the Earnings quick action (non-core) or point to `/dashboard`

### 3.3 Onboarding Destination (5 min)

**File:** `frontend/app/onboarding/priorities/page.tsx`

After completing priorities, users should go to `/dashboard` instead of `/dashboard/product-finder`.

Find the redirect/router.push call and change:
```typescript
// Before
router.push('/dashboard/product-finder');
// After
router.push('/dashboard');
```

### 3.4 Secrets in Env Templates (15 min)

**Files:**
- `frontend/.env.local.recommended`
- `backend/.env.local.recommended`

Replace all real-looking API keys with placeholders:

```
OPENAI_API_KEY=your_openai_api_key_here
RAINFOREST_API_KEY=your_rainforest_api_key_here
SERPAPI_KEY=your_serpapi_key_here
NEXTAUTH_SECRET=generate_with_openssl_rand_base64_32
BACKEND_API_KEY=your_backend_api_key_here
IMPACT_ACCOUNT_SID=your_impact_sid_here
IMPACT_AUTH_TOKEN=your_impact_token_here
```

**Important:** Rotate all exposed keys in the actual Cloudflare/Supabase dashboards.

---

## 4. Phase 2: Harden the Agent Pipeline

The alternative search agent is the core product. These fixes ensure it works reliably.

### 4.1 Add Overall Timeout (15 min)

**File:** `backend/src/mcp/agent.ts`

Wrap `runAlternativeSearchAgent` in a timeout:

```typescript
export async function runAlternativeSearchAgent(
  productUrl: string,
  userId: string,
  env: any,
): Promise<AgentSearchResult> {
  const AGENT_TIMEOUT_MS = 45000;
  
  return Promise.race([
    runAlternativeSearchAgentInternal(productUrl, userId, env),
    new Promise<AgentSearchResult>((_, reject) => 
      setTimeout(() => reject(new Error('Agent search timed out')), AGENT_TIMEOUT_MS)
    ),
  ]);
}
```

### 4.2 Add Degradation Indicator (30 min)

**File:** `backend/src/mcp/types.ts`

Add to `AgentSearchResult`:

```typescript
export interface AgentSearchResult {
  // ... existing fields
  degradation?: {
    level: 'none' | 'partial' | 'severe';
    issues: string[];
    message: string;
  };
}
```

**File:** `backend/src/mcp/agent.ts`

Track degradation through the pipeline:

```typescript
const degradationIssues: string[] = [];

// When profile fails:
if (!profile || profileIsEmpty(profile)) {
  degradationIssues.push('profile_unavailable');
}

// When original risk scoring fails:
try { /* ... */ } catch (e) {
  degradationIssues.push('original_risk_scoring_failed');
}

// When AI distillation fails:
if (aiDistillationFailed) {
  degradationIssues.push('ai_query_generation_failed');
}

// When Datafeedr fails:
if (allStrategiesReturnedEmpty) {
  degradationIssues.push('product_database_unavailable');
}

// When semantic scoring fails:
if (semanticScoringFailed) {
  degradationIssues.push('semantic_scoring_unavailable');
}

// Include in response:
return {
  ...result,
  degradation: degradationIssues.length > 0 ? {
    level: degradationIssues.length >= 3 ? 'severe' : 'partial',
    issues: degradationIssues,
    message: degradationIssues.length >= 3
      ? 'Results may be significantly less personalized due to service issues.'
      : 'Some personalization features are temporarily reduced.',
  } : undefined,
};
```

**File:** `frontend/components/finder/ProductFinder.tsx`

Show a subtle banner when degradation is present:

```tsx
{finder.degradation && finder.degradation.level !== 'none' && (
  <div className="px-4 py-2 bg-amber-900/20 border border-amber-700/30 rounded-lg text-sm text-amber-200">
    {finder.degradation.message}
  </div>
)}
```

### 4.3 Type `env` Properly (15 min)

**File:** `backend/src/mcp/agent.ts` and `backend/src/mcp/tools.ts`

Replace `env: any` with proper typing:

```typescript
import type { Env } from '../index';

export async function runAlternativeSearchAgent(
  productUrl: string,
  userId: string,
  env: Env,
): Promise<AgentSearchResult> { /* ... */ }
```

### 4.4 Detect Amazon Domain from URL (15 min)

**File:** `backend/src/mcp/tools.ts`

The Rainforest API call hardcodes `amazon_domain=amazon.com`. Detect the domain from the product URL:

```typescript
function detectAmazonDomain(url: string): string {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  if (hostname.includes('amazon.de')) return 'amazon.de';
  if (hostname.includes('amazon.co.uk')) return 'amazon.co.uk';
  if (hostname.includes('amazon.fr')) return 'amazon.fr';
  if (hostname.includes('amazon.it')) return 'amazon.it';
  if (hostname.includes('amazon.es')) return 'amazon.es';
  if (hostname.includes('amazon.co.jp')) return 'amazon.co.jp';
  return 'amazon.com';
}
```

### 4.5 Distinguish Datafeedr Failure from No Results (20 min)

**File:** `backend/src/mcp/tools.ts`

Change `searchAlternatives` to return a result object instead of just an array:

```typescript
interface SearchResult {
  products: AlternativeProduct[];
  error?: string;
}

export async function searchAlternatives(...): Promise<SearchResult> {
  try {
    // ... existing code
    return { products: convertedProducts };
  } catch (e) {
    console.error('[MCP search_alternatives] Datafeedr search failed:', e);
    return { products: [], error: 'Product database temporarily unavailable' };
  }
}
```

Update the agent to track `error` for degradation reporting.

### 4.6 Validate Supabase Responses (15 min)

**File:** `backend/src/mcp/tools.ts` (in `getCreatorProfile`)

Add response validation:

```typescript
if (!prefsRes.ok) {
  const errText = await prefsRes.text().catch(() => 'unknown');
  console.error(`[MCP] Supabase prefs query failed (${prefsRes.status}): ${errText}`);
  // Mark profile as degraded instead of silently continuing
}
```

**File:** `backend/src/routes/portfolio-routes.ts`

Add response validation before parsing:

```typescript
const productsRes = await fetch(...);
if (!productsRes.ok) {
  const errText = await productsRes.text().catch(() => 'unknown');
  return c.json({ error: 'Failed to fetch products', details: errText }, 502);
}
const products: any[] = await productsRes.json();
```

---

## 5. Phase 3: Fix Scoring & Data Integrity

### 5.1 Division-by-Zero Guards (30 min)

**File:** `backend/src/services/verifier/scoring-engine.ts`

Guard economics ratios (note: this file is non-core but if any scoring code is shared, apply there too):

```typescript
const commRatio = categoryBenchmarks.avg_commission > 0
  ? commRate / categoryBenchmarks.avg_commission
  : 1;
```

**File:** `backend/src/services/verifier/alternatives-ranker.ts`

Guard `calculatePricePercentile`:

```typescript
const range = stats.price_p75 - stats.price_p25;
if (range <= 0) return 0.5;
```

**File:** `backend/src/services/product-intent-analyzer.ts`

Guard `extractDominantCategories`:

```typescript
if (total === 0) return [];
```

**File:** `backend/src/services/product-canonicalization.ts`

Guard `getDeduplicationStats`:

```typescript
const deduplicationRate = originalCount > 0 ? (duplicatesRemoved / originalCount) * 100 : 0;
const avgVariants = canonicalProducts.length > 0
  ? variantCounts.reduce(...) / canonicalProducts.length
  : 0;
```

### 5.2 JSON.parse Safety (20 min)

**File:** `backend/src/routes/finder-routes.ts`

Wrap all `JSON.parse` calls in the profile construction:

```typescript
function safeJsonParse(value: string | null | undefined, fallback: any = []): any {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    console.warn('[Finder] Failed to parse JSON:', value?.substring(0, 50));
    return fallback;
  }
}

const profile = {
  productPriorities: safeJsonParse(profileData.product_priorities, []),
  brandPriorities: safeJsonParse(profileData.brand_priorities, []),
  dominantCategories: safeJsonParse(profileData.dominant_categories, []),
  topBrands: safeJsonParse(profileData.top_brands, []),
  // etc.
};
```

**File:** `backend/src/mcp/tools.ts`

Same pattern for `getCreatorProfile` JSON fields.

### 5.3 Profile Builder Price Parsing (10 min)

**File:** `backend/src/services/profile-builder.ts`

Filter invalid prices before averaging:

```typescript
const validPricedProducts = pricedProducts.filter(p => {
  const price = parseFloat(p.current_price);
  return !isNaN(price) && price > 0;
});

const avgPricePoint = validPricedProducts.length > 0
  ? validPricedProducts.reduce((sum, p) => sum + parseFloat(p.current_price), 0) / validPricedProducts.length
  : 0;
```

---

## 6. Phase 4: Frontend UX — Core Flow Polish

### 6.1 Rebuild Dashboard Navigation (20 min)

**File:** `frontend/app/dashboard/layout.tsx`

Replace the current navigation with core-only items:

```typescript
const navigationGroups = [
  {
    label: 'Risk Intelligence',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Portfolio Audit', href: '/dashboard/portfolio-audit', icon: ShieldCheck, badge: '★' },
      { name: 'Product Finder', href: '/dashboard/product-finder', icon: Search },
    ],
  },
  {
    label: 'Account',
    items: [
      { name: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
];
```

### 6.2 Rebuild Dashboard Page (45 min)

**File:** `frontend/app/dashboard/page.tsx`

The dashboard should be laser-focused on the core flow:

1. **Portfolio Health Card** (already exists) — shows Revenue Stability Index, product counts by verdict, link to full audit
2. **Quick Start** — for new users: "Run your first Portfolio Audit" CTA
3. **Recent Alternatives Found** — last 3 alternatives the user saved from Product Finder
4. **Remove:** Revenue hero widget, earnings summary, storefront breakdown (beyond what's relevant to audit), all non-core quick actions

### 6.3 Show ProductRiskCard on Mobile (10 min)

**File:** `frontend/components/finder/ProductFinder.tsx`

Find the `hidden md:flex` wrapper around `ProductRiskCard` and change it:

```tsx
// Before: Only shows on desktop
<div className="hidden md:flex">
  <ProductRiskCard ... />
</div>

// After: Shows on all screens
{finder.originalProductRisk && finder.originalSearchProduct && (
  <ProductRiskCard ... />
)}
```

Place it above the `CardStack` in both the desktop and mobile layouts.

### 6.4 Add Error Retry to Product Finder (15 min)

**File:** `frontend/components/finder/ProductFinder.tsx`

When an error occurs, show a Retry button:

```tsx
{finder.error && (
  <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-lg">
    <p className="text-red-200 text-sm">{finder.error}</p>
    <button 
      onClick={() => { finder.clearError(); finder.search(lastInput); }}
      className="mt-2 btn-secondary text-sm"
    >
      Try Again
    </button>
  </div>
)}
```

### 6.5 Cache Portfolio Audit on Dashboard (20 min)

**File:** `frontend/components/dashboard/PortfolioHealthCard.tsx`

Use `sessionStorage` to cache the audit result so it doesn't re-run on every dashboard visit:

```typescript
useEffect(() => {
  const cached = sessionStorage.getItem('portfolio-audit-cache');
  if (cached) {
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < 5 * 60 * 1000) { // 5 min cache
        setAuditData(data);
        setLoading(false);
        return;
      }
    } catch {}
  }
  runAudit();
}, []);

// After successful audit:
sessionStorage.setItem('portfolio-audit-cache', JSON.stringify({
  data: result,
  timestamp: Date.now(),
}));
```

### 6.6 QuickActionsGrid — Core Only (15 min)

**File:** `frontend/components/dashboard/QuickActionsGrid.tsx`

Keep only:
1. **Run Portfolio Audit** → `/dashboard/portfolio-audit`
2. **Find Alternatives** → `/dashboard/product-finder`
3. **Edit Priorities** → `/dashboard/settings`

Remove: Earnings, Verifier, Storefronts, Scanner quick actions.

### 6.7 Landing Page — Clean Up CTAs (10 min)

**File:** `frontend/app/page.tsx`

Ensure all CTAs point to working routes:
- "Run Portfolio Risk Audit" → `/dashboard/portfolio-audit` (logged in) or `/sign-up` (logged out)
- "Get Started Free" → `/sign-up`

Remove any references to non-core features.

---

## 7. Phase 5: Infrastructure & Deploy Readiness

### 7.1 Enable TypeScript Strict Mode (2-4 hours)

**File:** `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

This will surface many type errors. Fix them methodically:
1. Run `npx tsc --noEmit 2>&1 | head -100` to see the first batch
2. Fix in order: null checks, implicit any, missing return types
3. Focus on core flow files first

### 7.2 Re-enable Build Checks (30 min)

**File:** `frontend/next.config.js`

```javascript
eslint: {
  ignoreDuringBuilds: false,
},
typescript: {
  ignoreBuildErrors: false,
},
```

Fix any build-breaking errors before deploying.

### 7.3 Standardize Backend URL Variable (15 min)

**Files:** All frontend files that use `NEXT_PUBLIC_BACKEND_URL` or `NEXT_PUBLIC_API_URL`

Standardize on `NEXT_PUBLIC_API_URL` everywhere (since `next.config.js` rewrites already use it). Search for `NEXT_PUBLIC_BACKEND_URL` and replace.

### 7.4 Update `next.config.js` Images (5 min)

```javascript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    { protocol: 'https', hostname: 'pbs.twimg.com' },
    { protocol: 'https', hostname: 'yt3.ggpht.com' },
  ],
},
```

### 7.5 Simplify `next.config.js` Rewrites (10 min)

After cleanup, the rewrite exclusion regex can be simplified since most excluded routes no longer exist:

```javascript
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://BACKEND_HOST:8787';
  return [
    {
      source: '/api/:path((?!auth|finder/search$|finder/saved|finder/session|preferences/priorities|portfolio/audit|onboarding|user).*)',
      destination: `${apiUrl}/api/:path*`,
    },
  ];
},
```

### 7.6 Add Wrangler Production Config (10 min)

**File:** `backend/wrangler.toml`

```toml
[env.production]
vars = { NODE_ENV = "production" }
```

Remove the cron trigger since all workers are being deleted:

```toml
# Remove:
# [triggers]
# crons = ["0 */6 * * *"]
```

### 7.7 CORS — Tighten for Production (10 min)

**File:** `backend/src/api.ts`

Replace `Access-Control-Allow-Origin: *` with specific origins:

```typescript
const ALLOWED_ORIGINS = [
  'https://affimark.io',
  'https://www.affimark.io',
  process.env.FRONTEND_DEV_URL,  // local dev origins
].filter(Boolean) as string[];

api.use('*', async (c, next) => {
  await next();
  const origin = c.req.header('Origin');
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
  c.header('Access-Control-Allow-Credentials', 'true');
});
```

### 7.8 Remove Unused Dependencies (15 min)

After all cleanup, run:

```bash
cd frontend && npx depcheck
cd backend && npx depcheck
```

Remove unused packages from both `package.json` files.

---

## 8. Phase 6: Testing & Validation

### 8.1 Backend — Core Endpoint Tests

Test with the existing test user (`8acd050f-4dc3-4432-8a95-0057b816b46b`):

```bash
# Start backend
cd backend && npx wrangler dev --port 8787 --local --show-interactive-dev-session false

# Test portfolio audit
curl -X POST $BACKEND_URL/api/portfolio/audit \
  -H "Content-Type: application/json" \
  -H "x-user-id: 8acd050f-4dc3-4432-8a95-0057b816b46b" \
  -d '{}'

# Test product finder (BACKEND_URL = wrangler dev URL, typically port 8787)
curl -X POST $BACKEND_URL/api/finder/search-v2 \
  -H "Content-Type: application/json" \
  -H "x-user-id: 8acd050f-4dc3-4432-8a95-0057b816b46b" \
  -d '{"input": "https://www.amazon.com/dp/B0BX4L2GNJ"}'
```

### 8.2 Frontend — Build Verification

```bash
cd frontend && npm run build
cd frontend && npm run lint
```

Both should pass with zero errors after Phase 5.

### 8.3 End-to-End Flow Test

1. Sign up → verify email
2. Magic onboarding → paste a Linktree URL → scan completes
3. Priority ranking → drag-and-drop → complete
4. Dashboard shows Portfolio Health Card
5. Portfolio Audit → scores all products → shows verdicts
6. "Find Better Alternative" → navigates to Product Finder with pre-filled URL
7. Product Finder → returns alternatives → shows risk card for original
8. Save an alternative → appears in Saved Products
9. Settings → can edit priorities
10. Sign out → works

### 8.4 Deployment Test

```bash
# Backend
cd backend && npm run deploy

# Frontend
cd frontend && npm run deploy
```

Verify both deploy successfully to Cloudflare Workers.

---

## 9. Files Inventory: Keep vs Remove

### Frontend — KEEP

```
app/
├── page.tsx                             # Landing
├── layout.tsx                           # Root layout
├── providers.tsx                        # SessionProvider
├── globals.css                          # Styles
├── sign-in/page.tsx                     # Sign in
├── sign-up/page.tsx                     # Sign up
├── verify-email/page.tsx                # Email verification
├── auth/callback/route.ts              # OAuth callback
├── onboarding/
│   ├── page.tsx                         # Onboarding router
│   ├── magic/page.tsx                   # Link-in-bio scan
│   └── priorities/page.tsx              # Priority ranking
├── dashboard/
│   ├── page.tsx                         # Dashboard
│   ├── layout.tsx                       # Dashboard layout
│   ├── loading.tsx                      # Loading state
│   ├── error.tsx                        # Error state
│   ├── portfolio-audit/page.tsx         # Audit page
│   ├── product-finder/
│   │   ├── page.tsx                     # Finder page
│   │   └── saved/page.tsx              # Saved products
│   └── settings/page.tsx               # Settings
├── api/
│   ├── auth/[...nextauth]/route.ts     # NextAuth
│   ├── auth/sign-up/route.ts           # Sign up API
│   ├── auth/verify-otp/route.ts        # OTP verify
│   ├── portfolio/audit/route.ts        # Audit proxy
│   ├── finder/search-v2/route.ts       # Search proxy
│   ├── finder/search/route.ts          # Search proxy
│   ├── finder/saved/route.ts           # Saved products
│   ├── finder/saved/[id]/route.ts      # Saved product CRUD
│   ├── finder/session/[id]/route.ts    # Session
│   ├── finder/session/[id]/chat/route.ts # Session chat
│   ├── onboarding/preferences/route.ts # Onboarding status
│   ├── onboarding/complete/route.ts    # Mark complete
│   ├── preferences/priorities/route.ts # Save priorities
│   ├── migration/apply/route.ts        # Apply migration
│   └── user/product-count/route.ts     # Product count

components/
├── finder/                              # All finder components
├── onboarding/PriorityRanker.tsx
├── onboarding/PriorityOption.tsx
├── dashboard/PortfolioHealthCard.tsx
├── dashboard/QuickActionsGrid.tsx
├── dashboard/RevenueHeroWidget.tsx       # Simplify
├── dashboard/StorefrontBreakdownCard.tsx
├── dashboard/InsightsPanel.tsx
├── dashboard/UpliftAlert.tsx
├── auth/SignInForm.tsx
├── auth/SignUpForm.tsx
├── user/UserMenu.tsx
└── ui/*                                 # Keep all UI primitives

hooks/useFinder.ts
types/finder.ts
lib/auth.ts
lib/auth-options.ts
lib/utils.ts
lib/supabase/client.ts
lib/supabase-server.ts
middleware.ts
```

### Backend — KEEP

```
src/
├── index.ts                             # Entry point (simplify)
├── api.ts                               # Route mounting (simplify)
├── api/migration-routes.ts              # Onboarding scrape/apply
├── routes/
│   ├── finder-routes.ts                 # Product finder
│   └── portfolio-routes.ts              # Portfolio audit
├── mcp/
│   ├── agent.ts                         # Alternative search agent
│   ├── tools.ts                         # MCP tools
│   ├── types.ts                         # Types
│   └── index.ts                         # Exports
├── services/
│   ├── profile-builder.ts              # User profile
│   ├── multi-network-search.ts          # Dual scoring
│   ├── product-intent-analyzer.ts       # Intent extraction
│   ├── dynamic-intent-analyzer.ts       # Session intent
│   ├── outcome-feasibility-scorer.ts    # Risk scoring
│   ├── datafeedr-client.ts             # Datafeedr API
│   ├── product-canonicalization.ts      # Deduplication
│   ├── priority-kpi-specs.ts           # KPI definitions
│   ├── cost-governor.ts                # Budget control
│   ├── context-hash.ts                 # Context hashing
│   ├── migration-scraper.ts            # Link-in-bio scraping
│   ├── storefront-scraper.ts           # Storefront scraping
│   ├── browser-storefront-scraper.ts   # JS scraping
│   ├── linktree-ingestion.ts           # Linktree ingestion
│   ├── lightweight-social-analyzer.ts  # Social analysis
│   ├── ai-client.ts                    # OpenAI client
│   └── enrichment/                     # All enrichment files
└── utils/
    ├── product-inference.ts             # Brand/category inference
    ├── supabase-retry.ts               # Supabase retry
    └── exchange-rates.ts               # Exchange rates (keep for toEUR)
```

### Config — KEEP (with modifications noted in phases above)

```
frontend/
├── next.config.js                       # Modify: re-enable checks, update images
├── tsconfig.json                        # Modify: enable strict
├── tailwind.config.ts                   # Keep
├── postcss.config.cjs                   # Keep
├── vite.config.ts                       # Keep
├── .eslintrc.json                       # Keep
├── .env.local.recommended               # Modify: placeholder secrets
├── middleware.ts                         # Keep
├── package.json                         # Modify: remove unused deps

backend/
├── wrangler.toml                        # Modify: remove crons, add prod env
├── tsconfig.json                        # Keep
├── .env.local.recommended               # Modify: placeholder secrets
├── package.json                         # Modify: remove unused deps
```

---

## Execution Order Summary

| Phase | What | Est. Effort | Depends On |
|-------|------|-------------|------------|
| **0** | Remove non-core files & routes | 2-3 hours | Nothing |
| **1** | Fix critical bugs (sign out, dead links, etc.) | 45 min | Phase 0 |
| **2** | Harden agent pipeline (timeout, degradation, typing) | 2 hours | Phase 0 |
| **3** | Fix scoring & data integrity (div/0, JSON, prices) | 1 hour | Phase 0 |
| **4** | Frontend UX polish (nav, dashboard, mobile, cache) | 2-3 hours | Phase 0+1 |
| **5** | Infrastructure (strict mode, CORS, build, deploy config) | 3-5 hours | Phase 0-4 |
| **6** | Testing & validation | 2-3 hours | Phase 0-5 |

**Total estimated effort: 13-17 hours of focused implementation.**

Phases 0-3 can be done in parallel by different agents. Phase 4 depends on Phase 0 (files must be deleted first). Phase 5 depends on 0-4. Phase 6 is final validation.

---

## What This Achieves

After all 6 phases:

1. **Focused product:** 4 screens, 1 API, zero feature bloat
2. **Reliable agent:** Timeout-protected, degradation-visible, properly typed
3. **Correct scoring:** No division-by-zero, no NaN, no silent data corruption
4. **Clean UX:** Hero features in nav, no dead links, working sign out, mobile-ready
5. **Deploy-ready infrastructure:** Strict types, build checks, production CORS, no exposed secrets
6. **Tested end-to-end:** Full flow verified from sign-up to alternative search