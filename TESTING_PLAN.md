# AffiMark Alternative Agent — Comprehensive Testing Plan

## What We're Testing

The alternative product search agent takes a product URL, identifies what it is, searches for alternatives from different brands, and ranks them by the creator's priorities. We need to verify every stage of this pipeline works correctly and produces meaningful results.

---

## Prerequisites

### External Services Required

| Service | Env Variable | Purpose | Required? |
|---------|-------------|---------|-----------|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | User profiles, priorities, storefronts | Yes — without it, the profile is empty |
| Datafeedr | `DATAFEEDR_ACCESS_ID`, `DATAFEEDR_SECRET_KEY` | Product search database | Yes — this is the data source for alternatives |
| OpenAI | `OPENAI_API_KEY` | Semantic scoring, AI product identification, query generation | Yes — degrades heavily without it |
| Rainforest | `RAINFOREST_API_KEY` | Amazon product identification | Optional — has scrape/slug/AI fallbacks |

### How to Run

```bash
# Terminal 1: Backend
cd backend
cp .env.local.recommended .dev.vars  # Fill in real keys
npx wrangler dev --port 8787 --local --show-interactive-dev-session false

# Terminal 2: Test
export BACKEND_URL=http://127.0.0.1:8787
```

### Test User

User ID: `8acd050f-4dc3-4432-8a95-0057b816b46b`

