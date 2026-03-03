# AffiMark MVP — Coding Agent Instructions

## Context

AffiMark is being repositioned as **affiliate revenue risk intelligence**. The landing page promises: "Optimize for Revenue That Stays" with a core CTA of "Run Portfolio Risk Audit."

The user is an affiliate creator with multiple storefronts (Amazon DE, Amazon UK, LTK, Awin, ShopMy). They paste their Linktree URL during onboarding. AffiMark scans it, extracts their products and storefronts, then analyzes their entire portfolio for risk — flagging fragile revenue and suggesting better alternatives.

**The branch is `cursor/alternative-product-agent-review-f0a7`.** All work goes here.

---

## What Already Exists (DO NOT rebuild these)

### Backend (`backend/src/`)
- **MCP Agent** (`mcp/agent.ts`): Identifies a product from URL, searches Datafeedr for alternatives from different brands, scores them by user priorities. Endpoint: `POST /api/finder/search-v2`
- **Outcome Feasibility Scorer** (`services/outcome-feasibility-scorer.ts`): Computes 4 risk signals per product: `merchantRisk` (0-100), `programFriction` (0-100), `demandEvidence` (0-100), `refundRisk` (0-100). Returns `overall`, `confidence`, `warnings`, `requiresVerification`.
- **Enrichment Layer** (`services/enrichment/`): Static enrichment gives commission rate, cookie duration, payment terms, return window, shipping speed, Trustpilot score, brand recognition tier, sustainability certs, design awards. Dynamic enrichment fetches rating + reviewCount from product pages.
- **Priority KPI System** (`services/priority-kpi-specs.ts`): 16 KPIs (8 product + 8 brand). Each scored 0-100 with evidence sources.
- **Profile Builder** (`services/profile-builder.ts`): Loads priorities from `user_creator_preferences`, social data from `user_social_links`, storefront data from `user_storefronts` + `user_storefront_products`. Caches in `user_product_profiles`.
- **Product Enrichment** (`POST /api/finder/enrich-products`): Analyzes product titles for category/brand, triggers profile rebuild.
- **MCP Tools** (`mcp/tools.ts`): `getCreatorProfile`, `identifyProduct`, `searchAlternatives`, `scoreCandidate`, `computeSemanticScores`.

### Frontend (`frontend/`)
- **Onboarding flow**: `/onboarding/magic` (Linktree scan) → `/onboarding/priorities` (rank 5 product + 5 brand priorities) → dashboard
- **Product Finder**: `/dashboard/product-finder` with `ProductFinder.tsx`, `ProductCard.tsx`, `CardStack.tsx`
- **Types**: `frontend/types/finder.ts` with `AlternativeProduct`, `PriorityKpi`, `ComparisonToOriginal`
- **API route**: `frontend/app/api/finder/search/route.ts` — calls backend V2, stores session in Supabase

### Database (Supabase — `pquedymrcxfzqwfpbrmh`)
Key tables: `profiles`, `user_creator_preferences`, `user_social_links`, `user_storefronts`, `user_storefront_products`, `user_product_profiles`, `product_finder_sessions`

---

## What Needs To Be Built

### TASK 1: Portfolio Risk Audit Endpoint

**File:** `backend/src/routes/portfolio-routes.ts` (new file)

**Mount in:** `backend/src/api.ts` (or wherever routes are mounted — check `backend/src/index.ts`)

**Endpoint:** `POST /api/portfolio/audit`

**Input:** `{ userId: string }`

**Logic:**
1. Call `getCreatorProfile(userId, env)` from `mcp/tools.ts` to load the full profile
2. Fetch all products from `user_storefront_products` for this user (the profile already has `storefrontProducts` array)
3. For each product that has a `title` and a `product_url`:
   a. Call `identifyProduct(product.product_url, env)` from `mcp/tools.ts` — this returns category, brand, price, confidence
   b. Call `scoreOutcomeFeasibility(...)` from `services/outcome-feasibility-scorer.ts` with the identified product data + enrichment signals from `enrichStatic(...)` in `services/enrichment/`
   c. Store the result: `{ productId, title, brand, category, price, riskScore (overall), merchantRisk, refundRisk, demandEvidence, programFriction, confidence, warnings, verdict }`
4. Compute verdict per product:
   - `overall >= 70` → verdict: `"keep"` (stable revenue)
   - `overall >= 50 && overall < 70` → verdict: `"review"` (moderate risk)
   - `overall < 50` → verdict: `"replace"` (fragile revenue)
