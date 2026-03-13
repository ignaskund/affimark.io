#!/bin/bash
# Comprehensive dataflow test for AffiMark alternative search agent
# Tests: user context gathering, KPI accuracy, search quality

BACKEND="http://127.0.0.1:8787"
TEST_USER="8acd050f-4dc3-4432-8a95-0057b816b46b"

echo "=============================================="
echo "AffiMark Alternative Agent Dataflow Test Suite"
echo "=============================================="
echo ""

# ---------------------------------------------------
# TEST 1: Profile Builder - Creator Context Gathering
# ---------------------------------------------------
echo "=== TEST 1: Profile Builder ==="
echo "Testing profile build for test user..."

PROFILE_RESULT=$(curl -s -X POST "$BACKEND/api/finder/profile/build" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$TEST_USER\",\"forceRefresh\":true}")

echo "$PROFILE_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
p = data.get('profile', {})
print(f'  Confidence: {p.get(\"confidenceScore\", 0)}%')
print(f'  Product Priorities: {len(p.get(\"productPriorities\", []))} (expected: 5)')
print(f'  Brand Priorities: {len(p.get(\"brandPriorities\", []))} (expected: 5)')
print(f'  Social Platforms: {len(p.get(\"socialContext\", {}).get(\"platforms\", []))} (expected: 4)')
print(f'  Preferred Networks: {p.get(\"storefrontContext\", {}).get(\"preferredNetworks\", [])}')
print(f'  Dominant Categories: {p.get(\"storefrontContext\", {}).get(\"dominantCategories\", [])}')
print(f'  Avg Price: {p.get(\"storefrontContext\", {}).get(\"avgPricePoint\", 0)}')
print(f'  Top Brands: {p.get(\"storefrontContext\", {}).get(\"topBrands\", [])}')

issues = []
if p.get('confidenceScore', 0) < 40:
    issues.append('CRITICAL: Low confidence score - user context not gathered')
if len(p.get('productPriorities', [])) == 0:
    issues.append('CRITICAL: No product priorities loaded')
if len(p.get('brandPriorities', [])) == 0:
    issues.append('CRITICAL: No brand priorities loaded')
if len(p.get('socialContext', {}).get('platforms', [])) == 0:
    issues.append('WARNING: No social platforms loaded')
if len(p.get('storefrontContext', {}).get('preferredNetworks', [])) == 0:
    issues.append('WARNING: No preferred networks loaded')

if issues:
    print()
    for i in issues:
        print(f'  ⚠ {i}')
else:
    print('  ✓ All profile data loaded correctly')
" 2>&1
echo ""

# ---------------------------------------------------
# TEST 2: MCP getCreatorProfile (used by search-v2)
# ---------------------------------------------------
echo "=== TEST 2: MCP Creator Profile (direct tool) ==="
echo "Testing getCreatorProfile via search-v2 agent..."

SEARCH_V2_RESULT=$(curl -s -X POST "$BACKEND/api/finder/search-v2" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$TEST_USER\",\"input\":\"https://orthomol-sport.de/products/orthomol-sport-perform\",\"inputType\":\"url\"}" \
  --max-time 120)

echo "$SEARCH_V2_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'  Status: {data.get(\"status\")}')
op = data.get('originalProduct', {})
print(f'  Original Product:')
print(f'    Title: {op.get(\"title\", \"?\")[:60]}')
print(f'    Brand: {op.get(\"brand\", \"?\")}')
print(f'    Category: {op.get(\"category\", \"?\")}')
print(f'    Price: {op.get(\"price\", \"?\")}')
print(f'    Confidence: {op.get(\"confidence\", 0)}%')
print(f'    Source: {op.get(\"source\", \"?\")}')
print(f'    Search Queries: {op.get(\"searchQueries\", [])}')

risk = data.get('originalProductRisk')
if risk:
    print(f'  Original Product Risk:')
    print(f'    Overall: {risk.get(\"overall\", \"?\")}')
    print(f'    Merchant Risk: {risk.get(\"merchantRisk\", \"?\")}')
    print(f'    Program Friction: {risk.get(\"programFriction\", \"?\")}')
    print(f'    Demand Evidence: {risk.get(\"demandEvidence\", \"?\")}')
    print(f'    Refund Risk: {risk.get(\"refundRisk\", \"?\")}')
else:
    print(f'  ⚠ No original product risk score')

alts = data.get('alternatives', [])
print(f'  Alternatives: {len(alts)}')
for i, alt in enumerate(alts[:3]):
    print(f'    [{i+1}] {alt.get(\"name\", \"?\")[:50]} | Brand: {alt.get(\"brand\", \"?\")} | \${alt.get(\"price\", 0)} | Score: {alt.get(\"matchScore\", alt.get(\"combinedScore\", 0))}')
    pkpis = alt.get('productPriorityKpis', alt.get('productKpis', []))
    if pkpis:
        for kpi in pkpis[:3]:
            print(f'      KPI: {kpi.get(\"id\",\"?\")} rank={kpi.get(\"rank\",\"?\")} score={kpi.get(\"score\",0)} conf={kpi.get(\"confidence\",\"?\")} | {kpi.get(\"reason\",\"\")[:60]}')
    bkpis = alt.get('brandPriorityKpis', alt.get('brandKpis', []))
    if bkpis:
        for kpi in bkpis[:3]:
            print(f'      BrandKPI: {kpi.get(\"id\",\"?\")} rank={kpi.get(\"rank\",\"?\")} score={kpi.get(\"score\",0)} conf={kpi.get(\"confidence\",\"?\")} | {kpi.get(\"reason\",\"\")[:60]}')

