## AffiMark v2 – Claude Code Guide

**"Revenue protection for affiliate creators. Tax sanity included."**

AffiMark is the Creator Operations Platform for storefront owners. We aggregate income from all platforms (Amazon, Awin, LTK, ShopMy), detect revenue leaks, suggest better-paying programs, and make tax season a one-click affair.

**Positioning:** This is NOT "another analytics dashboard." This is revenue protection + operational sanity + tax readiness.

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

**Competitive Moat:** EU-based company. We emphasize data residency and GDPR compliance as creators become wary of US platforms.

---

## Core Value Proposition

**NOT this:** "Yet another analytics dashboard" / "We fix affiliate injustice" / "We guarantee higher commissions"

**THIS:** Revenue protection. Operational sanity. Tax readiness. Decision clarity.

| Problem | AffiMark Solution | Tangible Value |
|---------|-------------------|----------------|
| Income in 5+ dashboards | Unified view + multi-currency | "One login. Know what you made." |
| Tax prep takes hours | One-click export + tax personas | "German freelancer? Done in 10 seconds." |
| Links break silently | Health monitoring + loss estimates | "This link was broken 6 hrs. Saved: €42-€110." |
| Default to Amazon (3%) | Smart Link Optimizer shows 12% options | "Same product. Triple the commission." |
| In-app browsers kill tracking | Detection + escape prompt | "Your tag survives. You get paid." |
| Products go OOS | Auto-alternatives + alerts | "Traffic still earns while you sleep." |
| Uncertainty about tracking | Attribution diagnostics (not promises) | "Confidence check: your tag arrived." |

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
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│   │   Unified   │  │   Revenue   │  │   Smart     │             │
│   │  Dashboard  │  │ Loss Ledger │  │  Optimizer  │ ★ HERO     │
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

## Feature Specifications

### FEATURE 1: Universal Data Import (Zero-Effort Onboarding)

**Objective Value:** Creators connect all storefronts in minutes. No manual data entry. Supports MULTIPLE storefronts of the same platform type.

**Critical:** Onboarding must be "zero effort." Creators are time-poor. If they have to manually input 50 links, they won't.

**User Story:** Creator logs in, uploads 3 Amazon CSVs (DE, UK, US storefronts), connects Awin via OAuth, uploads LTK export. All earnings appear unified within 5 minutes.

**Technical Requirements:**
- OAuth: Awin, Tradedoubler, Impact
- CSV parser: Amazon Associates (multiple regions), LTK, ShareASale
- Data normalization: Handle "shipped" vs "ordered" discrepancies
- Multi-currency: Auto-convert to user's home currency
- Multi-storefront: User can have Amazon DE + Amazon UK + Amazon US
- Deduplication: Avoid double-counting

**Reality Check (Amazon API):**
- Amazon Associates API requires sales history to get access
- Default to CSV upload for Amazon (most reliable)
- Add instructions for exporting from each platform