**Profile:**
- Product priorities: quality (#1), price (#2), sustainability (#3), reviews (#4), shipping (#5)
- Brand priorities: commission (#1), return_policy (#2), customer_service (#3), reputation (#4), payment_speed (#5)
- Socials: YouTube, Facebook, Instagram, TikTok (Shea Whitney — beauty/lifestyle creator)
- Storefronts: Amazon (2 links), Affiliate (1 Vegamour link)

---

## Test Matrix

### Test 1: Amazon Product URL (Known Brand, High Confidence)

**Input:** A well-known Amazon product URL (e.g., Sony WH-1000XM5, CeraVe Moisturizer, Dyson Airwrap)

**What to measure:**

| Stage | Benchmark | Pass Criteria |
|-------|-----------|---------------|
| **Product identification** | Confidence score | >= 50 |
| **Product identification** | Correct category | Category matches the actual product type (e.g., "Headphones", not "Electronics") |
| **Product identification** | Brand extracted | Brand name correctly identified |
| **Product identification** | Price extracted | Within 20% of actual retail price |
| **Search queries** | Query relevance | Queries describe the product TYPE without brand name |
| **Alternatives returned** | Count | >= 3 alternatives |
| **Category match** | All results | Every alternative is the same product type (headphones → headphones, not speakers) |
| **Brand exclusion** | All results | No alternative has the same brand as the input |
| **Price coherence** | All results | Every alternative within 0.3x-3.0x of original price |
| **Priority alignment** | Top result | Top result's priority1 (quality) KPI score >= 50 |
| **Semantic similarity** | Average | Average semantic score >= 40 across returned alternatives |
| **Combined score** | Top result | >= 50 |
| **Degradation** | Level | "none" or "partial" (not "severe") |
| **Latency** | Total | < 30 seconds |

### Test 2: Non-Amazon Affiliate URL (Lower Confidence)

**Input:** A non-Amazon affiliate link (e.g., Vegamour link, LTK link, Awin deep link)

**What to measure:**

| Stage | Benchmark | Pass Criteria |
|-------|-----------|---------------|
| **Product identification** | Confidence score | >= 30 (lower threshold for affiliate URLs) |
| **Product identification** | Category inferred | A reasonable category is assigned (not "General") |
| **AI fallback** | Triggered | If scrape fails, AI identification is attempted |
| **Alternatives returned** | Count | >= 1 (may be fewer due to lower identification confidence) |
| **Category match** | All results | Same product type as identified |
| **Degradation** | Tracked | If identification is weak, degradation reflects it |

### Test 3: Category/Text Search (No URL)

**Input:** A text description instead of URL (e.g., "wireless noise cancelling headphones", "organic face moisturizer")

**What to measure:**

| Stage | Benchmark | Pass Criteria |
|-------|-----------|---------------|
| **Product identification** | Source | Should be "url_slug" or "ai_url" |
| **Alternatives returned** | Count | >= 3 |
| **Category match** | All results | Relevant to the search text |
| **Priority respect** | Top result | Reflects user's priority ranking |

### Test 4: Profile Personalization Verification

**Purpose:** Verify that the same product URL produces different rankings for users with different priorities.

**Method:** Compare results for the test user (quality #1) against a hypothetical user with (price #1). Since we only have one test user, we measure whether quality-focused signals are weighted higher in the scoring.

| Signal | Benchmark | Pass Criteria |
|--------|-----------|---------------|
| **Priority1 KPI** | Top result | The #1 ranked priority's KPI score is higher than the #5 ranked priority's KPI score in the top result |
| **Quality filtering** | White-label exclusion | No Temu/Wish/Shein/AliExpress results (user ranks quality #1) |
| **KPI breakdown** | Present | Each alternative has productKpis and brandKpis arrays with scores and reasons |

### Test 5: Original Product Risk Assessment

**Purpose:** Verify the risk card for the original product is computed and meaningful.

| Signal | Benchmark | Pass Criteria |
|--------|-----------|---------------|
| **Risk scores** | All present | merchantRisk, programFriction, demandEvidence, refundRisk all 0-100 |
| **Overall score** | Reasonable | Not 0 or 100 (extreme values suggest no real computation) |
| **Confidence** | Present | > 0 |
| **Verdict mapping** | Correct | overall >= 70 = keep, 50-69 = review, < 50 = replace |

### Test 6: Edge Cases

| Input | Expected Behavior |
|-------|-------------------|
| Invalid URL (e.g., `https://google.com`) | Returns early with "Could not identify the product" |
| Empty string | Returns error or early exit |
| URL with no product (e.g., homepage) | Low confidence, graceful fallback |
| Very expensive product ($5000+) | Price range expands but still returns relevant alternatives |
| Very cheap product ($2) | Returns budget alternatives, not premium |

### Test 7: Resilience & Degradation

| Scenario | How to Simulate | Expected |
|----------|----------------|----------|
| No OpenAI key | Remove `OPENAI_API_KEY` from .dev.vars | Keyword fallback for semantic scoring; degradation level "partial" |
| No Datafeedr keys | Remove `DATAFEEDR_*` from .dev.vars | Zero results; degradation level "severe" with "product_database_unavailable" |
| Timeout | Use a very slow product identification (complex URL) | Should complete within 45s or return timeout error |

---

## Benchmarks & Scoring Rubric

### Per-Search Quality Score (0-100)

Calculate this for each test search:

```
Quality Score = (
  (identificationScore * 0.15) +
  (categoryAccuracy * 0.25) +
  (alternativeCount * 0.15) +
  (priorityRespect * 0.20) +
  (priceCoherence * 0.10) +
  (diversityScore * 0.10) +
  (latencyScore * 0.05)
)
```

| Component | How to Score (0-100) |
|-----------|---------------------|
| **identificationScore** | Product confidence score directly (capped at 100) |
| **categoryAccuracy** | 100 if all alternatives match category, 0 if none do. Deduct 20 per wrong-category result. |
| **alternativeCount** | `min(100, (count / 5) * 100)` — 5+ alternatives = 100 |
| **priorityRespect** | 100 if top result scores highest on priority #1 KPI; 50 if it's in top 3; 0 otherwise |
| **priceCoherence** | 100 if all within 0.5x-2.0x of original; deduct 20 per outlier |
| **diversityScore** | 100 if all alternatives are from different brands; deduct 25 per duplicate brand |
| **latencyScore** | 100 if < 10s, 75 if < 20s, 50 if < 30s, 25 if < 45s, 0 if timeout |

### Overall Agent Quality Thresholds

| Rating | Score Range | What It Means |
|--------|------------|---------------|
| **Excellent** | 80-100 | Ship-ready. Results are accurate, personalized, and fast. |
| **Good** | 60-79 | Usable but needs refinement. Some category mismatches or weak personalization. |
| **Needs Work** | 40-59 | Core pipeline works but results are inconsistent. Scoring or search queries need tuning. |
| **Broken** | 0-39 | Pipeline fails frequently. Wrong categories, empty results, or crashes. |

### Minimum Viable Thresholds for Deployment

| Metric | Minimum Acceptable | Target |
|--------|-------------------|--------|
| **Product identification rate** | 70% of URLs produce confidence >= 30 | 90% |
| **Alternative return rate** | 80% of identified products return >= 1 alternative | 95% |
| **Category accuracy** | 90% of alternatives are same product type | 98% |
| **Zero-result rate** | < 30% of searches return zero alternatives | < 10% |
| **Mean combined score** | >= 40 for returned alternatives | >= 55 |
| **Mean latency** | < 30s | < 15s |
| **Timeout rate** | < 5% | < 1% |
| **Degradation rate** | < 20% of searches report degradation | < 5% |

---

## Test Product URLs

Use these specific URLs to test different categories and difficulty levels:

### Easy (Well-known Amazon products)

```
# Electronics — headphones
https://www.amazon.com/dp/B0BX4L2GNJ

# Beauty — moisturizer
https://www.amazon.com/dp/B00TTD9BRC

# Home — kitchen appliance
https://www.amazon.com/dp/B08R6KLWXH
```

### Medium (Amazon but less mainstream)

```
# Fashion — specific clothing item
https://www.amazon.com/dp/B0CXWXHZ4H

# Health — supplement
https://www.amazon.com/dp/B07K2YZMKN
```

### Hard (Non-Amazon / Affiliate links)

```
# Vegamour affiliate link (test user's actual product)
https://www.tkqlhce.com/click-101523981-17151152

# Generic text queries
"dry texture hair spray"
"wireless noise cancelling headphones under 200"
"organic vitamin C serum"
```

---

## What to Log & Capture

For each test, capture this output from the backend logs:

```
[Agent] Step 1: Loading creator profile...
[Agent] Profile: confidence=X% product=[...] brand=[...]
[Agent] Step 2: Identifying product from URL...
[Agent] Product: "..." | Brand: ... | Category: ... | Price: $... | Confidence: X%
[Agent] Original product risk: overall=X confidence=X
[Agent] Product type queries: "...", "...", "..."
[Agent] Brand exclusions: [...]
[Agent] N search strategies generated
[Agent] Search 1/N: "..." (strategy_name)
[Agent] Search 1: X raw → X new → X semantic → X quality → X passed (top=X)
...
[Agent] Done: X alternatives from X evaluated in Xms
  → "Product Name" | Brand | $Price | combined=X sem=X pri=X
[Agent:metrics] {...}
```

The `[Agent:metrics]` JSON line contains all key metrics in a single parseable object.

---

## How to Interpret Results

### If Product Identification Fails (confidence < 15)

- **For Amazon URLs:** Check if Rainforest API key is set. Check if the ASIN is valid. The URL might be a storefront page rather than a product page.
- **For affiliate URLs:** This is expected to be harder. Check if AI fallback (OpenAI) was triggered. Check if the URL resolves to a product page or a redirect.
- **For text queries:** Identification should use URL slug parser. Check if the text is too generic.

### If Zero Alternatives Are Returned

- **Check Datafeedr:** Are keys set? Is the API responding? Look for `product_database_unavailable` in degradation.
- **Check category gate:** If many candidates are found but all filtered, the category gate may be too strict. Look at `raw → new → semantic → quality → passed` funnel in logs.
- **Check semantic threshold:** If many pass category but fail semantic, the SEMANTIC_THRESHOLD (30) may be too high for this product type.
- **Check price range:** If the product is very cheap or expensive, the price range (0.3x-3.0x) might be excluding valid alternatives.

### If Wrong-Category Alternatives Are Returned

- **Check the `General` category bypass:** If the original product is categorized as "General", the category gate is disabled. This is a known weakness.
- **Check `categoriesOverlap`:** The function may be too permissive for broad categories.

### If Priorities Are Not Reflected

- **Check profile confidence:** If confidence is 0, the profile wasn't loaded. Check Supabase connectivity.
- **Check KPI scoring:** Look at the `productKpis` array in each alternative. If all KPIs score 50, enrichment data is likely missing (everything defaulting to neutral).
- **Check priority weights:** Rank 1 should get 5x weight, rank 5 should get 1x. Verify in the combinedScore breakdown.

---

## Test Execution Checklist

```
□ Backend starts without errors
□ Test user profile loads (confidence > 0)
□ Test 1: Amazon product URL — identification + alternatives
□ Test 2: Affiliate URL — lower confidence identification
□ Test 3: Text search — category-based search
□ Test 4: Priority personalization — quality signals weighted higher
□ Test 5: Original product risk — risk card computed
□ Test 6a: Invalid URL — graceful failure
□ Test 6b: Homepage URL — graceful failure
□ Test 7a: No OpenAI — keyword fallback works
□ Test 7b: No Datafeedr — degradation reported
□ Calculate per-search quality scores
□ Compare against minimum viable thresholds
```
