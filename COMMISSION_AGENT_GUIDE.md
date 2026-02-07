# Commission Agent - Development & System Architecture Guide

> **Purpose:** This document is a complete specification for a coding agent to implement the Affimark Commission Agent feature. Every decision, sequence, data flow, and UI element is defined here. Follow this document as your single source of truth.

---

## Table of Contents

1. [What Already Exists](#1-what-already-exists)
2. [What the Commission Agent IS](#2-what-the-commission-agent-is)
3. [User Journey (Step-by-Step Sequence)](#3-user-journey)
4. [System Architecture](#4-system-architecture)
5. [Database Schema Changes](#5-database-schema-changes)
6. [API Endpoints](#6-api-endpoints)
7. [Commission Analysis Engine (Core Logic)](#7-commission-analysis-engine)
8. [Product Matching Pipeline](#8-product-matching-pipeline)
9. [UI Specification](#9-ui-specification)
10. [Data Sources & Rate Intelligence](#10-data-sources)
11. [Edge Cases & Error Handling](#11-edge-cases)
12. [Implementation Order](#12-implementation-order)

---

## 1. What Already Exists

**DO NOT rebuild these. Extend them.**

| Component | Location | Status |
|-----------|----------|--------|
| Onboarding import (Linktree/LTK/Amazon scraping) | `frontend/app/onboarding/magic/page.tsx`, `backend/src/services/migration-scraper.ts` | Working |
| Product extraction from storefronts | `backend/src/services/storefront-scraper.ts`, `browser-storefront-scraper.ts` | Working |
| Batch analysis endpoint | `frontend/app/api/optimizer/batch-analyze/route.ts` | Working but limited |
| Product library (storefront + manual) | `frontend/app/api/optimizer/products/route.ts` | Working |
| Optimizer UI shell | `frontend/components/optimizer/SmartOptimizer.tsx` | Working |
| Analysis results display | `frontend/components/optimizer/AnalysisResults.tsx` | Working |
| Affiliate programs DB | `COMMISSION_AGENT_SCHEMA.sql` seeded via `COMMISSION_AGENT_SCHEMA.sql` | 28 programs seeded |
| Brand aliases | `brand_aliases` table | Basic aliases exist |
| Platform commission rates | `platform_commission_rates` table | Amazon DE rates seeded |

**Current limitations of the existing optimizer:**
- Static lookup only (pattern matching against hardcoded brand list + DB)
- No AI-powered product identification
- No real-time rate verification
- No multi-step analysis pipeline
- No actionable next-steps generation
- Results are informational only, no guided workflow
- Commission data is manually seeded and stale

---

## 2. What the Commission Agent IS

### Definition

The Commission Agent is an **intelligent analysis pipeline** that takes a product (URL or imported item) and returns:

1. **What the user currently earns** (detected platform, rate, cookie window)
2. **What they COULD earn** (alternative programs, ranked by potential gain)
3. **How to switch** (actionable steps, signup links, application guidance)
4. **Confidence level** (how reliable our data is)

### What it is NOT

- It is NOT a guarantee of earnings
- It does NOT auto-switch links (user decides)
- It does NOT scrape real-time commission rates from networks (we maintain a curated database)
- It does NOT require API keys from the user's affiliate accounts

### Core Principle

**Quality over quantity.** Show 1-3 high-confidence alternatives with clear action steps rather than 10 low-confidence suggestions. Every result must be actionable.

---

## 3. User Journey (Step-by-Step Sequence)

### Entry Points

The user can reach the Commission Agent from **three entry points:**

```
ENTRY POINT 1: Product Library (existing)
  User goes to /dashboard/optimizer
  -> Sees products imported from their storefronts
  -> Selects 1-20 products
  -> Clicks "Find Better Rates"

ENTRY POINT 2: Manual URL Input (existing)
  User goes to /dashboard/optimizer
  -> Pastes a product URL in the "Add Link" form
  -> URL is added to their library
  -> They select it and click "Find Better Rates"

ENTRY POINT 3: Quick Analyze (NEW - single URL, no save)
  User goes to /dashboard/optimizer
  -> Pastes a URL in a "Quick Check" input at the top
  -> Gets instant analysis WITHOUT saving to library
  -> Option to save result afterward
```

### Full Sequence Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  STEP 1: INPUT                                                    │
│                                                                    │
│  User provides product(s) via one of the three entry points.      │
│  System receives: product_url, title (optional), brand (optional) │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 2: PRODUCT IDENTIFICATION                                   │
│                                                                    │
│  For each product, the system determines:                         │
│  a) Platform (Amazon DE/UK/US, Awin, LTK, direct, etc.)          │
│  b) Brand (from URL domain, title text, known brand list, DB)     │
│  c) Category (electronics, fashion, beauty, etc.)                 │
│  d) Current commission rate (from platform + category)            │
│  e) ASIN (if Amazon)                                              │
│  f) Whether affiliate tracking exists on the URL                  │
│                                                                    │
│  Output: ProductIdentification object per product                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 3: ALTERNATIVE DISCOVERY                                    │
│                                                                    │
│  Search for better-paying programs using this priority:           │
│                                                                    │
│  Priority 1: Exact brand match in affiliate_programs DB           │
│    → e.g., "Sony" link on Amazon → Sony via Awin (3-8%)          │
│                                                                    │
│  Priority 2: Brand alias match in brand_aliases DB                │
│    → e.g., "sony.de" domain → maps to brand_slug "sony"          │
│                                                                    │
│  Priority 3: Category match (same category, higher rate)          │
│    → e.g., "electronics" on Amazon (1%) → MediaMarkt via Awin    │
│                                                                    │
│  Priority 4: General network suggestion                           │
│    → e.g., "Unknown brand on Amazon" → "Check Awin for direct"   │
│                                                                    │
│  Output: List of Alternative objects, ranked by potential gain     │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 4: GAIN CALCULATION                                         │
│                                                                    │
│  For each alternative, calculate:                                 │
│  - Monthly gain range (low/high) based on estimated traffic       │
│  - Yearly projection                                              │
│  - Cookie duration advantage                                      │
│  - Confidence score (1-5)                                         │
│                                                                    │
│  Traffic estimation:                                              │
│  - Use user's actual click data if available (affiliate_txns)     │
│  - Otherwise: estimate 500 clicks/month per product               │
│  - Conversion rate: 2%                                            │
│  - Avg order value: €50 (or use actual if available)              │
│                                                                    │
│  Output: Enriched alternatives with gain calculations             │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 5: INSIGHT GENERATION                                       │
│                                                                    │
│  Generate contextual insights (max 3 per product):                │
│                                                                    │
│  Insight types:                                                   │
│  - "opportunity" (green): Better program found                    │
│  - "action" (blue): Specific step user should take                │
│  - "tip" (amber): Platform-specific optimization advice           │
│  - "warning" (red): Issue detected (no tracking, broken URL)      │
│                                                                    │
│  Quality rules:                                                   │
│  - Max 3 insights per product (avoid noise)                       │
│  - Prioritize actionable over informational                       │
│  - Never show generic tips if specific ones exist                 │
│  - Always include "how to act" in the description                 │
│                                                                    │
│  Output: Prioritized insight list                                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 6: RESULTS DISPLAY                                          │
│                                                                    │
│  Show results grouped by product, sorted by opportunity size.     │
│  Each product card shows:                                         │
│  - Current state (platform, rate, cookie)                         │
│  - Best alternative (highlighted)                                 │
│  - Additional alternatives (collapsed)                            │
│  - Action steps (how to switch)                                   │
│  - Insights (contextual tips)                                     │
│                                                                    │
│  Summary bar at top:                                              │
│  - "X products analyzed"                                          │
│  - "Total potential extra: €XX-€XX/month"                         │
│  - "X opportunities found"                                        │
│                                                                    │
│  Output: Rendered UI (see Section 9 for full spec)                │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  STEP 7: ACTION TRACKING                                          │
│                                                                    │
│  User can:                                                        │
│  - "Save" an alternative (bookmarks for later)                    │
│  - "Applied" (marks they switched - for tracking)                 │
│  - "Dismiss" (hides suggestion)                                   │
│  - "Re-analyze" (re-run after time passes)                        │
│                                                                    │
│  All actions saved to link_analyses table.                        │
│  Dashboard widget shows: "X optimizations applied, €X saved"     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. System Architecture

### Component Diagram

```
Frontend (Next.js 15)
├── /dashboard/optimizer/page.tsx          → Page wrapper
├── /components/optimizer/
│   ├── SmartOptimizer.tsx                 → Main container (MODIFY)
│   ├── QuickAnalyzeInput.tsx              → NEW: Single URL quick check
│   ├── ProductLibrary.tsx                 → Product selection (MODIFY)
│   ├── AddLinkForm.tsx                    → Manual URL add (EXISTS)
│   ├── AnalysisResults.tsx                → Results display (REWRITE)
│   ├── ProductResultCard.tsx              → NEW: Individual product result
│   ├── AlternativeCard.tsx                → NEW: Single alternative display
│   ├── InsightBadge.tsx                   → NEW: Insight display component
│   └── ActionSteps.tsx                    → NEW: How-to-switch guide
│
├── /app/api/optimizer/
│   ├── products/route.ts                  → Product CRUD (EXISTS)
│   ├── batch-analyze/route.ts             → Batch analysis (REWRITE)
│   ├── quick-analyze/route.ts             → NEW: Single URL analysis
│   └── actions/route.ts                   → NEW: Save/apply/dismiss

Backend (Cloudflare Workers + Hono)
├── /src/services/
│   ├── commission-engine.ts               → NEW: Core analysis engine
│   ├── brand-detector.ts                  → NEW: Brand identification
│   ├── category-classifier.ts             → NEW: Category detection
│   └── rate-intelligence.ts               → NEW: Rate lookup & comparison

Database (Supabase)
├── affiliate_programs                     → EXISTS (expand seed data)
├── brand_aliases                          → EXISTS (expand significantly)
├── link_analyses                          → EXISTS (add fields)
├── platform_commission_rates              → EXISTS (add more platforms)
├── commission_agent_sessions              → NEW: Analysis session tracking
```

### Data Flow

```
User Input (URL/product)
    │
    ▼
[Next.js API Route: /api/optimizer/batch-analyze]
    │
    ├── 1. Parse URL → detect platform, extract identifiers
    │
    ├── 2. Identify brand → DB lookup, alias match, URL parsing
    │
    ├── 3. Classify category → keyword matching, DB lookup
    │
    ├── 4. Get current rate → platform_commission_rates table
    │
    ├── 5. Find alternatives → affiliate_programs table (multi-query)
    │
    ├── 6. Calculate gains → traffic data + rate comparison
    │
    ├── 7. Generate insights → contextual, max 3 per product
    │
    ├── 8. Save to link_analyses → persist results
    │
    └── 9. Return structured response
            │
            ▼
    [Frontend renders ProductResultCard for each]
```

---

## 5. Database Schema Changes

### 5a. Expand `affiliate_programs` table (no schema change, more seed data)

The existing table is correct. **Add more programs.** The coding agent should create a new seed file `COMMISSION_AGENT_SEED_V2.sql` with at least 100 programs covering:

**Categories to cover (minimum 5 programs each):**

| Category | Example Brands | Networks |
|----------|---------------|----------|
| Electronics | Sony, Samsung, Bose, JBL, Apple, Dyson, Philips, LG, Dell, HP, Lenovo | Awin, Impact, CJ |
| Fashion | Zalando, ASOS, H&M, Zara, Mango, Uniqlo, Nike, Adidas, Puma, Lululemon, Gymshark, NA-KD, COS, Arket, &Other Stories | Awin, LTK, ShareASale |
| Beauty | Sephora, Douglas, Flaconi, Charlotte Tilbury, MAC, NARS, Clinique, Estee Lauder, The Ordinary, CeraVe, Paula's Choice, Glossier | Awin, Impact, Rakuten |
| Home | IKEA, Wayfair, Westwing, West Elm, H&M Home, Zara Home, Made.com, Kartell | Awin, Impact |
| Sports/Outdoor | Nike, Adidas, Under Armour, The North Face, Patagonia, Columbia, Salomon, ASICS, New Balance | Awin, Impact, CJ |
| Software/SaaS | Shopify, Canva, Notion, HubSpot, SEMrush, Ahrefs, ConvertKit, Teachable | PartnerStack, Impact |
| Travel | Booking.com, Expedia, Airbnb, GetYourGuide, Skyscanner | Awin, CJ, Travelpayouts |
| Food/Grocery | HelloFresh, Gorillas, Flink, Amazon Fresh | Awin, Impact |
| Kids/Baby | Vertbaudet, BabyBjorn, Stokke, Ergobaby | Awin |
| Luxury | Net-a-Porter, Farfetch, Mytheresa, Matchesfashion, SSENSE | Awin, Rakuten, CJ |

**Required fields per program:**

```sql
INSERT INTO affiliate_programs (
  network,
  brand_name,
  brand_slug,
  category,
  subcategory,              -- e.g., 'headphones' within 'electronics'
  commission_type,          -- 'cps', 'cpa', 'hybrid'
  commission_rate_low,      -- Conservative end
  commission_rate_high,     -- Best case (top tier)
  cookie_duration,          -- Days
  requires_application,
  approval_difficulty,      -- 'easy', 'medium', 'hard'
  regions,                  -- ARRAY['DE', 'UK', 'FR', ...]
  confidence_score,         -- 1-5
  last_verified_at,         -- Use current date
  source,                   -- 'manual'
  signup_url,               -- Direct link to apply
  program_page_url          -- Info page
) VALUES (...);
```

**Rate accuracy rules for seed data:**
- Use ranges, never single numbers
- Rates should reflect publicly available information
- Mark `confidence_score` as 3 for rates from public program directories
- Mark `confidence_score` as 4 for rates verified on network dashboards
- Mark `confidence_score` as 5 for rates from official program pages
- Set `last_verified_at` to the date of implementation
- Always note if rates are tiered (mention in a comment, store high end as `commission_rate_high`)

### 5b. Expand `brand_aliases` significantly

Add aliases for every brand in the affiliate_programs table. Each brand needs:

```sql
-- Pattern: domain aliases, name variations, common misspellings
INSERT INTO brand_aliases (brand_slug, alias, alias_type) VALUES
  ('sony', 'sony', 'name'),
  ('sony', 'sony.com', 'domain'),
  ('sony', 'sony.de', 'domain'),
  ('sony', 'sony.co.uk', 'domain'),
  ('sony', 'store.sony.com', 'domain'),
  ('sony', 'sony electronics', 'name'),
  ('sony', 'sony store', 'name');
```

**Alias types:**
- `name`: Brand name variations (e.g., "H&M", "H and M", "HM")
- `domain`: Website domains (e.g., "hm.com", "www2.hm.com")
- `url_pattern`: URL path patterns (e.g., "/brands/sony")

### 5c. Add `commission_agent_sessions` table (NEW)

```sql
CREATE TABLE IF NOT EXISTS commission_agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session metadata
  session_type TEXT NOT NULL DEFAULT 'batch',  -- 'batch', 'quick', 'auto'
  products_analyzed INTEGER DEFAULT 0,
  opportunities_found INTEGER DEFAULT 0,
  total_potential_gain_low DECIMAL(10,2) DEFAULT 0,
  total_potential_gain_high DECIMAL(10,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'completed',  -- 'running', 'completed', 'failed'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user
  ON commission_agent_sessions(user_id, created_at DESC);

ALTER TABLE commission_agent_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON commission_agent_sessions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON commission_agent_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

### 5d. Add fields to `link_analyses` table

```sql
-- Add action tracking fields
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  session_id UUID REFERENCES commission_agent_sessions(id);
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  action_steps JSONB;  -- Structured steps for how to switch
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  cookie_comparison JSONB;  -- { current: 24, alternative: 30 }
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  yearly_projection_low DECIMAL(10,2);
ALTER TABLE link_analyses ADD COLUMN IF NOT EXISTS
  yearly_projection_high DECIMAL(10,2);
```

### 5e. Expand `platform_commission_rates` with more platforms

```sql
-- Amazon UK rates
INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  ('amazon_uk', 'electronics', 1.00, 'official'),
  ('amazon_uk', 'fashion', 4.00, 'official'),
  ('amazon_uk', 'beauty', 3.00, 'official'),
  ('amazon_uk', 'home_garden', 4.00, 'official'),
  ('amazon_uk', 'sports', 3.00, 'official'),
  ('amazon_uk', 'toys', 3.00, 'official'),
  ('amazon_uk', 'books', 3.00, 'official'),
  ('amazon_uk', 'default', 3.00, 'official')
ON CONFLICT (platform, category) DO NOTHING;

-- Amazon US rates
INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  ('amazon_us', 'electronics', 1.00, 'official'),
  ('amazon_us', 'fashion', 4.00, 'official'),
  ('amazon_us', 'beauty', 3.00, 'official'),
  ('amazon_us', 'home_garden', 4.00, 'official'),
  ('amazon_us', 'luxury_beauty', 10.00, 'official'),
  ('amazon_us', 'luxury_stores', 10.00, 'official'),
  ('amazon_us', 'sports', 3.00, 'official'),
  ('amazon_us', 'default', 3.00, 'official')
ON CONFLICT (platform, category) DO NOTHING;

-- Amazon FR rates
INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  ('amazon_fr', 'electronics', 1.00, 'official'),
  ('amazon_fr', 'fashion', 4.00, 'official'),
  ('amazon_fr', 'beauty', 3.00, 'official'),
  ('amazon_fr', 'default', 3.00, 'official')
ON CONFLICT (platform, category) DO NOTHING;

-- LTK general rates (LTK doesn't publish category rates, these are averages)
INSERT INTO platform_commission_rates (platform, category, commission_rate, source) VALUES
  ('ltk', 'fashion', 10.00, 'manual'),
  ('ltk', 'beauty', 12.00, 'manual'),
  ('ltk', 'home', 8.00, 'manual'),
  ('ltk', 'default', 10.00, 'manual')
ON CONFLICT (platform, category) DO NOTHING;
```

---

## 6. API Endpoints

### 6a. `POST /api/optimizer/batch-analyze` (REWRITE)

**This is the main analysis endpoint. Rewrite the existing implementation.**

**Request:**
```typescript
{
  products: Array<{
    id: string;            // product UUID or temp ID
    product_url: string;   // Required
    title?: string;        // Optional, helps with classification
    brand?: string;        // Optional, helps with matching
  }>;
}
```

**Response:**
```typescript
{
  session_id: string;  // UUID of the commission_agent_session
  summary: {
    products_analyzed: number;
    opportunities_found: number;
    total_potential_gain_low: number;   // EUR/month
    total_potential_gain_high: number;  // EUR/month
    total_yearly_low: number;
    total_yearly_high: number;
  };
  results: Array<{
    productId: string;
    productName: string;
    brand: {
      name: string;           // "Sony"
      detected_from: string;  // "url_domain" | "title" | "known_brands" | "alias_db"
      confidence: number;     // 1-5
    };
    category: {
      name: string;           // "electronics"
      detected_from: string;  // "keywords" | "db_lookup"
    };
    current: {
      url: string;
      platform: string;        // "amazon_de"
      platform_name: string;   // "Amazon DE"
      commission_rate: number;  // 1
      commission_type: string;  // "cps"
      cookie_duration: number;  // 24 (hours for Amazon, days for others)
      cookie_unit: string;      // "hours" | "days"
      has_tracking: boolean;    // true if affiliate params detected
    };
    alternatives: Array<{
      program_id: string;       // UUID from affiliate_programs
      network: string;          // "awin"
      network_display: string;  // "Awin"
      brand_name: string;       // "Sony"
      match_type: string;       // "exact_brand" | "category" | "general"
      commission_rate_low: number;
      commission_rate_high: number;
      commission_type: string;
      cookie_duration: number;  // days
      requires_application: boolean;
      approval_difficulty: string;
      confidence_score: number; // 1-5
      last_verified: string;    // ISO date
      regions: string[];
      potential_gain: {
        monthly_low: number;
        monthly_high: number;
        yearly_low: number;
        yearly_high: number;
      };
      action_steps: Array<{
        step: number;
        instruction: string;
        url?: string;           // Link to signup/apply
      }>;
      signup_url?: string;
    }>;
    insights: Array<{
      type: 'opportunity' | 'action' | 'tip' | 'warning';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
      action_url?: string;
    }>;
  }>;
}
```

### 6b. `POST /api/optimizer/quick-analyze` (NEW)

Single URL analysis without saving to product library.

**Request:**
```typescript
{
  url: string;
  title?: string;  // Optional
}
```

**Response:** Same structure as batch-analyze but with a single result and no session_id.

### 6c. `POST /api/optimizer/actions` (NEW)

Track user actions on analysis results.

**Request:**
```typescript
{
  analysis_id: string;       // UUID from link_analyses
  action: 'saved' | 'applied' | 'dismissed';
  switched_to_program_id?: string;  // UUID if action is 'applied'
}
```

**Response:**
```typescript
{ success: true }
```

---

## 7. Commission Analysis Engine (Core Logic)

### File: `frontend/app/api/optimizer/batch-analyze/route.ts`

The existing file should be rewritten with the following logic. Keep it in the Next.js API route (don't move to backend worker) since it only does DB queries and computation.

### Analysis Pipeline (pseudocode)

```typescript
async function analyzeProduct(product: ProductInput, userId: string): Promise<ProductResult> {

  // STEP 1: Platform Detection
  const platform = detectPlatform(product.product_url);
  // Returns: { key: 'amazon_de', name: 'Amazon DE', defaultRate: 3, cookieDuration: 24, cookieUnit: 'hours' }

  // STEP 2: Brand Detection (cascading strategy)
  const brand = await detectBrand(product);
  // Strategy order:
  //   1. product.brand (user-provided)
  //   2. KNOWN_BRANDS list match against product.title
  //   3. brand_aliases DB lookup by URL domain
  //   4. extractBrandFromUrl (domain name parsing)
  //   5. First capitalized word from title (lowest confidence)

  // STEP 3: Category Classification
  const category = classifyCategory(product.title, product.product_url);
  // Uses keyword matching from AMAZON_CATEGORY_PATTERNS
  // Falls back to 'general' if no match

  // STEP 4: Current Commission Rate
  const currentRate = await getCurrentRate(platform, category);
  // Query platform_commission_rates table first
  // Fall back to platform.defaultRate

  // STEP 5: Find Alternatives (THE CORE)
  const alternatives = await findAlternatives(brand, category, currentRate, platform);
  // See Section 8 for the full matching pipeline

  // STEP 6: Calculate Gains
  const enrichedAlternatives = await calculateGains(alternatives, currentRate, userId);

  // STEP 7: Generate Action Steps
  const withActions = enrichedAlternatives.map(alt => ({
    ...alt,
    action_steps: generateActionSteps(alt, platform)
  }));

  // STEP 8: Generate Insights (max 3, quality over quantity)
  const insights = generateInsights(platform, brand, category, currentRate, withActions);

  return { ...result, alternatives: withActions, insights };
}
```

### Action Steps Generation

For each alternative, generate specific steps:

```typescript
function generateActionSteps(alternative, currentPlatform): ActionStep[] {
  const steps: ActionStep[] = [];

  // Step 1: Always starts with joining the network
  if (alternative.requires_application) {
    steps.push({
      step: 1,
      instruction: `Apply to ${alternative.brand_name}'s program on ${alternative.network_display}`,
      url: alternative.signup_url || getNetworkSignupUrl(alternative.network)
    });
    steps.push({
      step: 2,
      instruction: `Wait for approval (typically ${getApprovalTime(alternative.approval_difficulty)})`
    });
    steps.push({
      step: 3,
      instruction: `Once approved, generate your affiliate link from the ${alternative.network_display} dashboard`
    });
    steps.push({
      step: 4,
      instruction: `Replace the ${currentPlatform.name} link in your storefront with the new link`
    });
  } else {
    steps.push({
      step: 1,
      instruction: `Sign up for ${alternative.network_display} as a publisher (free)`,
      url: getNetworkSignupUrl(alternative.network)
    });
    steps.push({
      step: 2,
      instruction: `Search for "${alternative.brand_name}" in the program directory and join`
    });
    steps.push({
      step: 3,
      instruction: `Generate your affiliate link and replace the current one in your storefront`
    });
  }

  return steps;
}

function getApprovalTime(difficulty: string): string {
  switch (difficulty) {
    case 'easy': return '1-2 days';
    case 'medium': return '3-7 days';
    case 'hard': return '1-2 weeks';
    default: return '3-7 days';
  }
}

function getNetworkSignupUrl(network: string): string {
  const urls: Record<string, string> = {
    'awin': 'https://www.awin.com/gb/publishers',
    'shareasale': 'https://www.shareasale.com/newsignup.cfm',
    'impact': 'https://impact.com/partnerships/',
    'cj': 'https://www.cj.com/publisher',
    'rakuten': 'https://rakutenadvertising.com/publisher/',
    'partnerstack': 'https://partnerstack.com/',
    'tradedoubler': 'https://www.tradedoubler.com/en/publishers/',
  };
  return urls[network] || '';
}
```

### Insight Generation Rules

```typescript
function generateInsights(platform, brand, category, currentRate, alternatives): Insight[] {
  const insights: Insight[] = [];

  // RULE 1: If alternatives found with significant gain (>€10/month)
  if (alternatives.length > 0 && alternatives[0].potential_gain.monthly_high > 10) {
    insights.push({
      type: 'opportunity',
      title: `Save up to €${Math.round(alternatives[0].potential_gain.yearly_high)}/year`,
      description: `${brand.name} products earn ${alternatives[0].commission_rate_low}-${alternatives[0].commission_rate_high}% on ${alternatives[0].network_display} vs ${currentRate}% on ${platform.name}.`,
      priority: 'high'
    });
  }

  // RULE 2: If on Amazon with electronics (worst case)
  if (platform.key?.startsWith('amazon_') && category.name === 'electronics') {
    insights.push({
      type: 'tip',
      title: 'Electronics: Amazon\'s lowest category',
      description: `Electronics earn only 1% on Amazon. Brand-direct programs typically pay 3-10%. This is the single biggest commission upgrade for most creators.`,
      priority: 'high'
    });
  }

  // RULE 3: If no affiliate tracking detected on URL
  if (!platform && !hasAffiliateTracking(url)) {
    insights.push({
      type: 'warning',
      title: 'No affiliate tracking detected',
      description: `This appears to be a direct link without commission tracking. You're sending traffic but not earning from it.`,
      priority: 'high'
    });
  }

  // RULE 4: Cookie duration advantage
  if (alternatives.length > 0 && platform.cookieUnit === 'hours') {
    const bestCookie = Math.max(...alternatives.map(a => a.cookie_duration));
    insights.push({
      type: 'tip',
      title: `${bestCookie}-day cookie vs ${platform.cookieDuration}-hour`,
      description: `Amazon's 24-hour cookie means you lose credit if the customer doesn't buy immediately. ${alternatives[0].network_display} gives ${bestCookie} days.`,
      priority: 'medium'
    });
  }

  // RULE 5: If already on premium network
  if (['awin', 'impact', 'shareasale'].includes(platform.key)) {
    insights.push({
      type: 'tip',
      title: 'You\'re on a premium network',
      description: `${platform.name} typically offers good rates. Check if you qualify for tiered bonuses based on performance volume.`,
      priority: 'low'
    });
  }

  // Return max 3, sorted by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return insights
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 3);
}
```

---

## 8. Product Matching Pipeline

This is the most critical piece of logic. The matching must be accurate and avoid false positives.

### Brand Detection (cascading, stop at first confident match)

```typescript
async function detectBrand(product: ProductInput): Promise<BrandResult> {

  // LEVEL 1: User-provided brand (highest confidence)
  if (product.brand) {
    return {
      name: product.brand,
      slug: slugify(product.brand),
      detected_from: 'user_provided',
      confidence: 5
    };
  }

  // LEVEL 2: Known brands list match in title
  if (product.title) {
    const match = matchKnownBrand(product.title);
    if (match) {
      return {
        name: match,
        slug: slugify(match),
        detected_from: 'known_brands',
        confidence: 4
      };
    }
  }

  // LEVEL 3: Brand aliases DB lookup by URL domain
  const domain = extractDomain(product.product_url);
  if (domain) {
    const { data: alias } = await supabase
      .from('brand_aliases')
      .select('brand_slug')
      .eq('alias', domain)
      .eq('alias_type', 'domain')
      .single();

    if (alias) {
      const { data: program } = await supabase
        .from('affiliate_programs')
        .select('brand_name')
        .eq('brand_slug', alias.brand_slug)
        .limit(1)
        .single();

      return {
        name: program?.brand_name || alias.brand_slug,
        slug: alias.brand_slug,
        detected_from: 'alias_db',
        confidence: 4
      };
    }
  }

  // LEVEL 4: URL domain parsing (medium confidence)
  const brandFromUrl = extractBrandFromUrl(product.product_url);
  if (brandFromUrl) {
    return {
      name: brandFromUrl,
      slug: slugify(brandFromUrl),
      detected_from: 'url_domain',
      confidence: 2
    };
  }

  // LEVEL 5: First capitalized word from title (low confidence)
  if (product.title) {
    const firstCap = extractFirstCapitalizedWord(product.title);
    if (firstCap) {
      return {
        name: firstCap,
        slug: slugify(firstCap),
        detected_from: 'title_heuristic',
        confidence: 1
      };
    }
  }

  return {
    name: 'Unknown',
    slug: 'unknown',
    detected_from: 'none',
    confidence: 0
  };
}
```

### Alternative Finding (multi-strategy)

```typescript
async function findAlternatives(
  brand: BrandResult,
  category: CategoryResult,
  currentRate: number,
  platform: PlatformResult
): Promise<AlternativeProgram[]> {

  let alternatives: AlternativeProgram[] = [];

  // STRATEGY 1: Exact brand match (highest value)
  if (brand.slug && brand.slug !== 'unknown') {
    const { data: brandMatches } = await supabase
      .from('affiliate_programs')
      .select('*')
      .or(`brand_slug.eq.${brand.slug},brand_slug.ilike.%${brand.slug}%`)
      .eq('is_active', true)
      .order('commission_rate_high', { ascending: false })
      .limit(5);

    if (brandMatches?.length) {
      // Filter: only show alternatives that are BETTER than current
      alternatives = brandMatches
        .filter(p => p.commission_rate_high > currentRate)
        .map(p => ({ ...p, match_type: 'exact_brand' }));
    }
  }

  // STRATEGY 2: Brand alias fuzzy match
  if (alternatives.length === 0 && brand.name !== 'Unknown') {
    const { data: aliasMatches } = await supabase
      .from('brand_aliases')
      .select('brand_slug')
      .ilike('alias', `%${brand.slug}%`);

    if (aliasMatches?.length) {
      const slugs = [...new Set(aliasMatches.map(a => a.brand_slug))];
      const { data: programs } = await supabase
        .from('affiliate_programs')
        .select('*')
        .in('brand_slug', slugs)
        .eq('is_active', true)
        .gt('commission_rate_high', currentRate)
        .order('commission_rate_high', { ascending: false })
        .limit(5);

      if (programs?.length) {
        alternatives = programs.map(p => ({ ...p, match_type: 'alias_match' }));
      }
    }
  }

  // STRATEGY 3: Same category, better rate (only if no brand match)
  if (alternatives.length === 0 && category.name !== 'general') {
    const { data: categoryMatches } = await supabase
      .from('affiliate_programs')
      .select('*')
      .eq('category', category.name)
      .eq('is_active', true)
      .gt('commission_rate_high', currentRate)
      .order('commission_rate_high', { ascending: false })
      .limit(3);

    if (categoryMatches?.length) {
      alternatives = categoryMatches.map(p => ({ ...p, match_type: 'category' }));
    }
  }

  // STRATEGY 4: Network suggestion (lowest confidence, only for Amazon)
  // Do NOT add this as an "alternative" - instead add it as an insight.
  // Alternatives should only be specific programs.

  // Filter: remove programs on the SAME network as current (no point switching Amazon to Amazon)
  if (platform?.key) {
    const currentNetwork = platform.key.split('_')[0]; // 'amazon', 'awin', etc.
    alternatives = alternatives.filter(a => a.network !== currentNetwork);
  }

  // Sort by potential gain (commission_rate_high - currentRate, descending)
  alternatives.sort((a, b) =>
    (b.commission_rate_high - currentRate) - (a.commission_rate_high - currentRate)
  );

  // Return top 3 only (quality over quantity)
  return alternatives.slice(0, 3);
}
```

### Gain Calculation

```typescript
async function calculateGains(
  alternatives: AlternativeProgram[],
  currentRate: number,
  userId: string
): Promise<EnrichedAlternative[]> {

  // Try to get actual traffic data
  const { data: trafficData } = await supabase
    .from('affiliate_transactions')
    .select('clicks, commission_eur')
    .eq('user_id', userId)
    .gte('transaction_date', thirtyDaysAgo());

  const monthlyClicks = trafficData?.reduce((sum, tx) => sum + (tx.clicks || 0), 0) || 0;
  const estimatedClicks = monthlyClicks > 0 ? monthlyClicks : 500;  // Default estimate

  const CONVERSION_RATE = 0.02;  // 2% industry average
  const AVG_ORDER_VALUE = 50;    // EUR, conservative

  return alternatives.map(alt => {
    const currentMonthly = estimatedClicks * CONVERSION_RATE * AVG_ORDER_VALUE * (currentRate / 100);
    const newMonthlyLow = estimatedClicks * CONVERSION_RATE * AVG_ORDER_VALUE * (alt.commission_rate_low / 100);
    const newMonthlyHigh = estimatedClicks * CONVERSION_RATE * AVG_ORDER_VALUE * (alt.commission_rate_high / 100);

    const gainLow = Math.max(0, newMonthlyLow - currentMonthly);
    const gainHigh = Math.max(0, newMonthlyHigh - currentMonthly);

    return {
      ...alt,
      potential_gain: {
        monthly_low: Math.round(gainLow * 100) / 100,
        monthly_high: Math.round(gainHigh * 100) / 100,
        yearly_low: Math.round(gainLow * 12 * 100) / 100,
        yearly_high: Math.round(gainHigh * 12 * 100) / 100,
      }
    };
  });
}
```

---

## 9. UI Specification

### 9a. Quick Analyze Input (NEW component)

Location: Top of the optimizer page, above the product library.

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚡ Quick Commission Check                                       │
│                                                                    │
│  ┌──────────────────────────────────────┐  ┌──────────────────┐  │
│  │ Paste any product URL...             │  │  Check Rate  ⚡  │  │
│  └──────────────────────────────────────┘  └──────────────────┘  │
│                                                                    │
│  Check any link instantly. No need to save it first.              │
└──────────────────────────────────────────────────────────────────┘
```

### 9b. Results Summary Bar

Displayed at the top of results, before individual product cards.

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Commission Agent Results                                         │
│                                                                    │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │  5 products  │  │  3 opportunities │  │  €45-€120/month  │    │
│  │  analyzed    │  │  found           │  │  potential extra  │    │
│  └──────────────┘  └──────────────────┘  └──────────────────┘    │
│                                                                    │
│  Yearly projection: €540-€1,440                                   │
│                                                                    │
│  [← Back to Products]                         [Re-analyze All]    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9c. Product Result Card (one per product)

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Sony WH-1000XM5 Headphones                                      │
│  Brand: Sony  •  Category: Electronics  •  Confidence: ●●●●○     │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CURRENT                                                    │  │
│  │  Amazon DE  •  Commission: 1%  •  Cookie: 24 hours          │  │
│  │  Est. earnings: €5/month                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🥇 BETTER ALTERNATIVE                                      │  │
│  │                                                              │  │
│  │  Sony via Awin                                               │  │
│  │  Commission: 3-8%  •  Cookie: 30 days  •  ●●●●○ High       │  │
│  │  Potential extra: €10-€35/month (€120-€420/year)            │  │
│  │  Last verified: Jan 2026  •  Requires application           │  │
│  │                                                              │  │
│  │  How to switch:                                              │  │
│  │  1. Apply to Sony's program on Awin  [→ Apply]              │  │
│  │  2. Wait for approval (3-7 days)                            │  │
│  │  3. Generate your affiliate link from Awin dashboard        │  │
│  │  4. Replace the Amazon link in your storefront              │  │
│  │                                                              │  │
│  │  [✓ I've Applied]  [Save for Later]  [Dismiss]              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💡 INSIGHT                                                  │  │
│  │  Electronics: Amazon's lowest category                       │  │
│  │  Electronics earn only 1% on Amazon. Brand-direct programs  │  │
│  │  typically pay 3-10%.                                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  [Show 2 more alternatives ▼]                                     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9d. Product Card - No Opportunities Found

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Zalando Summer Dress                                             │
│  Brand: Zalando  •  Category: Fashion  •  Confidence: ●●●●●      │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  CURRENT                                                    │  │
│  │  Awin  •  Commission: 6-12%  •  Cookie: 30 days            │  │
│  │  ✓ You're already on a competitive program                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  💡 TIP                                                      │  │
│  │  You're on a premium network. Check if you qualify for      │  │
│  │  tiered bonuses based on performance volume.                │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9e. Product Card - No Tracking Detected

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                    │
│  Copenhagen Studios Boots                                         │
│  Brand: Copenhagen Studios  •  Category: Fashion                  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  ⚠️  NO AFFILIATE TRACKING DETECTED                        │  │
│  │  This is a direct link. You're sending traffic but          │  │
│  │  not earning commissions from it.                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  🔍 ACTION REQUIRED                                         │  │
│  │                                                              │  │
│  │  Search for "Copenhagen Studios affiliate program" or       │  │
│  │  check these networks:                                      │  │
│  │                                                              │  │
│  │  [→ Search on Awin]  [→ Search on Impact]                   │  │
│  │  [→ Search on ShareASale]                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### 9f. Confidence Score Display

Display as filled/empty dots:

```typescript
function ConfidenceScore({ score }: { score: number }) {
  // 1-5 scale
  // 5: ●●●●● "Verified"
  // 4: ●●●●○ "High"
  // 3: ●●●○○ "Medium"
  // 2: ●●○○○ "Low"
  // 1: ●○○○○ "Estimated"
}
```

### 9g. Visual Design Notes

- Use the existing design system (Tailwind + dark theme as shown in current components)
- Cards should use `bg-card border border-border rounded-xl`
- Opportunity highlights: `bg-emerald-500/10 border-emerald-500/20`
- Warnings: `bg-amber-500/10 border-amber-500/20`
- Actions: `bg-blue-500/10 border-blue-500/20`
- The "Best Alternative" card should be visually prominent (subtle green gradient border)
- Collapsed alternatives use a "Show X more" toggle
- Action buttons: primary for "I've Applied", secondary for "Save", ghost for "Dismiss"

---

## 10. Data Sources & Rate Intelligence

### Where commission rates come from

| Source | Reliability | How to Populate |
|--------|------------|-----------------|
| Official program pages | High (4-5) | Manual research, update quarterly |
| Network program directories | Medium-High (3-4) | Awin/Impact publisher dashboards |
| Industry reports | Medium (3) | Commission Junction, Affiliate Summit data |
| Community data | Low-Medium (2-3) | Creator forums, surveys |

### Rate Accuracy Policy

1. **Always store ranges** (`commission_rate_low` / `commission_rate_high`)
2. **Never say "you WILL earn X%"** - say "programs typically pay X-Y%"
3. **Show `last_verified` date** on every alternative
4. **Mark confidence** (1-5) on every result
5. **Include disclaimer** at bottom of results: "Commission rates are estimates based on publicly available program information. Actual rates may vary based on your account, performance tier, and program terms."

### Keeping Data Fresh

For the initial implementation, data is manually seeded. Future iterations should add:
- A Supabase Edge Function that runs weekly to update `last_verified_at`
- Admin UI to update rates
- Community contribution system (creators report their actual rates)

**For now:** Seed the DB with accurate data as of the implementation date. Set all `last_verified_at` to that date. Set `source` to `'manual'`.

---

## 11. Edge Cases & Error Handling

### URL Edge Cases

| Case | Handling |
|------|----------|
| Shortened URL (bit.ly, t.co) | Show warning: "Shortened URL detected. For best results, paste the full product URL." Do not attempt to resolve. |
| URL with no path (just domain) | Treat as brand homepage. Detect brand from domain, show affiliate programs for that brand. |
| Invalid URL | Show error: "Please enter a valid URL" |
| Already an affiliate link (has tag/ref) | Detect and show: "This link already has affiliate tracking via [platform]." Then show alternatives. |
| Amazon short link (amzn.to) | Detect as Amazon. Cannot extract ASIN from short link. Show warning and suggest pasting the full Amazon URL. |
| LTK link (rstyle.me) | Detect as LTK platform. Extract product info from title if available. |

### Analysis Edge Cases

| Case | Handling |
|------|----------|
| Brand not in our DB | Show: "We don't have [Brand] in our database yet. Check these networks: [Awin] [Impact] [ShareASale]" |
| Already on best available program | Show: "You're already on a competitive program. Consider negotiating tiered rates." |
| Product has no category match | Use 'general' category. Show general tips only. |
| User has no traffic data | Use default estimates (500 clicks/month, 2% CR, €50 AOV). Show note: "Earnings estimates based on average creator traffic." |
| Rate is 0% (direct link) | Special handling: show as "No commission" and highlight the opportunity to monetize. |

### Error Handling

```typescript
// Per-product error handling (don't fail the whole batch)
for (const product of products) {
  try {
    const result = await analyzeProduct(product, userId);
    results.push(result);
  } catch (error) {
    console.error(`[CommissionAgent] Failed to analyze ${product.product_url}:`, error);
    results.push({
      productId: product.id,
      productName: product.title || 'Unknown Product',
      error: 'Analysis failed for this product. Please try again.',
      alternatives: [],
      insights: []
    });
  }
}
```

---

## 12. Implementation Order

Follow this exact order. Each step should be a separate commit.

### Step 1: Database Expansion

1. Create `COMMISSION_AGENT_SEED_V2.sql` with 100+ affiliate programs
2. Expand `brand_aliases` with comprehensive domain/name mappings
3. Add platform commission rates for Amazon UK, US, FR, IT, ES
4. Add `commission_agent_sessions` table
5. Add new columns to `link_analyses` table
6. Run migrations in Supabase

### Step 2: Rewrite Analysis Engine

1. Rewrite `frontend/app/api/optimizer/batch-analyze/route.ts`
2. Implement the full pipeline: detect -> match -> calculate -> generate
3. Add action steps generation
4. Add session tracking
5. Improve insight generation (max 3, quality rules)
6. Add cookie duration comparison
7. Add yearly projections

### Step 3: Add Quick Analyze Endpoint

1. Create `frontend/app/api/optimizer/quick-analyze/route.ts`
2. Single URL analysis, no save required
3. Shares engine with batch-analyze

### Step 4: Add Actions Endpoint

1. Create `frontend/app/api/optimizer/actions/route.ts`
2. Handle saved/applied/dismissed actions
3. Update `link_analyses` table

### Step 5: Rewrite Results UI

1. Create `frontend/components/optimizer/ProductResultCard.tsx`
2. Create `frontend/components/optimizer/AlternativeCard.tsx`
3. Create `frontend/components/optimizer/InsightBadge.tsx`
4. Create `frontend/components/optimizer/ActionSteps.tsx`
5. Rewrite `frontend/components/optimizer/AnalysisResults.tsx` to use new components
6. Add summary bar at top of results
7. Add action buttons (Applied, Save, Dismiss)

### Step 6: Add Quick Analyze UI

1. Create `frontend/components/optimizer/QuickAnalyzeInput.tsx`
2. Integrate into `SmartOptimizer.tsx` at the top
3. Show inline results for quick analysis

### Step 7: Polish & Quality

1. Add loading states and animations
2. Add empty states
3. Add the disclaimer text at bottom of results
4. Test with various URL types
5. Verify all edge cases from Section 11

---

## Appendix A: Complete TypeScript Interfaces

```typescript
// === INPUT TYPES ===

interface ProductInput {
  id: string;
  product_url: string;
  title?: string | null;
  brand?: string | null;
}

// === INTERNAL TYPES ===

interface PlatformDetection {
  key: string;          // 'amazon_de', 'awin', etc.
  name: string;         // 'Amazon DE'
  defaultRate: number;  // 3
  cookieDuration: number; // 24 for Amazon (hours), 30 for others (days)
  cookieUnit: 'hours' | 'days';
  tips: string[];
  betterNetworks: string[];
  isAffiliate: boolean;
}

interface BrandResult {
  name: string;
  slug: string;
  detected_from: 'user_provided' | 'known_brands' | 'alias_db' | 'url_domain' | 'title_heuristic' | 'none';
  confidence: number; // 0-5
}

interface CategoryResult {
  name: string;
  detected_from: 'keywords' | 'db_lookup' | 'default';
  rate?: number; // Amazon category-specific rate
}

// === OUTPUT TYPES ===

interface AnalysisSession {
  session_id: string;
  summary: SessionSummary;
  results: ProductResult[];
}

interface SessionSummary {
  products_analyzed: number;
  opportunities_found: number;
  total_potential_gain_low: number;
  total_potential_gain_high: number;
  total_yearly_low: number;
  total_yearly_high: number;
}

interface ProductResult {
  productId: string;
  productName: string;
  brand: {
    name: string;
    detected_from: string;
    confidence: number;
  };
  category: {
    name: string;
    detected_from: string;
  };
  current: {
    url: string;
    platform: string;
    platform_name: string;
    commission_rate: number;
    commission_type: string;
    cookie_duration: number;
    cookie_unit: 'hours' | 'days';
    has_tracking: boolean;
  };
  alternatives: AlternativeResult[];
  insights: Insight[];
  error?: string;
}

interface AlternativeResult {
  program_id: string;
  network: string;
  network_display: string;
  brand_name: string;
  match_type: 'exact_brand' | 'alias_match' | 'category' | 'general';
  commission_rate_low: number;
  commission_rate_high: number;
  commission_type: string;
  cookie_duration: number;
  requires_application: boolean;
  approval_difficulty: string;
  confidence_score: number;
  last_verified: string;
  regions: string[];
  potential_gain: {
    monthly_low: number;
    monthly_high: number;
    yearly_low: number;
    yearly_high: number;
  };
  action_steps: ActionStep[];
  signup_url?: string;
}

interface ActionStep {
  step: number;
  instruction: string;
  url?: string;
}

interface Insight {
  type: 'opportunity' | 'action' | 'tip' | 'warning';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}
```

---

## Appendix B: Disclaimer Text

Place at the bottom of all results views:

> Commission rates shown are estimates based on publicly available program information as of [last_verified date]. Actual rates may vary based on your account status, performance tier, negotiated terms, and current program conditions. Affimark does not guarantee specific commission rates or earnings. Always verify rates directly with the affiliate network before switching programs.

---

## Appendix C: Known Brands List (Expanded)

The KNOWN_BRANDS array in the analysis engine should include at minimum:

```typescript
const KNOWN_BRANDS = [
  // Electronics
  'sony', 'samsung', 'apple', 'bose', 'jbl', 'beats', 'sennheiser',
  'logitech', 'razer', 'corsair', 'steelseries', 'hyperx',
  'dyson', 'philips', 'braun', 'panasonic', 'lg', 'dell', 'hp', 'lenovo', 'asus', 'acer',
  'gopro', 'dji', 'canon', 'nikon', 'fujifilm',
  'anker', 'belkin', 'ugreen', 'baseus',
  'fitbit', 'garmin', 'polar', 'whoop', 'oura',

  // Fashion
  'zara', 'h&m', 'mango', 'uniqlo', 'gap', 'cos', 'arket', '& other stories',
  'levi\'s', 'calvin klein', 'tommy hilfiger', 'ralph lauren', 'hugo boss',
  'nike', 'adidas', 'puma', 'reebok', 'new balance', 'asics', 'converse', 'vans',
  'lululemon', 'gymshark', 'fabletics', 'alo yoga',
  'north face', 'patagonia', 'columbia', 'arc\'teryx', 'salomon',
  'zalando', 'asos', 'aboutyou', 'na-kd', 'boohoo', 'prettylittlething',
  'net-a-porter', 'farfetch', 'mytheresa', 'ssense', 'matchesfashion',
  'nordstrom', 'revolve',

  // Beauty
  'sephora', 'douglas', 'flaconi', 'ulta',
  'mac', 'nyx', 'maybelline', 'l\'oreal', 'estee lauder', 'clinique',
  'charlotte tilbury', 'nars', 'urban decay', 'too faced', 'benefit',
  'the ordinary', 'cerave', 'paula\'s choice', 'glossier', 'drunk elephant',
  'fenty beauty', 'rare beauty', 'ilia', 'merit',

  // Home
  'ikea', 'wayfair', 'westwing', 'west elm', 'cb2', 'crate & barrel',
  'zara home', 'h&m home', 'made.com', 'article',

  // Software/SaaS
  'shopify', 'canva', 'notion', 'hubspot', 'semrush', 'ahrefs',

  // Travel
  'booking.com', 'expedia', 'airbnb', 'getyourguide',

  // Food
  'hellofresh',
];
```

---

## Summary: What Makes This Different From Current

| Current Implementation | New Commission Agent |
|----------------------|---------------------|
| Static brand list matching only | Multi-level cascading detection (5 strategies) |
| Generic tips regardless of context | Max 3 targeted insights per product |
| No action steps | Specific step-by-step "how to switch" guide |
| No cookie duration comparison | Cookie window highlighted as key advantage |
| Monthly estimates only | Monthly + yearly projections |
| No quick analyze | Single-URL instant check |
| No action tracking | Save / Applied / Dismiss workflow |
| No session tracking | Session summaries with aggregate gains |
| 28 programs in DB | 100+ programs with comprehensive aliases |
| Only Amazon DE rates | Amazon DE/UK/US/FR/IT/ES + LTK rates |
| Results as flat list | Structured cards with current vs. alternative |
| No visual hierarchy | Best alternative highlighted, others collapsed |
| No disclaimer | Legal disclaimer on all results |