5. Compute portfolio-level aggregates:
   - `totalProducts`: count
   - `highRisk`: count where verdict is `"replace"`
   - `moderateRisk`: count where verdict is `"review"`
   - `stable`: count where verdict is `"keep"`
   - `revenueStabilityIndex`: weighted average of all product `overall` scores (0-100)
   - `merchantConcentration`: what % of products come from the top merchant
   - `topRisks`: top 3 products by lowest `overall` score with their warnings
   - `avgMerchantStability`: average `merchantRisk` across all products
   - `avgRefundRisk`: average `refundRisk` across all products
   - `avgCommissionDurability`: for each product compute `commissionRate * cookieDurationDays / 30`, average across portfolio. Get commission/cookie from `enrichStatic()`.

**Important:** If the user has only 3 products from onboarding (like the current test user), that's fine. The audit works with any number. For products without a `product_url`, skip them but include them in the count as "unanalyzed."

**Response shape:**
```json
{
  "portfolioSummary": {
    "totalProducts": 47,
    "analyzed": 42,
    "highRisk": 8,
    "moderateRisk": 12,
    "stable": 22,
    "revenueStabilityIndex": 62,
    "merchantConcentration": { "topMerchant": "Amazon", "percentage": 65 },
    "avgMerchantStability": 72,
    "avgRefundRisk": 55,
    "avgCommissionDurability": 48
  },
  "products": [
    {
      "id": "uuid",
      "title": "Sony WH-1000XM5",
      "brand": "Sony",
      "category": "Electronics",
      "price": 349,
      "platform": "amazon",
      "productUrl": "https://...",
      "verdict": "keep",
      "riskScore": 78,
      "riskBreakdown": {
        "merchantRisk": 85,
        "refundRisk": 70,
        "demandEvidence": 90,
        "programFriction": 65
      },
      "warnings": [],
      "confidence": 80,
      "commissionRate": 4,
      "cookieDuration": 1
    }
  ],
  "topRisks": [
    { "title": "...", "riskScore": 32, "warnings": ["Low merchant rating", "High-return category"] }
  ]
}
```

### TASK 2: Portfolio Audit Frontend Page

**File:** `frontend/app/dashboard/portfolio-audit/page.tsx` (new)

**This is the page the user lands on after clicking "Run Portfolio Risk Audit" from the landing page or dashboard.**

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue Stability Audit                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Revenue Stability Index: ██████████░░░░ 62/100                │
│  "Your portfolio has moderate risk exposure"                    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  STABLE   │  │  REVIEW  │  │ REPLACE  │  │UNANALYZED│      │
│  │    22     │  │    12    │  │    8     │  │    5     │      │
│  │   green   │  │  amber   │  │   red    │  │   gray   │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  Risk Breakdown                                                 │
│  Merchant Stability  ████████████░░░ 72/100                    │
│  Refund Risk         ████████░░░░░░░ 55/100                    │
│  Commission Durability ██████░░░░░░░░ 48/100                   │
│  Merchant Concentration: 65% Amazon (⚠️ high)                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Products Requiring Action (sorted by risk, worst first)       │
│                                                                 │
│  🔴 Zara Midi Dress — Risk: 32/100                             │
│     High-return category · Low merchant rating                  │
│     Commission: 4% · Cookie: 7 days                            │
│     [Find Better Alternative →]                                 │
│                                                                 │
│  🔴 DHgate Slimming Device — Risk: 28/100                      │
│     Low-trust brand · Very few reviews                          │
│     Commission: 7.5% · Cookie: 30 days                         │
│     [Find Better Alternative →]                                 │
│                                                                 │
│  🟡 Kristin Ess Hair Spray — Risk: 55/100                      │
│     High-return category · Short cookie duration                │
│     Commission: 3% · Cookie: 1 day                             │
│     [Find Better Alternative →]                                 │
│                                                                 │
│  🟢 Sony WH-1000XM5 — Risk: 78/100 ✓                          │
│     Strong demand · Reliable merchant                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**"Find Better Alternative" button** navigates to `/dashboard/product-finder?url={productUrl}` — pre-fills the finder input with that product URL so the MCP agent can search for a replacement.

**Frontend API route:** `frontend/app/api/portfolio/audit/route.ts` (new) — calls the backend `POST /api/portfolio/audit`, passes the authenticated userId.

**Styling:** Use Tailwind. Dark theme consistent with existing dashboard. Use existing UI components from `frontend/components/ui/` where available.

### TASK 3: Product Risk Card in Product Finder

**File:** `frontend/components/finder/ProductRiskCard.tsx` (new)

**When the user searches for alternatives using the Product Finder, show a risk assessment of the ORIGINAL product they inserted.**

**Backend change** in `backend/src/mcp/agent.ts`: After `identifyProduct()` succeeds, run `scoreOutcomeFeasibility()` on the original product and include the result in `AgentSearchResult` as `originalProductRisk`.

Update `backend/src/mcp/types.ts`: Add `originalProductRisk?: OutcomeFeasibilityScore` to `AgentSearchResult`.