**Database Schema:**
```sql
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  platform TEXT NOT NULL, -- 'amazon_de', 'amazon_uk', 'awin', 'ltk'
  storefront_name TEXT, -- User-friendly name: "My German Store"
  account_identifier TEXT,
  region TEXT, -- 'DE', 'UK', 'US', 'FR'
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'success', 'error'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE affiliate_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  connected_account_id UUID REFERENCES connected_accounts,
  platform TEXT NOT NULL,
  region TEXT,
  transaction_date DATE NOT NULL,
  product_name TEXT,
  product_id TEXT,
  clicks INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  items_shipped INTEGER DEFAULT 0, -- For Amazon
  revenue DECIMAL(10,2) DEFAULT 0,
  commission DECIMAL(10,2) DEFAULT 0,
  original_currency TEXT, -- 'EUR', 'GBP', 'USD'
  commission_eur DECIMAL(10,2), -- Normalized to EUR
  exchange_rate DECIMAL(10,6),
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### FEATURE 2: Unified Earnings Dashboard (Multi-Currency)

**Objective Value:** One view for all affiliate income across all storefronts. All amounts normalized to home currency.

**User Story:** Creator opens dashboard. Sees: "€4,230 this month across 6 storefronts. Amazon DE: €2,100. Amazon UK: £450 (€520). Awin: €1,500."

**Technical Requirements:**
- Aggregate across all connected accounts
- Real-time currency conversion (use ECB rates for EU compliance)
- Home currency preference setting
- Time filters: today, 7d, 30d, custom
- Breakdown by platform, storefront, product
- Show original currency + converted amount

**Dashboard Sections:**
1. **Total Earnings Card** - Big number in home currency, % change
2. **Storefront Breakdown** - Each storefront separately (not just by platform)
3. **Top Products** - Best performing across all storefronts
4. **Earnings Timeline** - Line chart over time
5. **Recent Transactions** - Latest 20 with currency indicators

---

### FEATURE 3: Tax-Ready Export with Tax Personas

**Objective Value:** One-click export for tax season. GDPR Article 20 compliant. Localized for EU tax situations.

**User Story:** German freelancer clicks "Export for Taxes", selects "German Freelancer" preset and 2024. Gets PDF with EÜR-ready formatting and CSV with all transactions.

**Tax Persona Presets:**
```
- "German Freelancer (Freiberufler)" - EÜR format, VAT columns
- "German Small Business (Kleinunternehmer)" - Simplified, no VAT
- "Dutch ZZP" - BTW-ready format
- "French Micro-Entrepreneur" - BIC/BNC columns
- "UK Sole Trader" - GBP primary, Self Assessment ready
- "Lithuanian MB" - Dual currency (EUR), local format
- "Generic EU" - Standard format
```

**Technical Requirements:**
- PDF generation with professional formatting
- CSV export with all fields
- Tax persona templates (mostly display/column differences)
- Date range filters
- Multi-currency handling with exchange rates used
- VAT indication where applicable

---

### FEATURE 4: Link Health Monitor + Revenue Loss Ledger

**Objective Value:** Never send traffic to dead ends. Know exactly what almost went wrong.

**Key Insight:** Creators love knowing what ALMOST went wrong. Frame issues as "money saved."

**User Story:** Creator's Amazon link went 404 at 3 AM. AffiMark detected at 3:05 AM. Alert says: "This link was broken for 6 hours. Based on your traffic patterns, estimated prevented loss: €42-€110. We've flagged it for your review."

**Revenue Loss Ledger Concept:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Revenue Loss Ledger                                            │
├─────────────────────────────────────────────────────────────────┤
│  This Month: 3 issues detected, €180-€420 at risk              │
│                                                                 │
│  📍 Oct 15 - Amazon camera link broken (6 hours)               │
│     Estimated affected clicks: 45-120                          │
│     Estimated revenue at risk: €42-€110                        │
│     Status: ✅ Resolved                                         │
│                                                                 │
│  📍 Oct 12 - Zara dress out of stock (2 days)                  │
│     Estimated affected clicks: 200-350                         │
│     Estimated revenue at risk: €80-€180                        │
│     Status: ⚡ Auto-redirected to alternative                   │
└─────────────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE tracked_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  product_url TEXT NOT NULL,
  product_name TEXT,
  platform TEXT,
  asin TEXT,
  current_price DECIMAL(10,2),
  stock_status TEXT DEFAULT 'unknown',
  health_status TEXT DEFAULT 'unknown',
  last_checked TIMESTAMPTZ,
  alert_enabled BOOLEAN DEFAULT true,
  -- For "Dead Stock" auto-alternative
  fallback_search_url TEXT,
  auto_fallback_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE revenue_loss_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  tracked_product_id UUID REFERENCES tracked_products,
  issue_type TEXT NOT NULL, -- 'broken_link', 'out_of_stock', 'redirect_error'
  detected_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  duration_hours DECIMAL(5,2),
  estimated_clicks_low INTEGER,
  estimated_clicks_high INTEGER,
  estimated_loss_low DECIMAL(10,2),
  estimated_loss_high DECIMAL(10,2),
  resolution_type TEXT, -- 'manual', 'auto_fallback', 'auto_recovered'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### FEATURE 5: Dead Stock Auto-Alternative

**Objective Value:** When product goes OOS, traffic still earns. Don't just alert—automate the fix.

**User Story:** Zara dress goes OOS. SmartWrapper automatically redirects to a search page for that dress on LTK until creator manually updates. Alert says: "Your Zara dress link is OOS. We're auto-redirecting to your LTK search for 'Zara midi dress' until you update."

**Technical Requirements:**
- Detect OOS status from health check
- Fallback URL per product (user-configured or auto-generated)
- Auto-generated search URLs: `ltk.to/search?q=zara+midi+dress`
- SmartWrapper checks fallback condition before redirecting
- Alert with clear explanation of what's happening

---

### FEATURE 6: SmartWrapper Links (Trust-First Design)

**Objective Value:** Own your traffic. Platform-independent links. Full transparency.

**CRITICAL - Address Trust Concerns:**
Creators are wary of:
- Link shorteners
- Redirect layers
- Platforms "sitting between" them and brands

**Trust Messaging (must be prominent):**
```
✓ Your affiliate tags pass through untouched
✓ We never skim commissions
✓ Fully transparent redirect chain
✓ Open in new tab (no framing)
✓ Your data, your control
```

**User Story:** Creator creates SmartWrapper `go.affimark.com/camera`. Uses everywhere. Link redirects to Amazon with creator's tag intact. Full click analytics. When product goes OOS, fallback kicks in. Creator can see entire redirect chain.

**Technical Requirements:**
- Short code generation (unique per user)
- Destination URL with affiliate tag preserved
- UTM parameter preservation
- Fallback URL for OOS/broken scenarios
- Click analytics (device, geo, referrer)
- Redirect chain transparency (user can inspect)
- In-app browser detection (see Feature 7)

**Database Schema:**
```sql
CREATE TABLE smartwrappers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  name TEXT,
  destination_url TEXT NOT NULL,
  affiliate_tag TEXT, -- Extracted/confirmed affiliate tag
  fallback_url TEXT,
  fallback_type TEXT, -- 'search', 'category', 'custom'
  fallback_active BOOLEAN DEFAULT false,
  click_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  -- Trust/transparency
  redirect_chain_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### FEATURE 7: In-App Browser Detection + Escape Prompt

