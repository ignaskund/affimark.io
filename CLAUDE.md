## AffiMark v2 – Claude Code Guide

**"Optimize for Revenue That Stays."**

AffiMark is **affiliate revenue risk intelligence** for storefront owners. We analyze entire creator portfolios across all platforms (Amazon, Awin, LTK, ShopMy), score every product for risk, flag fragile revenue, and suggest better alternatives — so creators can protect margin, not just scale traffic.

**Positioning:** This is NOT "another analytics dashboard" or "another link optimizer." This is **risk-adjusted affiliate revenue** — the first platform that treats affiliate income like a portfolio to be audited, not just a number to grow.

**PRIMARY FOCUS: Portfolio Risk Audit + Alternative Search Quality.** The onboarding flow (Linktree URL scan + priority ranking) feeds both the portfolio audit and the alternative product search. See `AGENTS.md` for the complete data pipeline and `AGENT_INSTRUCTIONS.md` for MVP task breakdown.

---

## Core Concept: Risk-Adjusted Affiliate Revenue

Most affiliate tools help creators scale traffic. AffiMark helps creators **protect margin**.

**The formula:**

```
Revenue Stability = f(Merchant Trust, Refund Exposure, Commission Durability, Demand Evidence)
```

**Four risk signals scored per product (0-100):**

| Signal | What It Measures | Example Risk |
|--------|-----------------|--------------|
| **Merchant Stability** | Seller trustworthiness, platform reliability | DHgate seller with 2-star rating |
| **Refund Risk** | Return rates, category fragility | Fashion/beauty items with 30%+ return rates |
| **Commission Durability** | Cookie window, program stability, rate history | Amazon 1-day cookie vs Awin 30-day |
| **Demand Evidence** | Reviews, search volume, seasonal patterns | Product with 3 reviews vs 10,000 |

**Verdicts:**
- `overall >= 70` → **KEEP** (stable revenue)
- `overall >= 50 && < 70` → **REVIEW** (moderate risk)
- `overall < 50` → **REPLACE** (fragile revenue)

---

## Target Market

**Primary ICP:** EU-based content creators (5K-100K followers) managing:
- Multiple storefronts across different platforms
- Amazon Storefronts (DE, UK, FR, IT, ES)
- LTK (RewardStyle)
- ShopMy
- Awin affiliate programs
- Tradedoubler affiliate programs

**Why This Tier:**
- Professional enough to have significant revenue
- Usually don't have a full-time business manager
- Feel "out of control" with fragmented dashboards
- GDPR compliance burden is real

**Competitive Moat:** EU-based company. Data residency and GDPR compliance as creators become wary of US platforms.

---

## Core Value Proposition

**NOT this:** "Yet another analytics dashboard" / "We fix affiliate injustice" / "We guarantee higher commissions"

**THIS:** Risk intelligence. Revenue protection. Portfolio clarity.

| Problem | AffiMark Solution | Tangible Value |
|---------|-------------------|----------------|
| No idea which products are risky | Portfolio Risk Audit scores every product | "8 of your 47 products are fragile. Here's why." |
| 65% revenue from one merchant | Merchant concentration detection | "If Amazon changes rates, you lose €2,700/mo." |
| High-return categories erode earnings | Refund risk scoring by category | "Beauty products: 30% return rate eating your commission." |
| Short cookie = lost attribution | Commission durability scoring | "1-day cookie on €349 headphones? Here's a 30-day option." |
| Default to Amazon (3%) | Alternative search finds better programs | "Same product. Triple the commission. €40-€80/mo extra." |
| Links break silently | Health monitoring + loss estimates | "This link was broken 6 hrs. Saved: €42-€110." |
| Tax prep takes hours | One-click export + tax personas | "German freelancer? Done in 10 seconds." |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONNECTED STOREFRONTS                         │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│   │ Amazon  │  │  Awin   │  │  Trade- │  │   LTK   │           │
│   │ (CSV)   │  │ (OAuth) │  │ doubler │  │  (CSV)  │           │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │
└────────┼────────────┼────────────┼────────────┼─────────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AFFIMARK CORE                                 │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  ★ Portfolio Risk Audit (HERO)                           │   │
│   │  Score every product → Flag fragile revenue →            │   │
│   │  Suggest alternatives                                    │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   Unified   │  │   Revenue   │  │   Smart     │             │
│   │  Dashboard  │  │ Loss Ledger │  │  Optimizer  │             │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │  Tax-Ready  │  │   In-App    │  │ Attribution │             │
│   │   Export    │  │  Browser    │  │ Diagnostics │             │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   Platform  │  │  Dead Stock │  │   Brand     │             │
│   │ Reliability │  │ Auto-Switch │  │ Pitch Deck  │             │
│   └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Current MVP: Portfolio Risk Audit