iters = data.get('searchIterations', [])
print(f'  Search Iterations: {len(iters)}')
for it in iters:
    print(f'    Strategy: {it.get(\"strategy\",\"?\")} | Query: \"{it.get(\"query\",\"?\")[:40]}\" | Candidates: {it.get(\"candidateCount\",0)} | Relevant: {it.get(\"relevantCount\",0)} | Top: {it.get(\"topScore\",0)}')

print(f'  Agent Reasoning: {data.get(\"agentReasoning\", \"\")[:200]}')
print(f'  Duration: {data.get(\"meta\", {}).get(\"duration\", 0)}ms')

# Flag issues
issues = []
if data.get('status') == 'product_unidentified':
    issues.append('CRITICAL: Product not identified')
if op.get('category') == 'General':
    issues.append('WARNING: Product category is General (should be more specific)')
if op.get('brand') == op.get('title'):
    issues.append('WARNING: Brand same as title (brand extraction failed)')
if len(alts) == 0 and data.get('status') != 'product_unidentified':
    issues.append('WARNING: No alternatives found')
if not risk:
    issues.append('WARNING: Original product risk not computed')

if issues:
    print()
    for i in issues:
        print(f'  ⚠ {i}')
" 2>&1
echo ""

# ---------------------------------------------------
# TEST 3: Portfolio Audit
# ---------------------------------------------------
echo "=== TEST 3: Portfolio Audit ==="
echo "Testing portfolio audit for test user..."

AUDIT_RESULT=$(curl -s -X POST "$BACKEND/api/portfolio/audit" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$TEST_USER\"}" \
  --max-time 60)

echo "$AUDIT_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
summary = data.get('portfolioSummary', {})
print(f'  Total Products: {summary.get(\"totalProducts\", 0)}')
print(f'  Analyzed: {summary.get(\"analyzed\", 0)}')
print(f'  High Risk: {summary.get(\"highRisk\", 0)}')
print(f'  Moderate Risk: {summary.get(\"moderateRisk\", 0)}')
print(f'  Stable: {summary.get(\"stable\", 0)}')
print(f'  Revenue Stability Index: {summary.get(\"revenueStabilityIndex\", 0)}')
print(f'  Top Merchant: {summary.get(\"merchantConcentration\", {}).get(\"topMerchant\", \"?\")}')

products = data.get('products', [])
for p in products[:5]:
    print(f'  Product: {p.get(\"title\", \"?\")[:40]} | Risk: {p.get(\"riskScore\", \"?\")} | Verdict: {p.get(\"verdict\", \"?\")}')

issues = []
if summary.get('totalProducts', 0) == 0:
    issues.append('CRITICAL: No products found for audit')
if summary.get('analyzed', 0) == 0 and summary.get('totalProducts', 0) > 0:
    issues.append('WARNING: Products found but none analyzed')

if issues:
    print()
    for i in issues:
        print(f'  ⚠ {i}')
" 2>&1
echo ""

# ---------------------------------------------------
# TEST 4: Product Identification (Orthomol specific)
# ---------------------------------------------------
echo "=== TEST 4: Product Identification - Orthomol Sport Perform ==="
echo "Testing identify_product for non-Amazon, non-English URL..."

IDENTIFY_RESULT=$(curl -s -X POST "$BACKEND/api/finder/intent/analyze" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://orthomol-sport.de/products/orthomol-sport-perform"}' \
  --max-time 30)

echo "$IDENTIFY_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
intent = data.get('intent', {})
print(f'  Category: {intent.get(\"category\", \"?\")}')
print(f'  Subcategory: {intent.get(\"subcategory\", \"?\")}')
print(f'  Brand: {intent.get(\"brand\", \"?\")}')
print(f'  Search Query: {intent.get(\"searchQuery\", \"?\")}')
print(f'  Keywords: {intent.get(\"keywords\", [])}')
print(f'  Confidence: {intent.get(\"confidence\", 0)}%')

issues = []
if intent.get('category') == 'General':
    issues.append('WARNING: Category not specific enough (should be Health/Nutrition/Sports)')
if intent.get('confidence', 0) < 50:
    issues.append('WARNING: Low identification confidence')
if 'sport' not in str(intent.get('searchQuery', '')).lower() and 'supplement' not in str(intent.get('searchQuery', '')).lower():
    issues.append('WARNING: Search query may not find relevant alternatives')

if issues:
    print()
    for i in issues:
        print(f'  ⚠ {i}')
" 2>&1
echo ""

echo "=============================================="
echo "Test Suite Complete"
echo "=============================================="
