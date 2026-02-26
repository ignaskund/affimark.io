## AffiMark Frontend – Claude Code Guide (v2)

Frontend: Next.js 15 (App Router) + TypeScript + Tailwind + Supabase + Stripe.

**Positioning:** Revenue protection + operational sanity + tax readiness. NOT "another analytics dashboard."

**PRIMARY FOCUS: Alternative Search Quality** — see `AGENTS.md` at repo root for the full onboarding→search pipeline.

---

## Core User Experience

**Primary User Flow (Onboarding → Search):**
```
Sign Up → Magic Onboarding (paste Linktree URL) → Priority Ranking → Dashboard → Search Alternatives
```

**Onboarding captures the data that powers search quality:**
1. `/onboarding/magic` — User pastes link-in-bio URL → we scrape storefronts, products, socials
2. `/onboarding/priorities` — User ranks 5 product priorities + 5 brand priorities
3. This data feeds `profile-builder.ts` on the backend, which creates a UserProfile used by every search

**Key Insight:** The alternative product search is the HERO feature. Onboarding is designed to maximize search quality by collecting context about the creator's niche, audience, and priorities.

**Trust-First Design:** Creators are wary of tools that "sit between" them and brands. Every feature must emphasize transparency, no commission skimming, and user control.

---

## Onboarding Pages (Critical for Search Quality)

| Path | Purpose | Data Captured |
|------|---------|---------------|
| `/onboarding/magic` | Paste Linktree/Beacons URL, auto-detect storefronts + products | Storefronts, products, social accounts → DB |
| `/onboarding/priorities` | Rank top 5 product + brand priorities via drag-and-drop | `user_creator_preferences.{product,brand}_priorities` |

### Priority Options (defined in `types/finder.ts`)

**Product priorities:** quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition
**Brand priorities:** commission, customer_service, return_policy, reputation, brand_sustainability, payment_speed, cookie_duration, easy_approval

These ranked priorities directly influence how alternatives are scored. Rank 1 gets 5x weight, rank 5 gets 1x weight.

### Search Components

| Component | Purpose |
|-----------|---------|
| `components/finder/FinderInput.tsx` | URL or category input for product search |
| `components/verifier/ProductVerifier.tsx` | Verifier UI with 3-pillar scores + alternatives |
| `components/verifier/RecommendationsBuckets.tsx` | Safe/Upside/Budget/Trending alternative groups |
| `components/verifier/WinnerRecommendationCard.tsx` | Top-pick alternative card |
| `components/optimizer/OptimizerAnalyzer.tsx` | Smart Link Optimizer UI |

---

## Page Architecture

### Public Pages (No Auth)

| Path | Purpose | Key Components |
|------|---------|----------------|
| `/` | Landing page | Hero (revenue protection), Value props, EU-first messaging |
| `/sign-in` | Authentication | Email/password or magic link |
| `/sign-up` | Registration | Email/password + OTP verification |

### Protected Pages (Auth Required)

| Path | Purpose | Key Components |
|------|---------|----------------|
| `/dashboard` | Unified earnings view | Multi-currency total, storefront breakdown, loss ledger preview |
| `/storefronts` | Connected accounts | Multiple storefronts per platform, sync status, add new |
| `/storefronts/connect/[platform]` | OAuth/CSV flow | Platform-specific instructions |
| `/products` | Tracked products | Health status, revenue loss ledger, auto-fallback settings |
| `/optimizer` | ★ Smart Link Optimizer | URL input, alternatives with confidence, create link |
| `/smartwrappers` | SmartWrapper list | All short links, click stats, trust indicators |
| `/smartwrappers/create` | Create SmartWrapper | Destination, fallback, in-app browser settings |
| `/smartwrappers/[id]` | SmartWrapper details | Edit, analytics, attribution diagnostics |
| `/attribution` | Attribution Diagnostics | Redirect chain viewer, testing mode |
| `/exports` | Tax exports | Tax personas, date range, PDF/CSV |
| `/pitch` | Brand Pitch Deck | Generate performance report for brands |
| `/reliability` | Platform Reliability | Uptime scores, issue history by platform |
| `/settings` | User preferences | Home currency, notifications, GDPR controls |
| `/billing` | Subscription | Stripe portal, plan details |

---

## Component Specifications

### 1. Earnings Dashboard (Multi-Currency)

**Purpose:** Single view for all affiliate income, normalized to home currency.