The current sprint is building the **Portfolio Risk Audit** — the hero feature promised on the landing page. See `AGENT_INSTRUCTIONS.md` for the complete task breakdown.

### What's Being Built (6 Tasks)

| Task | What | File(s) | Status |
|------|------|---------|--------|
| 1 | Portfolio audit backend endpoint | `backend/src/routes/portfolio-routes.ts` | To build |
| 2 | Portfolio audit frontend page | `frontend/app/dashboard/portfolio-audit/page.tsx` | To build |
| 3 | Product risk card in finder | `frontend/components/finder/ProductRiskCard.tsx` | To build |
| 4 | Landing page | `frontend/app/page.tsx` | To build |
| 5 | Dashboard integration | `frontend/app/dashboard/page.tsx` | To build |
| 6 | Product finder pre-fill from audit | `frontend/components/finder/ProductFinder.tsx` | To build |

### What Already Exists (DO NOT rebuild)

**Backend (`backend/src/`):**
- **MCP Agent** (`mcp/agent.ts`): Product identification + alternative search via Datafeedr
- **Outcome Feasibility Scorer** (`services/outcome-feasibility-scorer.ts`): 4 risk signals (merchantRisk, programFriction, demandEvidence, refundRisk)
- **Enrichment Layer** (`services/enrichment/`): Static + dynamic product enrichment
- **Priority KPI System** (`services/priority-kpi-specs.ts`): 16 KPIs (8 product + 8 brand)
- **Profile Builder** (`services/profile-builder.ts`): Loads priorities + social + storefront context
- **MCP Tools** (`mcp/tools.ts`): `getCreatorProfile`, `identifyProduct`, `searchAlternatives`, `scoreCandidate`

**Frontend (`frontend/`):**
- **Onboarding flow**: `/onboarding/magic` → `/onboarding/priorities` → dashboard
- **Product Finder**: `/dashboard/product-finder` with CardStack, ProductCard, FinderInput
- **Types**: `frontend/types/finder.ts`

**Database (Supabase — `pquedymrcxfzqwfpbrmh`):**
- Key tables: `profiles`, `user_creator_preferences`, `user_social_links`, `user_storefronts`, `user_storefront_products`, `user_product_profiles`, `product_finder_sessions`

### Execution Order

1. **Task 1** (portfolio audit endpoint) — everything depends on this
2. **Task 3** (risk card in finder) — small change, high impact
3. **Task 2** (portfolio audit page) — main deliverable
4. **Task 4** (landing page) — can parallel with Task 2
5. **Task 5** (dashboard integration)
6. **Task 6** (pre-fill from audit)

---

## Landing Page Sections

The landing page positions AffiMark as revenue risk intelligence:

1. **Hero**: "Optimize for Revenue That Stays." + "Run Portfolio Risk Audit" CTA
2. **The Hidden Problem**: What affiliates measure vs what they ignore
3. **Risk-Adjusted Revenue**: The formula + 4 metrics with icons
4. **Remove Fragile Revenue**: What you eliminate vs what you gain
5. **Differentiation**: "Most tools help you scale traffic. AffiMark helps you protect margin."
6. **Close**: "Audit Your Revenue Stability" CTA

