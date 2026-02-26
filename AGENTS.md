# AffiMark – Agent Instructions

## Focus: Alternative Search Quality

The single most important feature in AffiMark is **alternative product search**. Every coding agent working on this codebase should understand how onboarding data flows into the search pipeline and how to improve search quality.

---

## Onboarding → Search Data Pipeline

```
User signs up
    │
    ▼
Magic Onboarding (/onboarding/magic)
  └─ Pastes Linktree/Beacons/Stan URL
  └─ Backend scrapes: storefronts, products, social accounts
  └─ Saved to DB: connected_accounts, tracked_products, social_accounts
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
    ▼
Alternative Search (triggered per product)
  └─ Product Finder: backend/src/routes/finder-routes.ts → multi-network-search.ts
  └─ Product Verifier: backend/src/services/verifier/verifier-orchestrator.ts
```

### What onboarding gives us (use ALL of this)

| Data Source | What It Contains | Where It's Stored | How Search Should Use It |
|---|---|---|---|
| **Linktree scan** | Storefronts (LTK, Amazon, ShopMy), products, social links | `connected_accounts`, product tables | Dominant categories, price range, preferred networks, top brands |
| **Product priorities** | Ranked 1-5 from: quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition | `user_creator_preferences.product_priorities` | Weight scoring: rank 1 = 5x weight, rank 5 = 1x weight |
| **Brand priorities** | Ranked 1-5 from: commission, customer_service, return_policy, reputation, sustainability, payment_speed, cookie_duration, easy_approval | `user_creator_preferences.brand_priorities` | Filter/boost merchants that match (e.g., "commission" #1 → prioritize high-commission programs) |
| **Social context** | Platforms, content categories, audience demographics | Derived from social links in onboarding | Category alignment, audience-product fit |
| **Storefront context** | Dominant categories, top brands, avg price point, preferred networks | Derived from imported products | Price range targeting, brand familiarity scoring, network preference |

---

## Two Alternative Search Systems

### 1. Product Finder (primary search flow)

**Entry:** `POST /api/finder/search` → `backend/src/routes/finder-routes.ts`

**Pipeline:**
1. `buildUserProfile()` — loads priorities + social + storefront context from DB
2. `analyzeDynamicIntent()` — adjusts weights based on current session intent
3. `analyzeProductIntent()` — AI extracts category/brand/keywords from product URL
4. `searchAllNetworks()` — queries Datafeedr API with profile-informed price range
5. **DUAL SCORING:**
   - **Match Score** (60% weight): How well product aligns with user priorities + storefront context + brand familiarity + price fit
   - **Outcome Feasibility** (40% weight): Business viability (merchant trust, demand signals, economics)
6. Filtered by minimum thresholds → sorted by combined score

**Key files:**
- `backend/src/services/profile-builder.ts` — builds UserProfile from onboarding data
- `backend/src/services/multi-network-search.ts` — dual-scoring search + ranking
- `backend/src/services/product-intent-analyzer.ts` — AI intent extraction from URLs
- `backend/src/services/dynamic-intent-analyzer.ts` — session-level intent adjustments
- `backend/src/services/outcome-feasibility-scorer.ts` — business viability scoring
- `backend/src/services/datafeedr-client.ts` — Datafeedr API integration
- `backend/src/services/product-canonicalization.ts` — deduplication

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

---

## Cursor Cloud specific instructions

### Architecture
- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind on port 3000
- **Backend**: Cloudflare Workers (Hono) via Wrangler on port 8787
- **Database**: Supabase (hosted, not local)

Standard dev commands are in `CLAUDE.md` (root, frontend, backend).

### Running the backend locally
Wrangler requires `--local --show-interactive-dev-session false` flags in non-interactive/CI environments. The AI binding is only available remotely and will show as "not supported" locally — this is expected and non-blocking.

```bash
cd backend && npx wrangler dev --port 8787 --local --show-interactive-dev-session false
```

### Running the frontend
```bash
cd frontend && npm run dev
```

The frontend proxies `/api/*` requests to `http://127.0.0.1:8787` via `next.config.js` rewrites, so both services must be running simultaneously.

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