**Objective Value:** In-app browsers (Instagram, TikTok) kill affiliate tracking. We detect and help users escape.

**User Story:** Fan clicks link in Instagram. AffiMark detects in-app browser. Shows small prompt: "Open in Safari for best experience →". Fan taps, opens in Safari, affiliate tag survives.

**Technical Requirements:**
- Detect User-Agent for in-app browsers (Instagram, TikTok, Facebook, Twitter)
- Show non-intrusive interstitial before redirect
- "Open in Safari/Chrome" button (uses iOS/Android deep links)
- Track escape rate for analytics
- Option to disable per SmartWrapper (some creators may not want it)

**Detection Logic:**
```typescript
function isInAppBrowser(userAgent: string): boolean {
  const inAppPatterns = [
    /FBAN|FBAV/i,      // Facebook
    /Instagram/i,       // Instagram
    /Twitter/i,         // Twitter
    /Line\//i,          // Line
    /KAKAOTALK/i,       // KakaoTalk
    /BytedanceWebview/i, // TikTok
  ];
  return inAppPatterns.some(pattern => pattern.test(userAgent));
}
```

**Interstitial Design:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  📱 You're in Instagram's browser                               │
│                                                                 │
│  For the best shopping experience and to ensure                 │
│  any discounts work properly, open in your browser.             │
│                                                                 │
│  [🔗 Open in Safari]     [Continue anyway →]                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### FEATURE 8: Smart Link Optimizer (★ HERO FEATURE)

**Objective Value:** Find better-paying programs for the same product. This is the #1 reason to use AffiMark.

**Hero Positioning:** "Stop using 3% links when 12% links exist."