**Design:** Dark background, minimal/institutional feel, typography-driven, monospace for metrics. Green=stable, amber=review, red=risk.

---

## Feature Specifications

### FEATURE 0: Portfolio Risk Audit (★ HERO — Current Sprint)

**Objective:** Analyze a creator's entire product portfolio and score every product for revenue risk.

**Endpoint:** `POST /api/portfolio/audit`

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
  "products": [...],
  "topRisks": [...]
}
```

**Frontend page** at `/dashboard/portfolio-audit`: Revenue Stability Index gauge, verdict cards (STABLE/REVIEW/REPLACE/UNANALYZED), risk breakdown bars, product list sorted by risk with "Find Better Alternative" buttons linking to product finder.

### FEATURE 1: Universal Data Import (Zero-Effort Onboarding)

**Objective:** Creators connect all storefronts in minutes. No manual data entry.

**Critical:** Onboarding must be "zero effort." The onboarding data powers both portfolio audit quality and alternative search quality.

**Flow:** Paste Linktree URL → auto-detect storefronts + products + socials → rank priorities → ready for audit.

### FEATURE 2: Unified Earnings Dashboard (Multi-Currency)

**Objective:** One view for all affiliate income. All amounts normalized to home currency.

**Dashboard includes:** Portfolio Health Summary card with Revenue Stability Index, products needing attention count, quick risk bars.

### FEATURE 3: Tax-Ready Export with Tax Personas

**Objective:** One-click export for tax season. GDPR Article 20 compliant.

**Guardrail:** Never imply tax advice. Use "Formatted for" not "compliant with."

### FEATURE 4: Link Health Monitor + Revenue Loss Ledger

**Objective:** Never send traffic to dead ends. Frame issues as "money saved."

### FEATURE 5: Dead Stock Auto-Alternative

**Objective:** When product goes OOS, traffic still earns. Opt-in only, default OFF.

### FEATURE 6: SmartWrapper Links (Trust-First Design)

**Objective:** Own your traffic. Platform-independent links. Full transparency.

### FEATURE 7: In-App Browser Detection + Escape Prompt

**Objective:** Detect in-app browsers and help users escape to preserve tracking. Best-effort.

### FEATURE 8: Smart Link Optimizer

**Objective:** Find better-paying programs for the same product. Confidence ranges, not guarantees.

### FEATURE 9: Attribution Diagnostics (NOT "Protection")

**Objective:** Confidence checks for affiliate links. Diagnostics, not guarantees.

### FEATURE 10: Platform Reliability Score

**Objective:** Show patterns over time. Not accusations — patterns.

### FEATURE 11: Brand Pitch Deck Generator

**Objective:** Generate performance reports for brand negotiations.

---

## Feature Feasibility & Guardrails

| Feature | Status | Key Constraint |
|---------|--------|----------------|
| Portfolio Risk Audit | ★ Current Sprint | Uses existing feasibility scorer |
| Universal Data Import | Built (onboarding) | Linktree scan working |
| Unified Dashboard | Built (basic) | Needs portfolio health card |
| Tax-Ready Export | Planned | Never imply tax advice |
| Link Health Monitor | Planned | OOS detection: easy on Amazon, harder on JS-heavy |
| Smart Link Optimizer | Built (V2 agent) | Rates often private/tiered |
| Attribution Diagnostics | Planned | Framing is correct |

### Key Guardrails

- **Never claim guaranteed commission increases** — use ranges and estimates
- **Attribution is "diagnostics" not "protection"** — manage expectations
- **SmartWrapper transparency** — user can always see redirect chain
- **No commission skimming** — be explicit about this
- **EU-first messaging** — emphasize GDPR compliance, data residency
- **Money-saved framing** — alerts show value, not just problems
- **Risk scores are decision support** — not financial advice

---

## Repo Structure

```
backend/
├── src/
│   ├── index.ts
│   ├── api.ts                         # Route mounting
│   ├── mcp/
│   │   ├── agent.ts                   # MCP alternative search agent
│   │   ├── tools.ts                   # getCreatorProfile, identifyProduct, etc.
│   │   └── types.ts                   # AgentSearchResult, etc.
│   ├── routes/
│   │   ├── finder-routes.ts           # Product finder (search-v2)
│   │   ├── portfolio-routes.ts        # ★ Portfolio audit (NEW)
│   │   └── agent-routes.ts
│   ├── services/
│   │   ├── profile-builder.ts         # UserProfile from onboarding data
│   │   ├── multi-network-search.ts    # Dual-scoring search + ranking
│   │   ├── outcome-feasibility-scorer.ts  # 4 risk signals
│   │   ├── product-intent-analyzer.ts # AI intent extraction
│   │   ├── datafeedr-client.ts        # Datafeedr API
│   │   ├── enrichment/               # Static + dynamic enrichment
│   │   └── verifier/                 # 3-pillar scoring
│   └── workers/
│       └── health-check-cron.ts

