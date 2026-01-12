# AffiMark User Guide
**Revenue Protection for Affiliate Creators**

Welcome to AffiMark - your unified platform for tracking affiliate earnings, protecting revenue, and staying tax-ready.

---

## 🎯 What AffiMark Does

AffiMark is NOT another analytics dashboard. We're your **Revenue Operations Platform**:

✅ **Aggregate Income** - See all affiliate earnings in one place (Amazon, Awin, LTK, ShopMy)
✅ **Detect Revenue Leaks** - Know when links break, products go out of stock
✅ **Optimize Commissions** - Find better-paying programs for the same products
✅ **Tax Readiness** - One-click export formatted for your country (Germany, UK, Netherlands, etc.)

**Our Promise**: Revenue protection. Operational sanity. Tax readiness. Decision clarity.

---

## 📚 Table of Contents

1. [Getting Started](#getting-started)
2. [Dashboard Overview](#dashboard-overview)
3. [Connecting Storefronts](#connecting-storefronts)
4. [Importing Earnings (CSV)](#importing-earnings-csv)
5. [Understanding Your Data](#understanding-your-data)
6. [Tax Exports](#tax-exports)
7. [Link Health Monitoring](#link-health-monitoring)
8. [Smart Link Optimizer](#smart-link-optimizer)
9. [Revenue Loss Ledger](#revenue-loss-ledger)
10. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### First Login

When you first log in, you'll see an empty dashboard. Don't worry - this is normal!

**Your first steps:**
1. Go to **Storefronts** (sidebar navigation)
2. Click **"Connect Storefront"**
3. Choose your platform (Amazon DE, Awin, LTK, etc.)
4. Upload your first earnings CSV
5. Watch your dashboard populate!

**Estimated time**: 5 minutes to see your first data

---

## Dashboard Overview

Your main dashboard shows:

### 📊 Total Earnings Card
```
┌─────────────────────────────────────────┐
│  Total Earnings (Last 30 Days)          │
│  €4,230.45              ↑ +12.3%       │
└─────────────────────────────────────────┘
```

**What it shows**: All earnings across ALL storefronts, normalized to your home currency (EUR by default)

**Why it matters**: One number to track your entire affiliate business

---

### 📈 Storefront Breakdown
```
┌─────────────────────────────────────────┐
│  Breakdown by Storefront                 │
│                                          │
│  Amazon DE    ████████████ €2,100  49%  │
│  Amazon UK    ██████       €527    12%  │
│  Awin         ████████████ €1,500  35%  │
│  LTK          ██           €103     4%  │
└─────────────────────────────────────────┘
```

**What it shows**: Which platforms are earning the most

**Why it matters**: Know where to focus your content creation

**Pro Tip**: If one platform is underperforming, consider pivoting content or checking link health

---

### 🏆 Top Storefronts
```
┌─────────────────────────────────────────┐
│  Top Storefronts                         │
│                                          │
│  1. 🇩🇪 My German Store     €2,100      │
│  2. 🔗 Awin Account         €1,500      │
│  3. 🇬🇧 My UK Store         €527        │
└─────────────────────────────────────────┘
```

**What it shows**: Your best-performing connected accounts

**Why it matters**: Quickly see what's working

---

### 📅 Recent Transactions

Shows your latest earnings with:
- Date
- Product name
- Platform
- Commission (original + EUR)
- Status

**Why it matters**: Verify imports are working correctly

---

## Connecting Storefronts

### What is a "Storefront"?

A **storefront** is any platform where you earn affiliate commissions:
- **Amazon Associates** (DE, UK, US, etc.)
- **Awin** (Affiliate network)
- **LTK** (RewardStyle creator platform)
- **ShopMy** (Storefront builder)
- **Tradedoubler** (Affiliate network)

**You can connect multiple storefronts of the same platform!**

Example: Connect Amazon DE + Amazon UK + Amazon US separately

---

### How to Connect

1. **Navigate**: Dashboard → Storefronts
2. **Click**: "Connect Storefront" button
3. **Select Platform**: Choose from 10+ options
4. **Configure**:
   - **Storefront Name**: "My German Amazon Store" (any name you like)
   - **Account Identifier**: Your affiliate tag (optional but recommended)
5. **Click**: "Connect Storefront"

**Result**: New storefront card appears with "pending" status

---

### Platform-Specific Notes

#### Amazon Associates (All Regions)
- **Connection Method**: CSV Upload
- **Account ID**: Your Amazon Associates Tag (e.g., "yourtag-21")
- **Why CSV**: Amazon API requires sales history (most creators don't have access)
- **Regions Supported**: DE, UK, US, FR, ES, IT

#### Awin
- **Connection Method**: CSV Upload (OAuth coming Phase 1.5)
- **Account ID**: Awin Publisher ID
- **Why Both**: CSV works now, OAuth will auto-sync later

#### LTK (RewardStyle)
- **Connection Method**: CSV Upload only
- **Account ID**: LTK Creator ID
- **Why CSV**: LTK has no public API

#### ShopMy
- **Connection Method**: CSV Upload only
- **Account ID**: ShopMy Creator ID

---

## Importing Earnings (CSV)

### Step-by-Step Guide

#### 1. Download CSV from Platform

**Amazon Associates:**
1. Log into Amazon Associates
2. Go to **Reports** → **Earnings Report**
3. Select date range (last month recommended)
4. Click **Download** → Choose **CSV**

**Awin:**
1. Log into Awin Dashboard
2. Go to **Reports** → **Transaction Report**
3. Select date range
4. Export as CSV

**LTK:**
1. Log into LTK Creator Dashboard
2. Go to **Earnings**
3. Export earnings report

---

#### 2. Upload CSV to AffiMark

1. Go to **Storefronts** page
2. Find your connected account card
3. Click **"Upload CSV"** button
4. **Drag and drop** your CSV file (or click to browse)
5. Click **"Import Transactions"**
6. Wait for import to complete (usually 5-10 seconds)

**Success**: You'll see "X transactions imported, Y duplicates skipped"

---

#### 3. Verify Import

1. Go to **Dashboard**
2. Check **Total Earnings** updated
3. Check **Recent Transactions** shows new entries
4. Verify amounts look correct

**Pro Tip**: Run a small test import first (last 7 days) to verify everything works before importing full history

---

### Re-Importing is Safe

AffiMark prevents duplicates automatically. You can:
- Re-upload the same CSV (duplicates skipped)
- Upload overlapping date ranges (we detect and skip)
- Import incrementally (upload last month, then this month later)

**Why**: We use (user_id, platform, transaction_id, date) as unique constraint

---

## Understanding Your Data

### Multi-Currency Normalization

**The Problem**: Your earnings come in different currencies
- Amazon DE: EUR
- Amazon UK: GBP
- Amazon US: USD
- Awin: Multiple currencies

**AffiMark Solution**: Everything converted to EUR (or your home currency)

**Example**:
```
Original: £450 (GBP) on Amazon UK
Converted: €527.50 (EUR) using ECB rate 1.17
Dashboard shows: €527.50
```

**Why EUR**: ECB (European Central Bank) rates = EU compliance and accuracy

**Can I change home currency?**
- Coming in Phase 5 (User Preferences)
- For now, all amounts stored and displayed in EUR

---

### Exchange Rates

**Source**: European Central Bank (ECB) official rates

**Update Frequency**: Daily (via cron job)

**Fallback**: If rate not found for a specific date, we use nearest rate within 7 days

**Accuracy**: Exchange rates stored to 6 decimal places for precision

---

### Transaction Fields Explained

| Field | Description | Example |
|-------|-------------|---------|
| **transaction_date** | Date of sale/click | 2025-01-15 |
| **product_name** | What was purchased | "Sony WH-1000XM5 Headphones" |
| **product_id** | ASIN, SKU, etc. | B09XYZ123 |
| **clicks** | How many clicks | 45 |
| **orders** | How many ordered | 3 |
| **items_shipped** | How many shipped (Amazon) | 2 |
| **commission** | Your earnings (original) | €11.99 |
| **original_currency** | Currency code | EUR, GBP, USD |
| **commission_eur** | Normalized to EUR | €11.99 |
| **exchange_rate** | Rate used | 1.17 |

---

## Tax Exports

### Tax Personas

AffiMark provides **pre-configured tax templates** for different EU countries:

| Persona | Country | Format | Use Case |
|---------|---------|--------|----------|
| **German Freelancer** | 🇩🇪 Germany | EÜR | Freiberufler, includes VAT |
| **German Small Business** | 🇩🇪 Germany | Simplified | Kleinunternehmer, no VAT |
| **UK Sole Trader** | 🇬🇧 UK | Self Assessment | GBP primary currency |
| **Dutch ZZP** | 🇳🇱 Netherlands | BTW | BTW-ready format |
| **Lithuanian MB** | 🇱🇹 Lithuania | Dual Currency | EUR format |
| **Generic EU** | 🇪🇺 EU | Standard | Works anywhere |

---

### How to Export for Taxes

1. **Navigate**: Dashboard → Tax Exports (or Settings → Tax)
2. **Select Persona**: Choose your business type
3. **Select Date Range**: Usually full year (e.g., 2024-01-01 to 2024-12-31)
4. **Choose Format**: PDF or CSV (or both)
5. **Click**: "Generate Export"

**Result**: Downloads formatted report ready for your accountant

---

### What's Included in Export

**PDF Format**:
- Cover page with summary
- Transaction list grouped by platform
- Monthly breakdown
- VAT columns (if applicable)
- Exchange rates used
- Disclaimer: "Review with your accountant"

**CSV Format**:
- All transactions with full details
- Date, Platform, Product, Commission (original + EUR)
- Exchange rate
- VAT indication (if applicable)
- Ready to import into accounting software

---

### Tax Disclaimers (Important!)

⚠️ **AffiMark does NOT provide tax advice**

✅ What we do: Format data in commonly accepted structures
❌ What we don't do: Guarantee compliance or provide legal/tax advice

**Always review exports with your accountant before filing taxes.**

---

## Link Health Monitoring

### What is Link Health?

**Link Health** = Are your affiliate links earning or leaking money?

AffiMark checks your links for:
- ✅ **Broken links** (404 errors)
- ✅ **Out of stock products** (can't buy = no commission)
- ✅ **Missing affiliate tags** (link works but you don't get paid)
- ✅ **Destination drift** (link redirects to wrong page)

---

### Revenue Health Score

```
┌─────────────────────────────────────────┐
│  Revenue Health Score                    │
│                                          │
│       87/100                             │
│       ████████████████░░░                │
│                                          │
│  3 issues detected                       │
│  Estimated at risk: €180-€420           │
└─────────────────────────────────────────┘
```

**Scoring**:
- **90-100**: Excellent - All systems green
- **70-89**: Good - Minor issues to address
- **50-69**: Fair - Revenue at risk
- **Below 50**: Critical - Immediate action needed

---

### How It Works

1. **Daily Audits**: AffiMark checks all your tracked links every day
2. **Issue Detection**: When something breaks, we create an issue
3. **Alert Sent**: You get notified (email + in-app)
4. **Revenue Impact Shown**: "This link was broken 6 hours, estimated loss: €42-€110"

---

### Issue Types Explained

#### Broken Link (404)
**What**: Link returns 404 Not Found
**Impact**: 100% revenue loss for that link
**Fix**: Update or remove link

#### Out of Stock
**What**: Product shows "Sold Out" or "Unavailable"
**Impact**: No sales possible
**Fix**: Switch to alternative product or wait for restock

#### Missing Affiliate Tag
**What**: Link works but your tag is missing
**Impact**: Sales happen but you don't get paid
**Fix**: Re-add your affiliate tag

#### Destination Drift
**What**: Link now goes to homepage instead of product page
**Impact**: Lower conversion rate
**Fix**: Update link to correct product

---

## Smart Link Optimizer

### What It Does

**Finds better-paying programs for the same product you're already promoting.**

**Example**:
```
Current: Amazon Germany (3% commission)
Product: Sony WH-1000XM5 Headphones

Better alternative found:
✅ Sony Direct via Awin (8-12% commission)
   Potential extra: €40-€80/month

[Create Optimized Link →]
```

---

### How It Works

1. **Paste Link**: Enter your current affiliate link
2. **AffiMark Analyzes**: We identify the product and brand
3. **Comparison**: We check our database for better programs
4. **Results**: Show alternatives with confidence scores

**Important**: We show RANGES (8-12%), not guarantees. Rates vary by campaign and creator tier.

---

### Confidence Indicators

- **●●●●● High**: Verified within 3 days, reliable source
- **●●●●○ Medium**: Verified within 1 week
- **●●●○○ Low**: Community reported, needs verification

**Never say**: "You will earn 12%"
**Always say**: "Programs typically pay 8-12% (verified 3 days ago)"

---

### When to Use Optimizer

✅ **Good use cases**:
- Promoting popular products (Sony, Apple, Zara)
- High-traffic links (worth optimizing)
- Products available through multiple retailers

❌ **Not useful for**:
- Amazon-exclusive products
- Very niche items
- Low-traffic links (optimization effort > gain)

---

## Revenue Loss Ledger

### What It Shows

**Money you ALMOST lost** (but AffiMark caught it in time)

```
┌─────────────────────────────────────────┐
│  Revenue Loss Ledger                     │
│  This Month: 3 issues caught             │
│  Prevented loss: €180-€420              │
├─────────────────────────────────────────┤
│  📍 Jan 15 - Amazon camera link broken   │
│     Duration: 6 hours                    │
│     Est. affected clicks: 45-120         │
│     Est. revenue at risk: €42-€110      │
│     Status: ✅ Resolved                  │
│                                          │
│  📍 Jan 12 - Zara dress out of stock     │
│     Duration: 2 days                     │
│     Est. affected clicks: 200-350        │
│     Est. revenue at risk: €80-€180      │
│     Status: ⚡ Auto-redirected           │
└─────────────────────────────────────────┘
```

---

### Why This Matters

**Psychology**: People love knowing what ALMOST went wrong

**Use Case**: "AffiMark saved me €420 this month" = Great testimonial

**How We Calculate**:
- Historical click rate for that link
- Average commission per click
- Duration link was broken
- Confidence range (low-high estimate)

---

## Feature 5: Smart Link Optimizer (Hero Feature)

**"Stop using 3% links when 12% links exist."**

The Smart Link Optimizer is AffiMark's most powerful feature. It analyzes your affiliate links and finds better-paying programs for the same products.

### How It Works

1. **Navigate to Dashboard → Smart Link Optimizer**
2. **Paste any affiliate link** (Amazon, Awin, direct brand link, etc.)
3. **Click "Analyze"** - We identify the brand and current commission rate
4. **Review alternatives** - See better-paying programs with potential earnings

### What You'll See

**Current Link Analysis:**
- Brand name
- Current platform (e.g., Amazon Germany)
- Current commission rate (e.g., 3%)

**Better Alternatives:**
- Higher commission programs (e.g., 8-12% via Awin)
- Confidence score (1-5 stars)
- Cookie duration
- Potential extra earnings per month
- Application requirements

### Example: Amazon Link Optimization

**You paste:**
```
https://www.amazon.de/dp/B08N5WRWNW (Sony Headphones)
```

**AffiMark shows:**
- **Current:** Amazon DE - 3% commission
- **Better:** Sony Direct via Awin - 8-12% commission
- **Potential extra:** €35-€70/month based on your traffic

### Understanding the Results

**Confidence Scores:**
- ●●●●● (5 stars) - Very High: Rate verified within 3 days
- ●●●● (4 stars) - High: Rate verified within 1 week
- ●●● (3 stars) - Medium: Rate verified within 1 month

**Potential Earnings:**
Calculated based on:
- Your average monthly clicks (last 30 days)
- Your average conversion rate
- The commission rate difference
- Industry standard AOV (Average Order Value)

**Important Notes:**
- Commission rates are **estimates** and may vary by product category
- Some programs require application approval
- Rates may differ based on volume tiers
- Always verify with the affiliate network before switching

### Taking Action

When you find a better program:

1. **Click "Apply on [Network]"** - Opens the affiliate network signup
2. **Apply for the program** - May be instant or require approval
3. **Get your affiliate link** - Once approved, create your new link
4. **Update your content** - Replace old links with new ones
5. **Track performance** - Monitor in AffiMark dashboard

### Optimization Suggestions History

All analyzed links appear in the **"Recent Suggestions"** sidebar:
- See all your optimization opportunities
- Mark as "Applied" when you've switched programs
- Dismiss if not relevant
- Estimated value saved

### Best Practices

**✓ DO:**
- Analyze your top-performing links first (biggest impact)
- Verify rates with the network before switching
- Test new programs with a few products first
- Track performance after switching

**✗ DON'T:**
- Switch all links at once (test first)
- Assume rates are guaranteed (they're estimates)
- Ignore application requirements
- Forget to update link-in-bio platforms

### Real-World Example

**Sarah's Success Story:**
- Analyzed her top 20 Amazon links
- Found 8 products available via brand direct programs
- Switched to higher commission programs
- **Result:** +€127/month extra earnings (43% increase)

---

## Feature 6: Revenue Loss Ledger

**"Know exactly what almost went wrong."**

The Revenue Loss Ledger tracks issues that could have cost you money - and shows what AffiMark saved.

### What It Tracks

**Link Issues:**
- Broken links (404 errors)
- Out-of-stock products
- Affiliate tag stripping
- Redirect failures

**For Each Issue:**
- When it was detected
- How long it lasted
- Estimated affected clicks
- Estimated revenue at risk
- How it was resolved

### Money-Saved Framing

Instead of just alerting you to problems, we show the **value we protected**:

**Example Alert:**
```
📍 Oct 15 - Amazon camera link broken (6 hours)
   Estimated affected clicks: 45-120
   Estimated revenue at risk: €42-€110
   Status: ✅ Resolved - You fixed the link
```

### Viewing Your Ledger

**Navigate to Dashboard → Revenue Protection**

You'll see:
- **This Month:** Total issues detected and value at risk
- **Historical timeline** of all issues
- **Resolution status** (resolved, auto-fixed, pending)
- **Platform breakdown** (which platforms had most issues)

### Understanding Estimates

**How we calculate revenue at risk:**

1. **Baseline:** Your average traffic to that link
2. **Downtime:** How long the issue lasted
3. **Conversion rate:** Your historical conversion rate
4. **Commission:** Your average commission per sale
5. **Range:** Low and high estimates (conservative to optimistic)

**Example Calculation:**
- Link gets 10 clicks/day normally
- Link was broken for 6 hours (25% of day)
- Estimated lost clicks: 2-3
- Your avg conversion: 5%
- Your avg commission: €15
- **Estimated at risk:** €1.50 - €2.25

### Resolution Types

**✅ Manual Fix:**
- You fixed the link yourself
- AffiMark alerted you to the issue

**⚡ Auto-Recovered:**
- Issue resolved automatically (product back in stock)
- No action needed

**🔄 Auto-Redirected:**
- Dead Stock feature kicked in
- Traffic redirected to alternative

---

## Tips & Best Practices

### 🎯 For Best Results

1. **Import Regularly**: Upload new earnings monthly (or weekly)
2. **Connect All Platforms**: Don't miss any revenue source
3. **Check Dashboard Weekly**: Stay on top of trends
4. **Fix Issues Quickly**: When alerted, act within 24 hours
5. **Use Optimizer**: Check high-traffic links for better rates

---

### 💰 Maximizing Revenue

1. **Multi-Platform Strategy**: Don't rely on just Amazon
2. **Track Growth**: Use month-over-month comparison
3. **Optimize Top Links**: Focus on your 20% that drives 80% revenue
4. **Stay Diversified**: Multiple storefronts = more stable income

---

### 📊 Understanding Your Data

1. **Wait 48 Hours**: Platforms take time to report sales
2. **Check Original Currency**: Verify conversions make sense
3. **Compare Platforms**: See which has best conversion rates
4. **Seasonal Patterns**: Note Q4 spike (holidays)

---

### 🔒 Security & Privacy

1. **We Never Store**: Your Amazon/Awin passwords
2. **CSV Only Contains**: Public data you can download anytime
3. **OAuth (Future)**: Standard secure flow, revocable anytime
4. **GDPR Compliant**: EU-based company, data residency in EU
5. **Export Anytime**: Full data export on demand

---

## Need Help?

### Common Questions

**Q: Can I delete a storefront?**
A: Yes, click the trash icon on the storefront card. This deletes the connection but keeps historical transactions.

**Q: What if my CSV format is different?**
A: Contact support with a sample. We can add support for your platform's format.

**Q: Why does my total not match the platform?**
A: Check date ranges match. Also, platforms may count "ordered" vs "shipped" differently.

**Q: Can I change my home currency from EUR?**
A: Coming in Phase 5 (User Preferences).

**Q: Is my data secure?**
A: Yes. We use Supabase (SOC 2 certified), row-level security, and EU data residency.

---

### Contact Support

- **Email**: support@affimark.io
- **Discord**: [Join Community](https://discord.gg/affimark)
- **GitHub Issues**: [Report Bug](https://github.com/affimark/affimark/issues)

---

## Roadmap

### Coming Soon

**Phase 1.5** (Next 2 weeks):
- OAuth for Awin (auto-sync daily)
- OAuth for Tradedoubler
- User preferences (home currency, timezone)

**Phase 2** (Next 4 weeks):
- SmartWrappers (affimark.io/go/xyz links)
- In-app browser detection
- Dead stock auto-alternative

**Phase 3** (Next 6 weeks):
- Attribution diagnostics
- Platform reliability score
- Brand pitch deck generator

**Phase 4** (Next 8 weeks):
- Full Smart Link Optimizer launch
- Commission comparison database
- A/B testing for links

---

## Changelog

### v1.0.0 (2025-01-06)
- ✅ Multi-storefront connections
- ✅ CSV import (Amazon, Awin, LTK, ShopMy)
- ✅ Multi-currency normalization (EUR)
- ✅ Unified dashboard
- ✅ Tax personas (6 countries)
- ✅ Basic link health monitoring

---

**Welcome to AffiMark!** 🚀

Your links are no longer leaking money.
