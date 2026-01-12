## AffiMark Backend – Claude Code Guide (v2)

Backend: Cloudflare Workers API (Hono + TypeScript), Supabase.

**Positioning:** Revenue protection + operational sanity. Not "another analytics dashboard."

---

## Core Responsibilities

1. **SmartWrapper Redirects** - Fast (<50ms), in-app browser detection, fallback handling
2. **Platform Integrations** - OAuth + CSV parsing for multi-storefront support
3. **Data Normalization** - Handle "shipped" vs "ordered", multi-currency conversion
4. **Revenue Loss Detection** - Health checks, loss estimation, auto-fallback
5. **Smart Optimization** - Program comparison with confidence scores

---

## Feasibility Constraints & Implementation Notes

### Data Normalization Challenges
**Reality check:** Different platforms report data differently.

| Platform | Quirk | How to Handle |
|----------|-------|---------------|
| Amazon DE | Uses semicolon delimiter | Detect delimiter, parse accordingly |
| Amazon US | Uses comma delimiter | Standard CSV parsing |
| Amazon | Reports "shipped" items | Store `items_shipped`, calculate orders separately |
| LTK | Different column structure | Platform-specific parser |
| Awin | API returns structured JSON | Normalize to common schema |

**Critical:** Currency + timezone normalization must be rock-solid. Use ECB rates.

### Health Check Limitations
| Target | Difficulty | Notes |
|--------|------------|-------|
| Amazon OOS | Easy | Clear "Currently unavailable" text |
| Fashion sites OOS | Medium | Various text patterns |
| JS-heavy stores | Hard | May need headless browser (skip for MVP) |

**Acceptable:** False negatives on JS-heavy sites. Better to miss some than to have false positives.

### In-App Browser Detection Limitations
- **Cannot force** exit from in-app browser
- **TikTok especially** restricts behavior
- **Deep links don't always work** on all devices

**Position as:** "Best-effort improvement" in code comments and error handling.

### Smart Link Optimizer Data Freshness
**Commission rates are:**
- Often private
- Sometimes tiered
- Sometimes creator-specific
- Can change without notice

**Required implementation:**
```typescript
// ALWAYS store ranges, never absolutes
interface AffiliateProgram {
  commission_rate_low: number;   // e.g., 8
  commission_rate_high: number;  // e.g., 12
  confidence_score: number;      // 1-5
  last_verified: Date;           // REQUIRED
  source: 'api' | 'manual' | 'community';
}

// Cache aggressively
const PROGRAM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

### Dead Stock Auto-Fallback Safety
**Must implement:**
```typescript
// Fallback is OPT-IN, default OFF
interface TrackedProduct {
  auto_fallback_enabled: boolean; // DEFAULT: false
  fallback_url: string | null;
  fallback_type: 'search' | 'category' | 'custom';
}

// When fallback activates, ALWAYS alert the creator
async function activateFallback(productId: string) {
  await updateFallbackStatus(productId, true);
  await sendEmail(userId, 'fallback_activated', { ... }); // Required
  await logToLossLedger(productId, 'auto_fallback');
}
```

---

## SmartWrapper Redirect Flow

**Critical:** <50ms total latency. In-app browser detection must not slow things down.

```
Fan clicks go.affimark.com/camera
         │
         ▼
┌─────────────────────────────────────────┐
│ 1. Lookup SmartWrapper by short_code    │ <5ms (indexed)
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 2. Check in-app browser                 │ <1ms (User-Agent check)
│    If detected → return interstitial    │
└─────────────────────────────────────────┘
         │ (if not in-app)
         ▼
┌─────────────────────────────────────────┐
│ 3. Check fallback status                │ <5ms
│    If product OOS → use fallback_url    │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 4. Preserve UTM params                  │ <1ms
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 5. Log click event (async)              │ Non-blocking
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ 6. 302 Redirect to destination          │
└─────────────────────────────────────────┘
```

### In-App Browser Detection

```typescript
// src/services/in-app-detector.ts

const IN_APP_PATTERNS = [
  /FBAN|FBAV/i,      // Facebook
  /Instagram/i,       // Instagram
  /Twitter/i,         // Twitter
  /Line\//i,          // Line
  /KAKAOTALK/i,       // KakaoTalk
  /BytedanceWebview/i, // TikTok
  /Snapchat/i,        // Snapchat
];