frontend/
├── app/
│   ├── page.tsx                       # Landing page (risk audit messaging)
│   ├── dashboard/
│   │   ├── page.tsx                   # Dashboard + portfolio health card
│   │   ├── portfolio-audit/page.tsx   # ★ Portfolio audit page (NEW)
│   │   ├── product-finder/           # Alternative search
│   │   └── ...
│   └── onboarding/
│       ├── magic/                    # Linktree scan
│       └── priorities/               # Priority ranking
├── components/
│   ├── finder/
│   │   ├── ProductFinder.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductRiskCard.tsx        # ★ Risk card (NEW)
│   │   └── ...
│   └── ui/
├── types/
│   └── finder.ts                     # Core types
├── vite.config.ts                    # Vinext/Vite config for Cloudflare deploy
└── next.config.js                    # Next.js config (dev)
```

---

## Commands

```bash
# Backend
cd backend && npm run dev        # Wrangler dev server on port 8787
cd backend && npm run deploy     # Deploy to Cloudflare Workers

# Frontend (Next.js — local dev)
cd frontend && npm run dev       # Next.js dev on port 3000
cd frontend && npm run lint
cd frontend && npm run build     # Next.js production build

# Frontend (Vinext — Cloudflare deploy)
cd frontend && npm run dev:vinext   # Vite dev server on port 3001
cd frontend && npm run build:vinext # Vite production build
cd frontend && npm run deploy       # Build + deploy to Cloudflare Workers
```

---

## Deployment

### Backend
Cloudflare Workers via Wrangler. Config in `backend/wrangler.toml`.

### Frontend
**Vinext** (Cloudflare's Next.js reimplementation on Vite) for deployment to Cloudflare Workers.

- `vinext deploy` builds and deploys in one command
- 4.4x faster builds, 57% smaller bundles vs Next.js
- `vinext check` scans for compatibility issues
- Existing `next dev` still works for local development

**Known vinext compatibility notes:**
- `next-auth` relies on Next.js internals — consider migrating to `better-auth` for full vinext compatibility
- `next/font/google` fonts loaded from CDN (not self-hosted at build time)
- Images use `@unpic/react` (no local optimization)
- 88% overall compatibility

---

## Success Metrics

| Feature | Success Metric |
|---------|----------------|
| Portfolio Audit | Meaningful risk report for 3+ products |
| Onboarding | <5 min to see portfolio audit |
| Dashboard | <2s page load |
| Alternative Search | >80% brand identification, shown alternatives |
| Health Check | >99% issue detection accuracy |
| Loss Ledger | Users can articulate "AffiMark saved me €X" |
| Tax Export | <10s generation, persona-appropriate formatting |

---

## Test User

User `8acd050f-4dc3-4432-8a95-0057b816b46b` has:
- 2 storefronts (Amazon, Affiliate)
- 3 products (Amazon storefront links, Vegamour affiliate link)
- 4 social accounts (YouTube, Facebook, Instagram, TikTok)
- Priorities: quality > price > sustainability > reviews > shipping (product), commission > return_policy > customer_service > reputation > payment_speed (brand)
