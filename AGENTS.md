# AffiMark – Agent Instructions

## Focus: Portfolio Risk Audit + Alternative Search Quality

AffiMark is **affiliate revenue risk intelligence**. The two most important features are:

1. **Portfolio Risk Audit** (★ HERO) — Analyze every product in a creator's portfolio for revenue risk, flag fragile products, and connect to alternative search.
2. **Alternative Product Search** — Find the best alternative product for each risky item using the creator's priorities and context.

Every coding agent should understand how onboarding data flows into both the audit and the search pipeline.

**Active branch:** `cursor/alternative-product-agent-review-f0a7` — all work goes here.

---

## Onboarding → Audit → Search Data Pipeline

```
User signs up
    │
    ▼
Magic Onboarding (/onboarding/magic)
  └─ Pastes Linktree/Beacons/Stan URL
  └─ Backend scrapes: storefronts, products, social accounts
  └─ Saved to DB: user_storefronts, user_storefront_products, user_social_links
    │
    ▼
Priority Ranking (/onboarding/priorities)
  └─ User ranks 5 product priorities (quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition)
  └─ User ranks 5 brand priorities (commission, customer_service, return_policy, reputation, sustainability, payment_speed, cookie_duration, easy_approval)
  └─ Saved to: user_creator_preferences table
    │
    ▼
Profile Builder (backend/src/services/profile-builder.ts)
  └─ Combines: priorities + social analysis + storefront analysis
  └─ Outputs: UserProfile { productPriorities, brandPriorities, socialContext, storefrontContext }
  └─ Cached in: user_product_profiles table
    │
    ├───────────────────────────────┐
    ▼                               ▼
Portfolio Risk Audit            Alternative Search (per product)
  └─ POST /api/portfolio/audit    └─ POST /api/finder/search-v2
  └─ Scores every product         └─ MCP agent finds alternatives
  └─ 4 risk signals per product    └─ Dual scoring: match + feasibility
  └─ Verdicts: KEEP/REVIEW/REPLACE └─ Ranked by user priorities
  └─ "Find Better Alternative" →   └─ ← Pre-filled from audit
      links to product finder
```

### What onboarding gives us (use ALL of this)