Update `backend/src/routes/finder-routes.ts` search-v2 endpoint: Include `originalProductRisk` in the response.

**The card shows:**
```
┌─────────────────────────────────────────────────────┐
│  This Product's Risk Profile                         │
│                                                     │
│  Kristin Ess Dry Texture Hair Spray — $14           │
│                                                     │
│  Merchant Stability   ████████░░  72                │
│  Refund Risk          ██████░░░░  45 ⚠️             │
│  Commission Durability ████░░░░░░  32 ⚠️            │
│  Demand Evidence      ████████░░  68                │
│                                                     │
│  ⚠️ High-return category (beauty)                   │
│  ⚠️ Very short cookie duration (<24hrs)             │
│                                                     │
│  Verdict: REVIEW — consider alternatives below      │
└─────────────────────────────────────────────────────┘
```

### TASK 4: Landing Page

**File:** `frontend/app/page.tsx` (modify existing)

Build the landing page with the exact copywriting provided. Sections:

1. **Hero**: "Optimize for Revenue That Stays." + subheadline + "Run Portfolio Risk Audit" CTA (links to `/sign-up` for new users, `/dashboard/portfolio-audit` for logged-in users)
2. **Section 1**: "The Hidden Problem" — two-column layout: what affiliates measure vs what they ignore
3. **Section 2**: "Risk-Adjusted Affiliate Revenue" — the formula + 4 named metrics with icons
4. **Section 3**: "Remove Fragile Revenue" — what you eliminate vs what you gain
5. **Section 4**: "Most affiliate tools help you scale traffic. AffiMark helps you protect margin."
6. **Section 5**: Psychological close + "Audit Your Revenue Stability" CTA

**Design principles:**
- Dark background (consistent with dashboard)
- Minimal, institutional feel — not flashy SaaS
- Typography-driven, not illustration-driven
- Monospace or mono-like font for the formula and metrics
- Green for stable/good signals, amber for review, red for risk

### TASK 5: Dashboard Integration

**File:** `frontend/app/dashboard/page.tsx` (modify)

Add a **Portfolio Health Summary** card to the main dashboard that shows:
- Revenue Stability Index (the big number)
- "X products need attention" with link to portfolio audit
- Quick risk bars for Merchant Stability, Refund Risk, Commission Durability

This requires calling the portfolio audit API on dashboard load (or caching the result).

### TASK 6: Product Finder Pre-fill from Portfolio Audit

**File:** `frontend/app/dashboard/product-finder/page.tsx` and `frontend/components/finder/ProductFinder.tsx`

When navigated to with `?url=...` query parameter, auto-populate the finder input and trigger search immediately. This connects the "Find Better Alternative" button from the portfolio audit to the existing finder flow.

---

## Execution Order

1. **Task 1** first (portfolio audit endpoint) — everything depends on this
2. **Task 3** next (risk card in finder) — small change, high impact
3. **Task 2** next (portfolio audit page) — the main deliverable
4. **Task 4** (landing page) — can be done in parallel with Task 2
5. **Task 5** (dashboard integration) — connects everything
6. **Task 6** (pre-fill) — polish

---

## Environment Setup

- **Backend:** `cd backend && npm run dev` (runs wrangler on port 8787)
- **Frontend:** `cd frontend && npm run dev` (runs Next.js on port 3000)
- **Env files:** `backend/.dev.vars` (copy from `.env.local.recommended` + add DATAFEEDR keys), `frontend/.env.local` (copy from `.env.local.recommended`)
- **Cloudflare deploy:** Set build root to `backend` in Cloudflare dashboard, then `cd backend && npx wrangler deploy`
- **Database:** Hosted Supabase, no local setup needed

## Key Files to Read Before Starting

1. `backend/src/mcp/tools.ts` — all MCP tools
2. `backend/src/services/outcome-feasibility-scorer.ts` — the risk scoring engine
3. `backend/src/services/enrichment/index.ts` — what enrichment data is available
4. `backend/src/mcp/types.ts` — type definitions
5. `frontend/types/finder.ts` — frontend types
6. `frontend/components/finder/ProductCard.tsx` — existing card component pattern

## Quality Check

After implementation, test with user `8acd050f-4dc3-4432-8a95-0057b816b46b` who has:
- 2 storefronts (Amazon, Affiliate)
- 3 products (Amazon storefront links, Vegamour affiliate link)
- 4 social accounts (YouTube, Facebook, Instagram, TikTok)
- Priorities: quality > price > sustainability > reviews > shipping (product), commission > return_policy > customer_service > reputation > payment_speed (brand)

The portfolio audit should analyze these 3 products and return a meaningful risk report. The "Find Better Alternative" flow should work end-to-end from the audit page into the product finder.