**User Story:** Creator pastes Amazon link (3% commission). AffiMark shows: "Same product available via Sony Direct on Awin (8-12%). Based on your traffic, potential extra earnings: €40-€80/month."

**CRITICAL - Expectation Management:**
- Show confidence ranges, not guarantees
- Show "last verified" dates
- Note if brand application may be required
- Position as "decision support" not "automatic money printing"

**Display Format:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Smart Link Optimizer                                           │
│  Same product. Better programs.                                 │
├─────────────────────────────────────────────────────────────────┤
│  Current: Amazon Associates (Germany)                           │
│  Product: Sony WH-1000XM5 Headphones                           │
│  Commission: 3%                                                 │
│                                                                 │
│  Better alternatives found:                                     │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  🥇 Sony Direct via Awin                                   │ │
│  │  Commission: 8-12% (varies by campaign)                   │ │
│  │  Confidence: ●●●●○ High                                   │ │
│  │  Last verified: 3 days ago                                │ │
│  │  Note: Requires Awin publisher account                    │ │
│  │  Potential extra: €35-€70/mo based on your traffic        │ │
│  │                                            [Create Link →] │ │
│  ├───────────────────────────────────────────────────────────┤ │
│  │  🥈 MediaMarkt via Tradedoubler                           │ │
│  │  Commission: 4-6%                                         │ │
│  │  Confidence: ●●●○○ Medium                                 │ │
│  │  Last verified: 1 week ago                                │ │
│  │                                            [Create Link →] │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Database Schema:**
```sql
CREATE TABLE affiliate_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  network TEXT NOT NULL, -- 'awin', 'tradedoubler', 'impact', 'amazon'
  program_id TEXT,
  brand_name TEXT NOT NULL,
  category TEXT,
  commission_rate_low DECIMAL(5,2), -- Range low
  commission_rate_high DECIMAL(5,2), -- Range high
  cookie_duration INTEGER, -- days
  region TEXT, -- 'EU', 'DE', 'UK'
  requires_application BOOLEAN DEFAULT false,
  confidence_score INTEGER, -- 1-5
  last_verified TIMESTAMPTZ,
  source TEXT, -- 'api', 'manual', 'community'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE link_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  original_url TEXT NOT NULL,
  original_program TEXT,
  original_rate DECIMAL(5,2),
  suggested_program_id UUID REFERENCES affiliate_programs,
  potential_gain_low DECIMAL(10,2),
  potential_gain_high DECIMAL(10,2),
  status TEXT DEFAULT 'pending', -- 'pending', 'applied', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### FEATURE 9: Attribution Diagnostics (NOT "Protection")

**Objective Value:** Confidence checks for your affiliate links. Know if your tag is likely to arrive.

**CRITICAL - Expectation Management:**

What we CAN do:
- Detect broken redirect chains
- Detect missing affiliate parameters in final URL
- Detect platform-side stripping
- Provide "Testing Mode" for manual verification

What we CANNOT do:
- Detect last-click overrides by coupon extensions (Honey, etc.)
- Force platforms or brands to pay retroactively
- Guarantee commissions

**Position as:** "Attribution diagnostics & confidence checks" - NOT "protection" in legal/financial sense.

**Testing Mode:**
Creator clicks their own SmartWrapper → AffiMark shows "Tracking Confirmed ✓" with full chain visibility.

**User Story:** Creator runs attribution check on Sephora link. AffiMark follows redirect chain. Shows: "Confidence: HIGH ✓. Your tag (jessica-20) appears in final URL. Cookie window: 30 days. Note: This does not guarantee commission if user has coupon extensions installed."

**Display:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Attribution Diagnostics                                        │
│  Confidence check for: go.affimark.com/sephora-lipstick        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Confidence: HIGH                                            │
│                                                                 │
│  Redirect Chain:                                                │
│  1. go.affimark.com/sephora-lipstick                           │
│  2. → prf.hn/click/aff123 (Awin)                               │
│  3. → sephora.com/product/xyz?aid=jessica-20 ✓                 │
│                                                                 │
│  Your affiliate ID: jessica-20                                  │
│  Final URL contains ID: ✅ Yes                                  │
│  Cookie window: 30 days                                         │
│                                                                 │
│  ⚠️ Disclaimer: This confirms your tag reaches the retailer.   │
│  Coupon extensions may still override at checkout.             │
│                                                                 │
│  [🧪 Test Mode: Click as if you're a fan]                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### FEATURE 10: Platform Reliability Score

**Objective Value:** Show patterns over time. Validate creators' gut feelings about platforms.

**User Story:** Creator suspects LTK links break more often. AffiMark shows: "LTK: 94% uptime, 3 OOS events this month. Amazon DE: 99% uptime, 1 broken link."

**Display:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Platform Reliability (Last 30 Days)                            │
├─────────────────────────────────────────────────────────────────┤
│  Amazon DE         ████████████████████ 99.2%   1 issue        │
│  Amazon UK         ███████████████████░ 98.5%   2 issues       │
│  Awin              ████████████████████ 99.8%   0 issues       │
│  LTK               ██████████████████░░ 94.1%   4 issues       │
│  ShopMy            ███████████████████░ 97.3%   1 issue        │
└─────────────────────────────────────────────────────────────────┘
```