```tsx
interface EarningsDashboardProps {
  dateRange: { start: Date; end: Date };
  homeCurrency: 'EUR' | 'GBP' | 'USD';
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  €4,230 this month                           ▲ 12% vs last month │
│  Home currency: EUR                          [Change currency ▼] │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
├─────────────────────────────────────────────────────────────────┤
│  💰 Revenue Loss Ledger                                          │
│  This month: 2 issues detected, €80-€180 at risk (resolved)    │
│                                              [View Details →]   │
├─────────────────────────────────────────────────────────────────┤
│  Storefront Breakdown               │  Top Products             │
│  ┌────────────────────────────┐    │  1. Canon EOS R5 - €320   │
│  │  Amazon DE     €2,100      │    │  2. Dyson Airwrap - €180  │
│  │  Amazon UK     £450 (€520) │    │  3. Zara Dress - €95      │
│  │  Awin          €1,500      │    │                           │
│  │  LTK           €110        │    │                           │
│  └────────────────────────────┘    │                           │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Storefront Manager (Multi-Account)

**Purpose:** Manage multiple storefronts, even of the same platform type.

```tsx
interface StorefrontCardProps {
  id: string;
  platform: 'amazon_de' | 'amazon_uk' | 'awin' | 'ltk' | 'shopmy';
  storefrontName: string; // "My German Store"
  region: string;
  lastSyncAt: Date;
  status: 'active' | 'error' | 'expired';
  totalEarnings30d: number;
  currency: string;
  onSync: () => void;
  onRemove: () => void;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Your Storefronts                            [+ Add Storefront] │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐                  │
│  │  🇩🇪 Amazon Germany          ✓ Synced 2h ago │                │
│  │  "Main German Store"          €2,100/month │                  │
│  │                              [Sync] [⋮]   │                  │
│  └───────────────────────────────────────────┘                  │
│  ┌───────────────────────────────────────────┐                  │
│  │  🇬🇧 Amazon UK               ✓ Synced 2h ago │                │
│  │  "UK Backup Store"            £450/month  │                  │
│  │                              [Sync] [⋮]   │                  │
│  └───────────────────────────────────────────┘                  │
│  ┌───────────────────────────────────────────┐                  │
│  │  🔗 Awin                     ✓ Connected  │                  │
│  │  "All EU Programs"            €1,500/month │                 │
│  │                              [Sync] [⋮]   │                  │
│  └───────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Revenue Loss Ledger

**Purpose:** Show what almost went wrong. Frame as "money saved."

```tsx
interface LossLedgerEntryProps {
  id: string;
  issueType: 'broken_link' | 'out_of_stock' | 'redirect_error';
  productName: string;
  detectedAt: Date;
  resolvedAt?: Date;
  durationHours: number;
  estimatedClicksLow: number;
  estimatedClicksHigh: number;
  estimatedLossLow: number;
  estimatedLossHigh: number;
  resolutionType: 'manual' | 'auto_fallback' | 'auto_recovered';
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue Loss Ledger                                            │
│  Issues detected and value protected                            │
├─────────────────────────────────────────────────────────────────┤
│  📊 This Month: 3 issues, €180-€420 at risk                     │
│     ✅ All resolved                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📍 Oct 15, 2024 - Amazon camera link broken                    │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Duration: 6 hours                                        │ │
│  │  Estimated affected clicks: 45-120                        │ │
│  │  Estimated revenue at risk: €42-€110                      │ │
│  │  Status: ✅ Resolved (you fixed it)                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  📍 Oct 12, 2024 - Zara dress out of stock                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Duration: 2 days                                         │ │
│  │  Estimated affected clicks: 200-350                       │ │
│  │  Estimated revenue at risk: €80-€180                      │ │
│  │  Status: ⚡ Auto-redirected to LTK search                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Smart Link Optimizer (★ HERO FEATURE)

**Purpose:** Find better-paying programs. This is why creators use AffiMark.

**Trust Messaging:** Show confidence ranges, last verified dates, disclaimers.

```tsx
interface OptimizerResultProps {
  originalUrl: string;
  brand: string;
  productName: string;
  currentProgram: {
    name: string;
    network: string;
    rate: number;
  };
  alternatives: Array<{
    network: string;
    programName: string;
    rateLow: number;
    rateHigh: number;
    confidenceScore: 1 | 2 | 3 | 4 | 5;
    lastVerified: Date;
    requiresApplication: boolean;
    potentialGainLow: number;
    potentialGainHigh: number;
  }>;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Smart Link Optimizer                           ★ HERO FEATURE  │
│  Same product. Better programs.                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Paste any product URL:                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ https://www.amazon.de/dp/B09V3KXJPB?tag=mystore-21       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                              [Analyze]          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Analysis Complete                                           │
│                                                                 │
│  Product: Sony WH-1000XM5 Headphones                           │
│  Brand: Sony                                                    │
│                                                                 │
│  Current: Amazon Associates (DE)                                │
│  Commission: 3%                                                 │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  🥇 BETTER ALTERNATIVE                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Sony Direct via Awin                                     │ │
│  │                                                           │ │
│  │  Commission: 8-12%                                        │ │
│  │  Confidence: ●●●●○ High                                   │ │
│  │  Last verified: 3 days ago                                │ │
│  │                                                           │ │
│  │  ⚠️ Note: Requires Awin publisher account                 │ │
│  │                                                           │ │
│  │  Based on your ~500 monthly clicks to this product:       │ │
│  │  Potential extra earnings: €35-€70/month                  │ │
│  │                                                           │ │
│  │                                       [Create Link →]     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  🥈 MediaMarkt via Tradedoubler                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Commission: 4-6%  •  Confidence: ●●●○○                   │ │
│  │  Potential extra: €12-€25/month                           │ │
│  │                                       [Create Link →]     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ℹ️ Commission rates are estimates. Actual rates may vary      │
│  based on campaigns and product categories.                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. SmartWrapper Card (Trust-First)

**Purpose:** Display SmartWrapper with transparency indicators.

```tsx
interface SmartWrapperCardProps {
  id: string;
  shortCode: string;
  name: string;
  destinationUrl: string;
  affiliateTag: string;
  clickCount: number;
  healthStatus: 'healthy' | 'broken' | 'fallback_active';
  fallbackActive: boolean;
  inAppEscapeEnabled: boolean;
  onEdit: () => void;
  onCopyLink: () => void;
  onViewChain: () => void; // Transparency
  onTestAttribution: () => void;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Camera Link                                          🟢 Healthy │
│  go.affimark.com/camera                                         │
├─────────────────────────────────────────────────────────────────┤
│  Destination: amazon.de/dp/B09V3KXJPB                           │
│  Your affiliate tag: mystore-21 ✓                               │
│  Clicks: 1,234 (last 30 days)                                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✓ Tags pass through untouched                          │   │
│  │  ✓ In-app browser escape enabled                        │   │
│  │  ✓ Fallback configured (LTK search)                     │   │
│  └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│  [📋 Copy]  [✏️ Edit]  [🔍 View Chain]  [🧪 Test Attribution]   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 6. In-App Browser Interstitial

**Purpose:** Help users escape in-app browsers to preserve tracking.

```tsx
interface InAppInterstitialProps {
  browserType: 'instagram' | 'tiktok' | 'facebook' | 'twitter';
  destinationName: string;
  onOpenExternal: () => void;
  onContinue: () => void;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  📱 You're in Instagram's browser                               │
│                                                                 │
│  For the best shopping experience and to ensure                 │
│  any discounts work properly, open in your browser.             │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │  🔗 Open in Safari  │  │  Continue anyway →  │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  (We never see your purchase or personal data)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 7. Attribution Diagnostics (NOT Protection)

**Purpose:** Confidence checks with clear disclaimers.

```tsx
interface AttributionDiagnosticsProps {
  smartwrapperUrl: string;
  expectedAffiliateId: string;
  redirectChain: Array<{
    step: number;
    url: string;
    statusCode: number;
    hasAffiliateId: boolean;
  }>;
  finalUrl: string;
  foundAffiliateId: string | null;
  confidenceLevel: 'high' | 'medium' | 'low' | 'unknown';
  warnings: string[];
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Attribution Diagnostics                                        │
│  Confidence check for your SmartWrapper                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SmartWrapper: go.affimark.com/sephora-lipstick                │
│  Your affiliate ID: jessica-20                                  │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ✅ Confidence: HIGH                                            │
│                                                                 │
│  Redirect Chain:                                                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  1. go.affimark.com/sephora-lipstick        ✓             │ │
│  │     ↓                                                      │ │
│  │  2. prf.hn/click/camref:abc123             ✓             │ │
│  │     ↓                                                      │ │
│  │  3. sephora.de/product/xyz?aid=jessica-20  ✅ TAG FOUND   │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ⚠️ Important Disclaimer                                  │ │
│  │                                                           │ │
│  │  This confirms your tag reaches the retailer's website.  │ │
│  │  However, we cannot detect:                               │ │
│  │  • Coupon extensions that may override at checkout        │ │
│  │  • Last-click attribution from other sources              │ │
│  │  • Cookie expiration issues                               │ │
│  │                                                           │ │
│  │  This is a confidence check, not a commission guarantee.  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [🧪 Test Mode: Click as if you're a fan]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 8. Tax Export with Personas

**Purpose:** Localized exports for different EU tax situations.

```tsx
interface TaxExportPanelProps {
  availableYears: number[];
  taxPersonas: Array<{
    id: string;
    name: string;
    description: string;
    country: string;
  }>;
  selectedPersona: string;
  onExportPdf: (year: number, persona: string) => void;
  onExportCsv: (year: number, persona: string) => void;
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Tax Export                                                     │
│  One-click export for your accountant                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Select year:  [2024 ▼]                                         │
│                                                                 │
│  Tax persona:                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  ○ German Freelancer (Freiberufler)                       │ │
│  │    EÜR-ready format with VAT columns                      │ │
│  │                                                           │ │
│  │  ● German Small Business (Kleinunternehmer)               │ │
│  │    Simplified format, no VAT                              │ │
│  │                                                           │ │
│  │  ○ Dutch ZZP                                              │ │
│  │    BTW-ready format                                       │ │
│  │                                                           │ │
│  │  ○ French Micro-Entrepreneur                              │ │
│  │    BIC/BNC columns                                        │ │
│  │                                                           │ │
│  │  ○ UK Sole Trader                                         │ │
│  │    Self Assessment ready                                  │ │
│  │                                                           │ │
│  │  ○ Generic EU                                             │ │
│  │    Standard format                                        │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Preview:                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Total earnings: €12,450.00                               │ │
│  │  Storefronts: 4 (Amazon DE, Amazon UK, Awin, LTK)        │ │
│  │  Transactions: 2,847                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [📄 Download PDF]     [📊 Download CSV]                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 9. Platform Reliability Score

**Purpose:** Show reliability patterns. Not accusations—data.

```tsx
interface PlatformReliabilityProps {
  platforms: Array<{
    name: string;
    uptimePercent: number;
    issueCount: number;
    avgResolutionTime: string;
  }>;
  dateRange: { start: Date; end: Date };
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Platform Reliability                                           │
│  Last 30 days                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Amazon DE         ████████████████████ 99.2%      1 issue     │
│  Amazon UK         ███████████████████░ 98.5%      2 issues    │
│  Awin              ████████████████████ 99.8%      0 issues    │
│  LTK               ██████████████████░░ 94.1%      4 issues    │
│  ShopMy            ███████████████████░ 97.3%      1 issue     │
│                                                                 │
│  ℹ️ Based on health checks for your tracked products.          │
│  Patterns can help you decide where to focus.                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 10. Brand Pitch Deck Generator

**Purpose:** Generate performance reports for brand negotiations.

```tsx
interface BrandPitchProps {
  onGenerate: () => void;
  isGenerating: boolean;
  preview?: {
    totalClicks: number;
    topCategories: string[];
    avgConversionRate: number;
    geoDistribution: { [country: string]: number };
  };
}
```

**Visual:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Brand Pitch Deck                                               │
│  Performance report for sponsorship negotiations                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Generate a professional PDF showing your performance.          │
│  Perfect for brand partnership conversations.                   │
│                                                                 │
│  Includes:                                                      │
│  ✓ Total audience reach (clicks across storefronts)            │
│  ✓ Top performing categories                                   │
│  ✓ Conversion rates by platform                                │
│  ✓ Geographic distribution                                     │
│  ✓ Professional summary paragraph                              │
│                                                                 │
│  Preview:                                                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Total Reach: 45,000 clicks/month                         │ │
│  │  Top Categories: Beauty, Fashion, Tech                    │ │
│  │  Avg Conversion: 3.2%                                     │ │
│  │  Audience: 60% DE, 25% UK, 15% Other EU                  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│                               [📄 Generate Pitch Deck (PDF)]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## UI/UX Guardrails (Feasibility-Driven)

### Smart Link Optimizer UI
**Critical constraints:**
- Commission rates are often private, tiered, or creator-specific
- Some programs change rates without notice

**Required UI elements:**
```
✓ Show ranges: "8-12%" not "10%"
✓ Show confidence: "●●●●○ High" or "●●○○○ Low"
✓ Show freshness: "Last verified: 3 days ago"
✓ Show requirements: "Requires Awin publisher account"
✓ Include disclaimer: "Rates are estimates and may vary"
```

**Never show:** Guaranteed percentages, guaranteed earnings

### Tax Export UI
**Legal requirement:** Never imply tax advice.

**Required UI elements:**
```
✓ Label: "Formatted for German Freelancer (EÜR structure)"
✓ Disclaimer: "Please review with your accountant"
✓ Note: "This is a data export, not tax advice"
```

**Never show:** "Tax-compliant", "Official format", "Approved by"

### Dead Stock Auto-Fallback UI
**User control is critical.**

**Required UI elements:**
```
✓ Toggle: "Auto-redirect when out of stock" (DEFAULT: OFF)
✓ Clear explanation of what happens
✓ "Where we redirect to" preview
✓ Easy one-click disable
```

### Platform Reliability Score UI
**Avoid blame language.**

**Required framing:**
```
✓ Title: "Observed link stability (your links)"
✓ Disclaimer: "Based on health checks for your tracked products"
✓ Neutral visualization (bars, not rankings)
```

**Never show:** "Best/worst platform", "Unreliable platforms", rankings

### In-App Browser Interstitial
**Must include escape option.**

**Required UI:**
```
✓ "Open in Safari" button (primary)
✓ "Continue anyway" link (always visible)
✓ Brief, non-scary explanation
✓ Privacy reassurance: "We never see your purchase data"
```

---

## Copywriting Guidelines

**Frame everything as value delivered:**

| ❌ Problem-focused | ✅ Value-focused |
|-------------------|------------------|
| "Link broken" | "This link was broken for 6 hours. Estimated prevented loss: €42-€110." |
| "Product out of stock" | "We auto-redirected your traffic. Estimated earnings preserved: €25-€60." |
| "Connect your accounts" | "See all your income in one place. Takes 2 minutes." |
| "Attribution check" | "Confidence check: Your tag arrives. Here's proof." |
| "Better program found" | "Same product. 3x the commission. €40+/mo extra." |

**Trust-building language:**
- "Your tags pass through untouched"
- "We never skim commissions"
- "You own your data"
- "EU-based. GDPR-compliant."

---

## Page Structure

```
frontend/
├── app/
│   ├── page.tsx                      # Landing (revenue protection messaging)
│   ├── sign-in/page.tsx
│   ├── sign-up/page.tsx
│   ├── dashboard/page.tsx            # Unified earnings + loss ledger preview
│   ├── storefronts/
│   │   ├── page.tsx                  # Multi-storefront list
│   │   └── connect/[platform]/page.tsx
│   ├── products/page.tsx             # Tracked products + loss ledger
│   ├── optimizer/page.tsx            # ★ Hero feature
│   ├── smartwrappers/
│   │   ├── page.tsx
│   │   ├── create/page.tsx
│   │   └── [id]/page.tsx
│   ├── attribution/page.tsx          # Diagnostics (not protection)
│   ├── exports/page.tsx              # Tax with personas
│   ├── pitch/page.tsx                # Brand deck generator
│   ├── reliability/page.tsx          # Platform scores
│   ├── settings/page.tsx
│   └── billing/page.tsx

├── components/
│   ├── dashboard/
│   │   ├── EarningsCard.tsx
│   │   ├── StorefrontBreakdown.tsx
│   │   ├── LossLedgerPreview.tsx
│   │   └── TopProducts.tsx
│   ├── storefronts/
│   │   ├── StorefrontCard.tsx
│   │   ├── AddStorefrontModal.tsx
│   │   └── CsvUploader.tsx
│   ├── optimizer/
│   │   ├── UrlInput.tsx
│   │   ├── AlternativeCard.tsx
│   │   ├── ConfidenceIndicator.tsx
│   │   └── CreateLinkModal.tsx
│   ├── smartwrappers/
│   │   ├── SmartWrapperCard.tsx
│   │   ├── TrustIndicators.tsx
│   │   ├── InAppInterstitial.tsx
│   │   └── RedirectChainViewer.tsx
│   ├── attribution/
│   │   ├── DiagnosticsPanel.tsx
│   │   ├── RedirectChain.tsx
│   │   └── DisclaimerBox.tsx
│   ├── exports/
│   │   ├── TaxPersonaSelector.tsx
│   │   └── ExportPreview.tsx
│   ├── loss-ledger/
│   │   ├── LossLedgerEntry.tsx
│   │   └── LossEstimate.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       └── Toast.tsx
```

---

## Commands

```bash
cd frontend && npm run dev     # [REDACTED]
cd frontend && npm run lint
cd frontend && npm run build
```

---

## Style & Safety

- TypeScript with typed props
- Tailwind; keep classes readable
- No secrets client-side
- Run `npm run lint` after edits
- All forms need loading states
- All actions need success/error toasts (value-framed)
- All lists need empty states with helpful CTAs
- Mobile-first responsive design
- EU-first: dates in DD.MM.YYYY format, EUR default

---

## Error States

Every page must handle:
1. **Loading:** Skeleton or spinner
2. **Empty:** Helpful message + CTA (e.g., "No storefronts yet. Connect your first one.")
3. **Error:** Retry button + support link
4. **No auth:** Redirect to sign-in