export function isInAppBrowser(userAgent: string): string | null {
  for (const pattern of IN_APP_PATTERNS) {
    if (pattern.test(userAgent)) {
      // Return which app
      if (/Instagram/i.test(userAgent)) return 'instagram';
      if (/FBAN|FBAV/i.test(userAgent)) return 'facebook';
      if (/Twitter/i.test(userAgent)) return 'twitter';
      if (/BytedanceWebview/i.test(userAgent)) return 'tiktok';
      return 'unknown';
    }
  }
  return null;
}

export function generateEscapeUrl(originalUrl: string): string {
  // iOS: x-safari-https://
  // Android: intent://...
  // Fallback: just the URL (user copies manually)
  return originalUrl;
}
```

### Interstitial Response

```typescript
// When in-app browser detected and escape enabled
app.get('/go/:code', async (c) => {
  const userAgent = c.req.header('User-Agent') || '';
  const inAppType = isInAppBrowser(userAgent);
  
  if (inAppType && smartwrapper.in_app_escape_enabled) {
    // Return HTML interstitial
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; 
                 display: flex; align-items: center; justify-content: center;
                 height: 100vh; margin: 0; background: #f5f5f5; }
          .card { background: white; padding: 2rem; border-radius: 12px;
                  max-width: 320px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .btn { display: block; padding: 12px 24px; margin: 8px 0;
                 border-radius: 8px; text-decoration: none; font-weight: 500; }
          .primary { background: #000; color: white; }
          .secondary { background: transparent; color: #666; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📱 You're in ${inAppType}'s browser</h2>
          <p>For the best experience and to ensure discounts work, open in your browser.</p>
          <a href="${escapeUrl}" class="btn primary">Open in Browser</a>
          <a href="${destinationUrl}" class="btn secondary">Continue anyway</a>
          <small>We never see your purchase data.</small>
        </div>
      </body>
      </html>
    `);
  }
  
  // Normal redirect flow...
});
```

---

## API Endpoints

### Connected Accounts (Multi-Storefront)

```typescript
// GET /api/storefronts
// List user's connected storefronts (supports multiple of same platform)
interface StorefrontsListResponse {
  storefronts: Array<{
    id: string;
    platform: string; // 'amazon_de', 'amazon_uk', 'awin'
    storefrontName: string;
    region: string;
    status: 'active' | 'expired' | 'error';
    lastSyncAt: string;
    earnings30d: number;
    currency: string;
  }>;
}

// POST /api/storefronts
// Add new storefront connection
interface AddStorefrontRequest {
  platform: string;
  storefrontName: string;
  region?: string;
}

// POST /api/storefronts/:id/sync
// Trigger manual sync

// DELETE /api/storefronts/:id
// Remove storefront connection

// POST /api/storefronts/import-csv
// Import from CSV (Amazon, LTK)
// Multipart form data with file + platform type
interface CsvImportResponse {
  imported: number;
  totalEarnings: number;
  dateRange: { start: string; end: string };
  currency: string;
}
```

### Transactions (Multi-Currency)

```typescript
// GET /api/transactions
interface TransactionsQueryParams {
  startDate: string;
  endDate: string;
  storefrontId?: string;
  groupBy?: 'day' | 'week' | 'month';
  currency?: string; // Convert to this currency
}

interface TransactionsResponse {
  transactions: Array<{
    id: string;
    storefrontId: string;
    platform: string;
    date: string;
    productName: string;
    clicks: number;
    orders: number;
    revenue: number;
    commission: number;
    originalCurrency: string;
    commissionConverted: number; // In requested currency
  }>;
  summary: {
    totalCommission: number;
    totalCommissionConverted: number;
    currency: string;
  };
}

// GET /api/transactions/summary
// Dashboard summary with multi-currency support
interface SummaryResponse {
  total30d: number;
  total7d: number;
  changePercent: number;
  homeCurrency: string;
  byStorefront: Array<{
    storefrontId: string;
    storefrontName: string;
    platform: string;
    total: number;
    originalCurrency: string;
    totalConverted: number;
  }>;
  topProducts: Array<{
    name: string;
    commission: number;
    platform: string;
  }>;
}
```

### Revenue Loss Ledger

```typescript
// GET /api/loss-ledger
interface LossLedgerResponse {
  summary: {
    issueCount: number;
    estimatedLossLow: number;
    estimatedLossHigh: number;
    allResolved: boolean;
  };
  entries: Array<{
    id: string;
    issueType: 'broken_link' | 'out_of_stock' | 'redirect_error';
    productName: string;
    productUrl: string;
    detectedAt: string;
    resolvedAt: string | null;
    durationHours: number;
    estimatedClicksLow: number;
    estimatedClicksHigh: number;
    estimatedLossLow: number;
    estimatedLossHigh: number;
    resolutionType: 'manual' | 'auto_fallback' | 'auto_recovered';
  }>;
}

// POST /api/loss-ledger/:id/resolve
// Mark issue as resolved
```

### Smart Link Optimizer (★ HERO)

```typescript
// POST /api/optimizer/analyze
interface AnalyzeRequest {
  url: string;
}

interface AnalyzeResponse {
  originalUrl: string;
  brand: string;
  productName: string;
  currentProgram: {
    network: string;
    name: string;
    rate: number;
  };
  alternatives: Array<{
    id: string;
    network: string;
    programId: string;
    programName: string;
    rateLow: number;
    rateHigh: number;
    confidenceScore: number; // 1-5
    lastVerified: string;
    requiresApplication: boolean;
    region: string;
    // Estimated gains based on user's traffic
    potentialGainLow: number;
    potentialGainHigh: number;
  }>;
}

// POST /api/optimizer/create-link
interface CreateLinkRequest {
  originalUrl: string;
  alternativeId: string;
  createSmartWrapper: boolean;
  smartWrapperName?: string;
}

interface CreateLinkResponse {
  affiliateUrl: string;
  smartWrapperId?: string;
  shortCode?: string;
}
```

### Attribution Diagnostics

```typescript
// POST /api/attribution/check
interface AttributionCheckRequest {
  url: string;
  expectedAffiliateId?: string;
}

interface AttributionCheckResponse {
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  redirectChain: Array<{
    step: number;
    url: string;
    statusCode: number;
    hasAffiliateParam: boolean;
    affiliateParamFound?: string;
  }>;
  finalUrl: string;
  foundAffiliateId: string | null;
  expectedAffiliateId: string | null;
  warnings: string[];
  disclaimer: string; // Always present
}

// POST /api/attribution/test-click
// Simulate a click and return full diagnostics
// Used for "Testing Mode"
```

### SmartWrappers (with In-App + Fallback)

```typescript
// POST /api/smartwrappers
interface CreateSmartWrapperRequest {
  name: string;
  shortCode?: string;
  destinationUrl: string;
  affiliateTag?: string;
  fallbackUrl?: string;
  fallbackType?: 'search' | 'category' | 'custom';
  inAppEscapeEnabled?: boolean; // Default true
}

// GET /api/smartwrappers/:id/chain
// Get transparent redirect chain for trust
interface RedirectChainResponse {
  shortCode: string;
  steps: Array<{
    step: number;
    type: 'affimark' | 'network' | 'retailer';
    url: string;
  }>;
  finalDestination: string;
  affiliateTagPresent: boolean;
}
```

### Link Health

```typescript
// GET /api/health/products
interface ProductsHealthResponse {
  products: Array<{
    id: string;
    url: string;
    name: string;
    healthStatus: 'healthy' | 'broken' | 'out_of_stock' | 'fallback_active';
    stockStatus: string;
    lastChecked: string;
    alertEnabled: boolean;
    fallbackUrl?: string;
    autoFallbackEnabled: boolean;
  }>;
}

// POST /api/health/products/:id/fallback
// Configure auto-fallback
interface ConfigureFallbackRequest {
  fallbackUrl: string;
  fallbackType: 'search' | 'category' | 'custom';
  autoFallbackEnabled: boolean;
}
```

### Tax Export with Personas

```typescript
// GET /api/exports/tax
interface TaxExportParams {
  year: number;
  format: 'pdf' | 'csv';
  persona: 'german_freelancer' | 'german_small_business' | 'dutch_zzp' | 
           'french_micro' | 'uk_sole_trader' | 'generic_eu';
}
// Returns: file download with persona-appropriate formatting

// GET /api/exports/personas
// List available tax personas with descriptions
interface TaxPersonasResponse {
  personas: Array<{
    id: string;
    name: string;
    description: string;
    country: string;
  }>;
}
```

### Brand Pitch Deck

```typescript
// POST /api/pitch/generate
interface GeneratePitchRequest {
  dateRange?: { start: string; end: string }; // Default: last 12 months
}

interface GeneratePitchResponse {
  downloadUrl: string; // Temporary URL to PDF
  preview: {
    totalClicks: number;
    topCategories: string[];
    avgConversionRate: number;
    geoDistribution: { [country: string]: number };
  };
}
```

### Platform Reliability

```typescript
// GET /api/reliability
interface ReliabilityResponse {
  dateRange: { start: string; end: string };
  platforms: Array<{
    platform: string;
    uptimePercent: number;
    issueCount: number;
    avgResolutionHours: number;
  }>;
}
```

---

## Services Architecture

```
src/
├── index.ts                        # Hono app entry
├── api/
│   ├── redirect-routes.ts          # SmartWrapper redirects + in-app detection
│   ├── storefronts-routes.ts       # Multi-storefront management
│   ├── transactions-routes.ts      # Earnings data + currency conversion
│   ├── loss-ledger-routes.ts       # Revenue loss tracking
│   ├── optimizer-routes.ts         # ★ Smart Link Optimizer
│   ├── attribution-routes.ts       # Diagnostics (not protection)
│   ├── smartwrapper-routes.ts      # CRUD + transparency
│   ├── health-routes.ts            # Product health + fallbacks
│   ├── export-routes.ts            # Tax with personas
│   ├── pitch-routes.ts             # Brand deck generator
│   ├── reliability-routes.ts       # Platform scores
│   └── gdpr-routes.ts
│
├── services/
│   ├── param-preserver.ts          # UTM pass-through
│   ├── in-app-detector.ts          # Browser detection
│   ├── interstitial-generator.ts   # Escape page HTML
│   ├── csv-importer.ts             # Multi-platform CSV parsing
│   ├── currency-converter.ts       # ECB rates, real-time conversion
│   ├── awin-client.ts              # Awin OAuth + API
│   ├── tradedoubler-client.ts      # Tradedoubler OAuth + API
│   ├── health-checker.ts           # Link health checks
│   ├── loss-estimator.ts           # Revenue loss calculations
│   ├── fallback-manager.ts         # Auto-fallback logic
│   ├── optimizer.ts                # Program comparison + confidence
│   ├── attribution-checker.ts      # Redirect chain analysis
│   ├── pitch-generator.ts          # PDF generation
│   ├── tax-formatter.ts            # Persona-based formatting
│   └── email-service.ts            # Alerts (money-saved framing)
│
├── workers/
│   ├── health-check-cron.ts        # Daily health checks
│   ├── sync-cron.ts                # Platform data sync
│   ├── exchange-rate-cron.ts       # ECB rates update
│   └── loss-calculation-cron.ts    # Aggregate loss estimates
│
└── lib/
    ├── supabase.ts
    ├── types.ts
    └── utils.ts
```

---

## Data Normalization Service

**Critical:** Different platforms report data differently.

```typescript
// src/services/csv-importer.ts

interface NormalizedTransaction {
  transactionDate: Date;
  productName: string;
  productId: string | null;
  clicks: number;
  orders: number; // Unified: shipped for Amazon, ordered for others
  revenue: number;
  commission: number;
  originalCurrency: string;
}

// Amazon reports "shipped" items
function parseAmazonCsv(csv: string, region: string): NormalizedTransaction[] {
  // Parse and normalize
  // Note: Amazon DE uses semicolon delimiter, Amazon US uses comma
  // Note: Amazon reports shipped items, not ordered
}

// LTK reports differently
function parseLtkCsv(csv: string): NormalizedTransaction[] {
  // LTK format is different
}

// Awin API returns structured data
function normalizeAwinData(data: AwinTransaction[]): NormalizedTransaction[] {
  // Normalize from API response
}
```

---

## Currency Conversion Service

```typescript
// src/services/currency-converter.ts

interface ExchangeRates {
  base: 'EUR';
  date: string;
  rates: { [currency: string]: number };
}

export class CurrencyConverter {
  private rates: ExchangeRates;
  
  async updateRates() {
    // Fetch from ECB (free, no API key needed)
    const response = await fetch(
      'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
    );
    // Parse XML and update rates
  }
  
  convert(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    
    // Convert through EUR as base
    const inEur = from === 'EUR' ? amount : amount / this.rates.rates[from];
    const result = to === 'EUR' ? inEur : inEur * this.rates.rates[to];
    
    return Math.round(result * 100) / 100;
  }
}
```

---

## Loss Estimation Service

```typescript
// src/services/loss-estimator.ts

interface LossEstimate {
  estimatedClicksLow: number;
  estimatedClicksHigh: number;
  estimatedLossLow: number;
  estimatedLossHigh: number;
}

export class LossEstimator {
  constructor(private supabase: SupabaseClient) {}
  
  async estimateLoss(
    productId: string,
    durationHours: number
  ): Promise<LossEstimate> {
    // Get historical click data for this product
    const { data: history } = await this.supabase
      .from('click_events')
      .select('*')
      .eq('product_id', productId)
      .gte('clicked_at', thirtyDaysAgo());
    
    // Calculate average clicks per hour
    const avgClicksPerHour = history.length / (30 * 24);
    
    // Estimate affected clicks (with uncertainty range)
    const estimatedClicksLow = Math.floor(avgClicksPerHour * durationHours * 0.5);
    const estimatedClicksHigh = Math.ceil(avgClicksPerHour * durationHours * 1.5);
    
    // Get average commission per click from user's data
    const avgCommissionPerClick = await this.getAvgCommissionPerClick(productId);
    
    return {
      estimatedClicksLow,
      estimatedClicksHigh,
      estimatedLossLow: estimatedClicksLow * avgCommissionPerClick,
      estimatedLossHigh: estimatedClicksHigh * avgCommissionPerClick,
    };
  }
}
```

---

## Smart Link Optimizer Service

```typescript
// src/services/optimizer.ts

export class LinkOptimizer {
  constructor(private supabase: SupabaseClient) {}
  
  async analyze(url: string, userId: string) {
    // 1. Parse URL
    const parsed = this.parseUrl(url);
    
    // 2. Identify brand
    const brand = await this.identifyBrand(parsed);
    
    // 3. Get current program info
    const currentProgram = this.getCurrentProgram(parsed);
    
    // 4. Find alternatives with confidence scores
    const { data: alternatives } = await this.supabase
      .from('affiliate_programs')
      .select('*')
      .ilike('brand_name', `%${brand}%`)
      .neq('network', currentProgram.network)
      .order('commission_rate_high', { ascending: false });
    
    // 5. Get user's traffic data for this product type
    const monthlyClicks = await this.getMonthlyClicksForCategory(userId, parsed.category);
    
    // 6. Calculate potential gains with confidence
    const rankedAlternatives = alternatives.map(alt => ({
      ...alt,
      // Show ranges, not guarantees
      potentialGainLow: this.calculateGain(
        monthlyClicks * 0.7, // Conservative estimate
        currentProgram.rate,
        alt.commission_rate_low
      ),
      potentialGainHigh: this.calculateGain(
        monthlyClicks * 1.3, // Optimistic estimate
        currentProgram.rate,
        alt.commission_rate_high
      ),
      // Confidence based on data freshness and source
      confidenceScore: this.calculateConfidence(alt),
    }));
    
    return {
      originalUrl: url,
      brand,
      productName: parsed.productName,
      currentProgram,
      alternatives: rankedAlternatives,
    };
  }
  
  private calculateConfidence(program: any): number {
    // 1-5 score based on:
    // - How recently verified (5 if <7 days, 4 if <30 days, etc.)
    // - Data source (API = 5, manual = 3, community = 2)
    // - Commission range spread (narrow = higher confidence)
    let score = 3;
    
    const daysSinceVerified = (Date.now() - new Date(program.last_verified).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerified < 7) score += 1;
    else if (daysSinceVerified > 60) score -= 1;
    
    if (program.source === 'api') score += 1;
    else if (program.source === 'community') score -= 1;
    
    return Math.max(1, Math.min(5, score));
  }
}
```

---

## Email Alerts (Money-Saved Framing)

```typescript
// src/services/email-service.ts

const ALERT_TEMPLATES = {
  link_broken: {
    subject: 'AffiMark detected a broken link',
    body: (data: any) => `
      Your ${data.productName} link was broken.
      
      Duration: ${data.durationHours} hours
      Estimated prevented loss: €${data.estimatedLossLow}-€${data.estimatedLossHigh}
      
      We caught this before it cost you more.
      
      [View in AffiMark →]
    `,
  },
  
  out_of_stock_fallback: {
    subject: 'AffiMark auto-redirected your OOS product',
    body: (data: any) => `
      Your ${data.productName} went out of stock.
      
      Good news: We automatically redirected traffic to your fallback.
      Estimated earnings preserved: €${data.estimatedSaved}
      
      [Update the link manually →]
    `,
  },
  
  better_program_found: {
    subject: 'AffiMark found a higher-paying program',
    body: (data: any) => `
      Same product. Better commission.
      
      Current: ${data.currentProgram} (${data.currentRate}%)
      Available: ${data.suggestedProgram} (${data.suggestedRate}%)
      
      Potential extra earnings: €${data.potentialGainLow}-€${data.potentialGainHigh}/month
      
      [Switch to better program →]
    `,
  },
};
```

---

## Cron Jobs

### Health Check Cron (Every 4 hours)

```typescript
// src/workers/health-check-cron.ts

export async function runHealthCheckCron(env: Env) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  
  // Get tracked products needing check
  const { data: products } = await supabase
    .from('tracked_products')
    .select('*')
    .eq('alert_enabled', true);
  
  for (const product of products || []) {
    const result = await checkHealth(product.product_url);
    const previousStatus = product.health_status;
    
    // Update status
    await supabase
      .from('tracked_products')
      .update({
        health_status: result.status,
        stock_status: result.stockStatus,
        last_checked: new Date().toISOString(),
      })
      .eq('id', product.id);
    
    // If status changed to bad, create loss ledger entry
    if (result.status !== 'healthy' && previousStatus === 'healthy') {
      await createLossLedgerEntry(product, result);
      
      // Handle auto-fallback
      if (product.auto_fallback_enabled && product.fallback_url) {
        await supabase
          .from('smartwrappers')
          .update({ fallback_active: true })
          .eq('product_id', product.id);
        
        await sendEmail(product.user_id, 'out_of_stock_fallback', { ... });
      } else {
        await sendEmail(product.user_id, 'link_broken', { ... });
      }
    }
    
    // If recovered, close the ledger entry
    if (result.status === 'healthy' && previousStatus !== 'healthy') {
      await closeLossLedgerEntry(product.id, 'auto_recovered');
    }
  }
}
```

### Exchange Rate Cron (Daily)

```typescript
// src/workers/exchange-rate-cron.ts

export async function runExchangeRateCron(env: Env) {
  const converter = new CurrencyConverter();
  await converter.updateRates();
  
  // Store in KV for fast access
  await env.RATES_KV.put('current_rates', JSON.stringify(converter.getRates()));
}
```

---

## Commands

```bash
cd backend && npm run dev      # http://localhost:8787
cd backend && npm run deploy
cd backend && npx tsc --noEmit # Type-check
```

---

## Performance Requirements

| Operation | Max Latency |
|-----------|-------------|
| SmartWrapper redirect | <50ms total |
| In-app browser check | <1ms |
| Click logging | Non-blocking |
| Optimizer analysis | <3s |
| Health check (single) | <10s |
| CSV import (1000 rows) | <5s |
| PDF generation | <30s |

---

## Security

- All routes require auth except `/go/:code` (public redirect)
- Rate limit `/go/:code` to 100/min per IP
- Rate limit `/api/optimizer/analyze` to 20/min per user
- Validate all user input
- OAuth tokens encrypted at rest
- GDPR deletion within 30 days

---

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
AWIN_CLIENT_ID=
AWIN_CLIENT_SECRET=
TRADEDOUBLER_CLIENT_ID=
TRADEDOUBLER_CLIENT_SECRET=
RESEND_API_KEY=
```