**Not accusations—patterns.** Let creators draw their own conclusions.

---

### FEATURE 11: Brand Pitch Deck Generator

**Objective Value:** If we know conversion rates and EPC, we have data for a Media Kit.

**User Story:** Creator clicks "Generate Performance Report." Gets PDF with best-performing categories, click-through rates, conversion data. Uses for brand negotiations.

**Report Contents:**
- Audience reach (total clicks across storefronts)
- Top categories by performance
- Conversion rates by platform
- Average order value
- Geographic distribution
- "Professional Summary" paragraph (AI-generated)

---

## Feature Feasibility & Guardrails

### Feasibility Summary

| Feature | Status | Key Constraint |
|---------|--------|----------------|
| Universal Data Import | ✅ Safe | Engineering work, not research |
| Unified Dashboard | ✅ Safe | Currency + timezone must be rock-solid |
| Tax-Ready Export | ⚠️ Legal framing | Never imply tax advice |
| Link Health Monitor | ✅ Strong | OOS detection: easy on Amazon, harder on JS-heavy sites |
| Revenue Loss Ledger | ✅ Gold | Uses your own detected events |
| Dead Stock Auto-Alternative | ⚠️ Opt-in required | Must be explicit opt-in, conservative defaults |
| SmartWrappers | ✅ Critical | Transparency UI matters more than backend |
| In-App Browser Detection | ⚠️ Best-effort | Cannot force exit; some apps restrict behavior |
| Smart Link Optimizer | ⚠️ High value, needs discipline | Rates often private, tiered, or creator-specific |
| Attribution Diagnostics | ✅ Well scoped | Your framing is correct |
| Platform Reliability Score | ⚠️ Methodological rigor | Avoid any implication of blame |
| Brand Pitch Deck | ✅ Safe | All inputs already exist in system |

---

### Feature-Specific Guardrails

#### ★ Smart Link Optimizer (HERO)
**Hard constraints:**
- Commission rates are often private, tiered, or creator-specific
- Some programs change rates without notice
- Some require application approval

**Required guardrails:**
```
✓ Store RANGES, not absolutes (commission_rate_low, commission_rate_high)
✓ Display confidence scores (1-5 stars)
✓ Show "last verified" timestamps (essential)
✓ Cache results aggressively (daily/weekly refresh)
✓ Note application requirements
✓ Position as "decision support" NOT "certainty"
```

**Never say:** "You will earn 12%"
**Always say:** "Programs typically pay 8-12% (verified 3 days ago)"

---

#### Tax-Ready Export
**Critical legal constraint:** Never imply tax advice.

**Required wording:**
```
✓ "Formatted for" (not "compliant with")
✓ "Commonly accepted structure" (not "official format")
✓ "Review with your accountant" (always include)
```