| Data Source | What It Contains | Where It's Stored | How It's Used |
|---|---|---|---|
| **Linktree scan** | Storefronts (LTK, Amazon, ShopMy), products, social links | `user_storefronts`, `user_storefront_products` | Portfolio audit input; dominant categories, price range, preferred networks for search |
| **Product priorities** | Ranked 1-5 from: quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition | `user_creator_preferences.product_priorities` | Weight scoring: rank 1 = 5x weight, rank 5 = 1x weight |
| **Brand priorities** | Ranked 1-5 from: commission, customer_service, return_policy, reputation, sustainability, payment_speed, cookie_duration, easy_approval | `user_creator_preferences.brand_priorities` | Filter/boost merchants (e.g., "commission" #1 → prioritize high-commission programs) |
| **Social context** | Platforms, content categories, audience demographics | Derived from `user_social_links` | Category alignment, audience-product fit |
| **Storefront context** | Dominant categories, top brands, avg price point, preferred networks | Derived from `user_storefront_products` | Price range targeting, brand familiarity scoring, network preference |

---

## Portfolio Risk Audit (★ HERO Feature)

### Entry Point
`POST /api/portfolio/audit` → `backend/src/routes/portfolio-routes.ts` (NEW)

### Pipeline
1. `getCreatorProfile(userId, env)` — load full profile from `mcp/tools.ts`
2. Fetch all products from `user_storefront_products` for this user
3. For each product with `title` and `product_url`:
   a. `identifyProduct(product_url, env)` — returns category, brand, price, confidence
   b. `enrichStatic(...)` — get commission rate, cookie duration, payment terms, etc.
   c. `scoreOutcomeFeasibility(...)` — compute 4 risk signals:
      - `merchantRisk` (0-100): seller trustworthiness
      - `programFriction` (0-100): ease of working with the program
      - `demandEvidence` (0-100): reviews, search volume
      - `refundRisk` (0-100): return rates, category fragility
4. Compute verdict per product:
   - `overall >= 70` → `"keep"` (stable)
   - `overall >= 50 && < 70` → `"review"` (moderate risk)
   - `overall < 50` → `"replace"` (fragile)
5. Compute portfolio aggregates:
   - `revenueStabilityIndex` — weighted average of all `overall` scores
   - `merchantConcentration` — % products from top merchant
   - `avgMerchantStability`, `avgRefundRisk`, `avgCommissionDurability`
   - `topRisks` — top 3 products by lowest `overall` score

### Key Files (Audit)
- `backend/src/routes/portfolio-routes.ts` — audit endpoint (NEW)
- `backend/src/mcp/tools.ts` — `getCreatorProfile`, `identifyProduct`
- `backend/src/services/outcome-feasibility-scorer.ts` — risk scoring engine
- `backend/src/services/enrichment/index.ts` — static enrichment data
- `frontend/app/dashboard/portfolio-audit/page.tsx` — audit page (NEW)
- `frontend/app/api/portfolio/audit/route.ts` — frontend API route (NEW)

### Frontend: Portfolio Audit Page

**Location:** `/dashboard/portfolio-audit`

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue Stability Index: ██████████░░░░ 62/100                │
│  "Your portfolio has moderate risk exposure"                    │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │  STABLE   │  │  REVIEW  │  │ REPLACE  │  │UNANALYZED│      │
│  │    22     │  │    12    │  │    8     │  │    5     │      │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘      │
│                                                                 │
│  Risk Breakdown Bars                                            │
│  Merchant Stability  ████████████░░░ 72/100                    │
│  Refund Risk         ████████░░░░░░░ 55/100                    │
│  Commission Durability ██████░░░░░░░░ 48/100                   │
│                                                                 │
│  Products Requiring Action (sorted by risk, worst first)       │
│  🔴 Zara Midi Dress — Risk: 32 [Find Better Alternative →]    │
│  🟡 Kristin Ess Spray — Risk: 55 [Find Better Alternative →]  │
│  🟢 Sony WH-1000XM5 — Risk: 78 ✓                              │
└─────────────────────────────────────────────────────────────────┘
```

**"Find Better Alternative"** navigates to `/dashboard/product-finder?url={productUrl}` — pre-fills the finder and triggers search.

---

## Alternative Search Systems

### 1. Product Finder (primary search flow)

**Entry:** `POST /api/finder/search-v2` → `backend/src/routes/finder-routes.ts`

**Pipeline:**
1. `buildUserProfile()` — loads priorities + social + storefront context from DB
2. `analyzeDynamicIntent()` — adjusts weights based on current session intent
3. `analyzeProductIntent()` — AI extracts category/brand/keywords from product URL
4. `searchAllNetworks()` — queries Datafeedr API with profile-informed price range
5. **DUAL SCORING:**
   - **Match Score** (60% weight): How well product aligns with user priorities + storefront context + brand familiarity + price fit
   - **Outcome Feasibility** (40% weight): Business viability (merchant trust, demand signals, economics)
6. Filtered by minimum thresholds → sorted by combined score

**New: Original Product Risk Card** — When a user searches for alternatives, the finder now shows a risk assessment of the ORIGINAL product they inserted, using `scoreOutcomeFeasibility()`. This connects the audit mindset to the search flow.

**Key files:**
- `backend/src/services/profile-builder.ts` — builds UserProfile from onboarding data
- `backend/src/services/multi-network-search.ts` — dual-scoring search + ranking
- `backend/src/services/product-intent-analyzer.ts` — AI intent extraction from URLs
- `backend/src/services/dynamic-intent-analyzer.ts` — session-level intent adjustments
- `backend/src/services/outcome-feasibility-scorer.ts` — business viability scoring
- `backend/src/services/datafeedr-client.ts` — Datafeedr API integration
- `backend/src/services/product-canonicalization.ts` — deduplication
- `backend/src/mcp/agent.ts` — MCP agent orchestrating search-v2
- `backend/src/mcp/tools.ts` — all MCP tools
- `backend/src/mcp/types.ts` — AgentSearchResult (add `originalProductRisk`)

**Priority scoring logic** (in `calculateProfileMatchScore`):
```
For each of user's 5 ranked product priorities:
  weight = (6 - rank) * dynamicMultiplier
  score += calculatePriorityScore(product, priorityId) * weight

Plus: category alignment (20%), brand familiarity (15%), price point fit (15%)
```

### 2. Product Verifier (existing product analysis + alternatives)

**Entry:** `POST /api/verifier/analyze` → `backend/src/services/verifier/verifier-orchestrator.ts`

**Pipeline:**
1. Scrape product page → extract price, brand, category, reviews
2. Score 3 pillars: product_viability, offer_merchant, economics
3. Compute verdict (GREEN/YELLOW/RED/TEST_FIRST)
4. Intent Router auto-determines rank mode based on weakest pillar
5. Load alternatives from `affiliate_programs` table by category
6. Rank with mode-specific weights → bucketize into Safe/Upside/Budget/Trending

**Key files:**
- `backend/src/services/verifier/verifier-orchestrator.ts` — main pipeline
- `backend/src/services/verifier/scoring-engine.ts` — 3-pillar scoring (deterministic, no AI)
- `backend/src/services/verifier/intent-router.ts` — auto-selects rank mode
- `backend/src/services/verifier/alternatives-ranker.ts` — weighted scoring + tag generation
- `backend/src/services/verifier/bucketizer.ts` — groups results into decision buckets

**Rank modes:** `balanced | demand_first | trust_first | economics_first` — each shifts weight distribution across pillars.

---

## Quality Principles for Alternative Search

### What "good" looks like

1. **Product match accuracy**: The alternative must be the same *type* of product. "Wireless headphones" should return wireless headphones, not wired earbuds or Bluetooth speakers.
2. **Priority respect**: If user ranked "quality" #1, the top alternative must have strong reviews/ratings, even if a cheaper option has higher commission.
3. **Price band coherence**: Alternatives should be within ±30% of the user's typical price point (derived from their storefront products).
4. **Brand context awareness**: If user already sells Sony and Bose headphones, the search should understand they're in the premium audio niche, not general electronics.
5. **Network preference**: If user's storefronts are on Amazon and LTK, prefer alternatives available on those networks.

### What "bad" looks like

- Returning products from a completely different category
- Ignoring user priorities (showing budget options when user ranked quality #1)
- Returning duplicates or slight variants of the same product
- Showing products from merchants with <3 star ratings without warnings
- Not using the storefront context at all (treating every user the same)

### The inserted product is ground truth

When a user inserts a product URL, the alternative search must match:
- **Same item type** (e.g., "running shoes" → running shoes, not hiking boots)
- **Same use case** (e.g., "desk lamp for office" → office desk lamps)
- **Compatible price tier** (budget/mid/premium detection from URL + storefront context)
- **Same audience fit** (if user's audience is German 18-34, prefer EU-available products)

---

## Types Reference

Core types are in `frontend/types/finder.ts`:
- `Priority { id, rank }` — a ranked priority
- `UserPriorities { productPriorities, brandPriorities, activeContext }` — full user prefs
- `FinderSession` — a search session with snapshot of priorities at search time
- `AlternativeProduct` — search result with `matchScore`, `priorityAlignment`, `pros/cons`
- `PriorityAlignment { [priorityId]: { score, reason } }` — per-priority breakdown

Priority options are defined as constants: `PRODUCT_PRIORITIES` and `BRAND_PRIORITIES` in the same file.

Backend types in `backend/src/mcp/types.ts`:
- `AgentSearchResult` — includes `originalProductRisk?: OutcomeFeasibilityScore` (NEW)

---

## Key Files to Read Before Starting Any Task

1. `backend/src/mcp/tools.ts` — all MCP tools
2. `backend/src/services/outcome-feasibility-scorer.ts` — the risk scoring engine
3. `backend/src/services/enrichment/index.ts` — what enrichment data is available
4. `backend/src/mcp/types.ts` — type definitions
5. `frontend/types/finder.ts` — frontend types
6. `frontend/components/finder/ProductCard.tsx` — existing card component pattern
7. `AGENT_INSTRUCTIONS.md` — full task breakdown with response shapes and UI wireframes

---

## Cursor Cloud Specific Instructions

### Architecture
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind on port 3000
- **Frontend deploy**: Vinext (Cloudflare's Next.js reimplementation on Vite) → Cloudflare Workers
- **Backend**: Cloudflare Workers (Hono) via Wrangler on port 8787
- **Database**: Supabase (hosted, not local)

### Running the backend locally
Wrangler requires `--local --show-interactive-dev-session false` flags in non-interactive/CI environments. The AI binding is only available remotely and will show as "not supported" locally — this is expected and non-blocking.

```bash
cd backend && npx wrangler dev --port 8787 --local --show-interactive-dev-session false
```

### Running the frontend
```bash
# Standard Next.js dev server (recommended for development)
cd frontend && npm run dev

# Vinext dev server (for testing Cloudflare compatibility)
cd frontend && npm run dev:vinext
```

The frontend proxies `/api/*` requests to `http://127.0.0.1:8787` via `next.config.js` rewrites, so both services must be running simultaneously.

### Deploying the frontend to Cloudflare
```bash
cd frontend && npm run deploy    # vinext deploy — builds + deploys to Cloudflare Workers
```

Vinext delivers 4.4x faster builds and 57% smaller bundles vs Next.js. `vinext check` scans for compatibility issues before deploying.

**Known vinext limitations:**
- `next-auth` relies on Next.js internals — may need migration to `better-auth` for full compatibility
- `next/font/google` fonts loaded from CDN (not self-hosted)
- Images use `@unpic/react` (no local optimization)

### Environment files
- **Frontend**: Copy `frontend/.env.local.recommended` → `frontend/.env.local`
- **Backend**: Copy `backend/.env.local.recommended` → `backend/.dev.vars` (wrangler convention)

### ESLint
The frontend requires a `.eslintrc.json` file for `next lint` to work non-interactively. If missing, create it with `{"extends": "next/core-web-vitals"}`.

### Pre-existing issues
- Backend has TypeScript errors (run `npx tsc --noEmit` in `backend/`). These are pre-existing and do not block `wrangler dev`.
- Frontend lint (`npm run lint` in `frontend/`) reports unescaped entity warnings. These are pre-existing.

### Supabase
The app uses a hosted Supabase instance. No local database setup is needed. Credentials are in the `.env.local.recommended` files.

---

## Test User

User `8acd050f-4dc3-4432-8a95-0057b816b46b` has:
- 2 storefronts (Amazon, Affiliate)
- 3 products (Amazon storefront links, Vegamour affiliate link)
- 4 social accounts (YouTube, Facebook, Instagram, TikTok)
- Priorities: quality > price > sustainability > reviews > shipping (product), commission > return_policy > customer_service > reputation > payment_speed (brand)

The portfolio audit should analyze these 3 products and return a meaningful risk report. The "Find Better Alternative" flow should work end-to-end from the audit page into the product finder.