**Never say:** "This is your tax return"
**Always say:** "Export formatted for German Freelancer (EÜR structure). Please review with your accountant."

---

#### Dead Stock Auto-Alternative
**Risks:**
- Creators may not want automatic substitution
- Brand mismatch risk
- Could redirect to competitor products

**Required safeguards:**
```
✓ Explicit opt-in per link (default OFF)
✓ Clear "what we redirected to" transparency
✓ Conservative defaults (pause traffic > auto-redirect)
✓ Alert creator immediately when fallback activates
✓ Easy one-click revert
```

---

#### In-App Browser Detection
**Technical limitations:**
- Cannot force exit from in-app browser
- Some apps (TikTok especially) restrict behavior
- iOS/Android deep links don't always work

**Position as:** "Best-effort improvement" NOT "guaranteed fix"

**UI must include:** "Continue anyway" option (don't trap users)

---

#### Platform Reliability Score
**What to avoid:**
- Any implication of blame or fraud
- Any ranking that looks like accusation
- Absolute statements about platform quality

**Required framing:**
```
Label as: "Observed link stability metrics (based on your links)"
NOT: "Platform reliability ranking"
```

**Include disclaimer:** "Based on health checks for your tracked products. Results vary by link and time period."

---

## Recommended Build Order

**Strategic rationale:** Early value → Early trust → Early "saved me money" stories

| Phase | Features | Why This Order |
|-------|----------|----------------|
| **1** | Universal Import + Dashboard | Immediate value, low risk |
| **2** | SmartWrapper + Link Health | Trust-building, tangible protection |
| **3** | Revenue Loss Ledger | Creates "AffiMark saved me €X" stories |
| **4** | Smart Link Optimizer (carefully) | Hero feature, requires discipline |
| **5** | Tax Personas | High value for EU, needs legal framing |
| **6** | Attribution Diagnostics | Lower priority, well-scoped |
| **7** | Everything else | In-app detection, pitch deck, reliability score |

---

## Implementation Phases (Revised)

### Phase 1: Universal Import + Dashboard (Week 1-2)
| Task | Priority | Effort |
|------|----------|--------|
| Database schema + migrations | Critical | 1 day |
| CSV import for Amazon (multi-region) | Critical | 2 days |
| Multi-currency normalization (ECB rates) | Critical | 1 day |
| Unified earnings dashboard UI | Critical | 3 days |

### Phase 2: SmartWrappers + Link Health (Week 3-4)
| Task | Priority | Effort |
|------|----------|--------|
| SmartWrapper CRUD with trust messaging | Critical | 1 day |
| Link health checker service | Critical | 2 days |
| Click analytics | High | 2 days |
| Alert system (money-saved framing) | High | 1 day |

### Phase 3: Revenue Loss Ledger (Week 4)
| Task | Priority | Effort |
|------|----------|--------|
| Loss estimation service | High | 1 day |
| Loss ledger UI | High | 1 day |
| Historical EPC calculation | High | 1 day |

### Phase 4: Smart Link Optimizer (Week 5-6) ★ HERO
| Task | Priority | Effort |
|------|----------|--------|
| Affiliate programs database + seeding | Critical | 2 days |
| URL parser (brand extraction) | High | 2 days |
| Comparison with confidence scores + ranges | High | 2 days |
| Optimizer UI with all guardrails | High | 2 days |

### Phase 5: Tax Personas (Week 7)
| Task | Priority | Effort |
|------|----------|--------|
| Tax persona templates (formatting only) | High | 1 day |
| PDF generation with legal disclaimers | High | 2 days |
| CSV export | Medium | 1 day |

### Phase 6: Attribution Diagnostics (Week 7-8)
| Task | Priority | Effort |
|------|----------|--------|
| Redirect chain follower | High | 1 day |
| Testing Mode | High | 1 day |
| Diagnostics UI with disclaimers | High | 1 day |

### Phase 7: Platform Integrations + Polish (Week 8-9)
| Task | Priority | Effort |
|------|----------|--------|
| Awin OAuth + sync | High | 2 days |
| Tradedoubler OAuth + sync | High | 2 days |
| In-app browser detection (best-effort) | Medium | 1 day |
| Dead Stock auto-fallback (opt-in) | Medium | 1 day |
| Platform Reliability Score | Medium | 1 day |
| Brand Pitch Deck generator | Medium | 2 days |

---

## Alert Language (Money-Saved Framing)

**DON'T say:** "Link broken"
**DO say:** "This link was broken for 6 hours. Estimated prevented loss: €42-€110."

**DON'T say:** "Product out of stock"
**DO say:** "We auto-redirected your Zara dress traffic to LTK search. Estimated earnings preserved: €25-€60."

**DON'T say:** "Attribution check passed"
**DO say:** "Confidence: HIGH. Your tag jessica-20 appears in the final URL."

---

## Repo Structure

```
backend/
├── src/
│   ├── index.ts
│   ├── api/
│   │   ├── auth-routes.ts
│   │   ├── accounts-routes.ts      # Multi-storefront connections
│   │   ├── transactions-routes.ts  # Earnings data
│   │   ├── export-routes.ts        # Tax exports with personas
│   │   ├── smartwrapper-routes.ts  
│   │   ├── optimizer-routes.ts     # ★ Hero feature
│   │   ├── attribution-routes.ts   # Diagnostics, not protection
│   │   ├── health-routes.ts        # Link health + loss ledger
│   │   ├── pitch-routes.ts         # Brand pitch deck
│   │   └── gdpr-routes.ts
│   ├── services/
│   │   ├── csv-importer.ts         # Multi-region Amazon
│   │   ├── currency-converter.ts   # ECB rates
│   │   ├── awin-client.ts
│   │   ├── tradedoubler-client.ts
│   │   ├── health-checker.ts
│   │   ├── loss-estimator.ts       # Revenue loss calculations
│   │   ├── optimizer.ts            # Program comparison
│   │   ├── attribution-checker.ts  # Redirect chain analysis
│   │   ├── in-app-detector.ts      # Browser detection
│   │   ├── pitch-generator.ts      # PDF generation
│   │   └── param-preserver.ts
│   └── workers/
│       ├── health-check-cron.ts
│       ├── sync-cron.ts
│       └── exchange-rate-cron.ts

frontend/
├── app/
│   ├── dashboard/                   # Unified view + multi-currency
│   ├── storefronts/                 # Connected accounts (multi)
│   ├── products/                    # Tracked products + loss ledger
│   ├── optimizer/                   # ★ Hero feature
│   ├── smartwrappers/
│   ├── attribution/                 # Diagnostics
│   ├── exports/                     # Tax with personas
│   ├── pitch/                       # Brand deck generator
│   └── settings/
```

---

## Commands

```bash
# Backend
cd backend && npm run dev      # http://localhost:8787
cd backend && npm run deploy

# Frontend
cd frontend && npm run dev     # http://localhost:3000
cd frontend && npm run lint
cd frontend && npm run build
```

---

## Success Metrics

| Feature | Success Metric |
|---------|----------------|
| Onboarding | <5 min to see all earnings |
| Dashboard | <2s page load |
| Optimizer | >80% brand identification, shown alternatives |
| Health Check | >99% issue detection accuracy |
| Loss Ledger | Users can articulate "AffiMark saved me €X" |
| Attribution | Clear confidence indicators, no false promises |
| Tax Export | <10s generation, persona-appropriate formatting |

---

## Trust & Positioning Guardrails

1. **Never claim guaranteed commission increases** - use ranges and estimates
2. **Attribution is "diagnostics" not "protection"** - manage expectations
3. **SmartWrapper transparency** - user can always see redirect chain
4. **No commission skimming** - be explicit about this
5. **EU-first messaging** - emphasize GDPR compliance, data residency
6. **Money-saved framing** - alerts show value, not just problems
7. **Confidence indicators** - show when data might be stale
