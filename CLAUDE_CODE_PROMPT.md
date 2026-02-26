# Claude Code Prompt — Fix Search Result Pipeline

Copy the prompt below and paste it into Claude Code.

---

## The Prompt

```
Read AGENTS.md first for architecture context.

## Problem

The alternative search returns 0 results for any user who completed onboarding. Users without a profile get results. This is caused by two hard filters that are too aggressive: network source filtering and price band filtering.

I verified this by testing:
- User with NO profile → "moisturizer" returns 5 results (Belboon, Impact US networks)
- User WITH profile (preferredNetworks: ["amazon_de", "awin", "ltk"]) → "moisturizer" returns 0 results

Root cause: the search passes `source_names: ["amazon", "awin"]` to Datafeedr as a HARD FILTER, but real Datafeedr source names are "Belboon Netherlands", "Impact US", "Awin Global", etc. The simple substring match misses most networks.

## Fix 1 (CRITICAL): Make network filtering a soft scoring signal, not a hard filter

File: `backend/src/services/multi-network-search.ts`
Function: `searchViaDatafeedr()` around line 710-726

Current code:
```typescript
const sourceNames = resolveSourceNames(profile.storefrontContext.preferredNetworks);
// ...
const response = await searchDatafeedr({
  query: primaryQuery,
  source_names: sourceNames.length > 0 ? sourceNames : undefined,  // ← THIS KILLS RESULTS
  price_min: priceMin,
  price_max: priceMax,
  // ...
});
```

Fix: REMOVE `source_names` from the Datafeedr query entirely. Network preference is already handled as a scoring signal in `calculateProfileMatchScore` (the C4 "Network affinity" component, weight 2, scores 95 for preferred networks vs 40 for others). That's the correct place — it boosts preferred networks without excluding others.

```typescript
const response = await searchDatafeedr({
  query: primaryQuery,
  // source_names removed — network preference is handled in scoring, not filtering
  price_min: priceMin,
  price_max: priceMax,
  // ...
});
```

Do the same for ALL `searchDatafeedr` calls in this function (primary search AND fallback search around line 733-744). Remove `source_names` from both.

Keep the `resolveSourceNames` import and the `injectPriorityNetworkPreferences` function — they're still useful for the scoring path. Just don't use them for hard-filtering the Datafeedr query.

## Fix 2 (HIGH): Widen price band from ±30% to ±100%

File: `backend/src/services/multi-network-search.ts`
Function: `searchViaDatafeedr()` around line 620-631

Current code:
```typescript
if (intent.priceRange === 'budget') {
  priceMax = avgPrice * 0.7;
} else if (intent.priceRange === 'premium') {
  priceMin = avgPrice * 1.3;
} else {
  // Mid-range: ±30% of user's average
  priceMin = avgPrice * 0.7;
  priceMax = avgPrice * 1.3;
}
```

Problem: ±30% of €45 = €31.50-€58.50. This is too narrow — a €60 serum or €25 moisturizer gets excluded. The price fit scoring in `calculateProfileMatchScore` (C3 component) already penalizes products far from the user's avg price, so the hard filter just needs to prevent extreme outliers.

Fix: Change to ±100% for mid-range, and proportional for budget/premium:
```typescript
if (intent.priceRange === 'budget') {
  priceMax = avgPrice * 1.0;  // Up to the user's average (not above)
} else if (intent.priceRange === 'premium') {
  priceMin = avgPrice * 0.5;  // At least half the user's average
} else {
  // Mid-range: broad band, let scoring handle precision
  priceMin = avgPrice * 0.2;  // Don't show €5 products for a €45 avg user
  priceMax = avgPrice * 3.0;  // Don't show €500 products for a €45 avg user
}
```

## Fix 3 (HIGH): Datafeedr price units mismatch

File: `backend/src/services/multi-network-search.ts`
Function: `searchViaDatafeedr()` — the price values passed to `searchDatafeedr()`

Also check: `backend/src/services/datafeedr-client.ts` function `buildQueryArray()` around line 126-131

Problem: The comment in datafeedr-client.ts says "Datafeedr typically returns amount in minor units (e.g. 1800 -> 18.00)" and `normalizeAmountFromDatafeedr` divides by 100. But the query builder creates `finalprice >= ${params.price_min}` using major units (EUR). If Datafeedr stores prices in CENTS, then `finalprice <= 58.5` means ≤€0.585, filtering out everything.

Investigate:
1. Read the `searchDatafeedr` function and check how it sends the query
2. Check if `finalprice` in the Datafeedr API is in cents or euros
3. If cents: multiply `price_min` and `price_max` by 100 before passing to `searchDatafeedr`
4. If euros: no change needed, but verify with a test

To verify: Add a `console.log` in `buildQueryArray` showing the exact query array being sent. Then run a search and check the logs. If the prices look correct (3150 for €31.50) no fix needed. If they look wrong (31.5 for €31.50 when Datafeedr expects cents), multiply by 100.

## Fix 4 (MEDIUM): Add "ltk" to STOREFRONT_TO_SOURCE_NAME

File: `backend/src/services/datafeedr-client.ts`
Object: `STOREFRONT_TO_SOURCE_NAME` around line 269

Problem: "ltk" is missing from the mapping. If network filtering is ever re-enabled (or used for scoring), LTK storefronts won't resolve.

Fix: Add these entries:
```typescript
ltk: 'rewardstyle',       // LTK's network name in Datafeedr
shopmy: 'shopmy',         // ShopMy if available
```

If you're unsure of the exact Datafeedr source name for LTK, leave it as `'ltk'` — it's better than missing entirely.

## Verification

After all fixes, restart the backend and run these tests:

```bash
# Test 1: Profiled user should now get results (was 0 before)
curl -s http://127.0.0.1:8787/api/finder/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"780e4e3b-a6f2-4039-a2a3-0cade0ee63ba","input":"moisturizer","inputType":"category","activeContext":{"socials":[],"storefronts":[]}}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Alts: {len(d.get(\"alternatives\",[]))} | Match scores: {[a.get(\"matchScore\") for a in d.get(\"alternatives\",[])[:5]]}')"

# Expected: Alts > 0, match scores should vary (not all 50)

# Test 2: Beauty products should score higher than electronics for this beauty creator
curl -s http://127.0.0.1:8787/api/finder/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"780e4e3b-a6f2-4039-a2a3-0cade0ee63ba","input":"wireless headphones","inputType":"category","activeContext":{"socials":[],"storefronts":[]}}' | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'Alts: {len(d.get(\"alternatives\",[]))} | Match scores: {[a.get(\"matchScore\") for a in d.get(\"alternatives\",[])[:5]]}')"

# Expected: Alts > 0, match scores should be LOWER than test 1 (electronics ≠ beauty niche)

# Test 3: TypeScript check
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
# Should be same count as before (pre-existing errors only)
```

Do NOT modify scoring logic, priority weights, or any other files. Only touch the two files listed above.
```

---

## How to use

1. Paste the entire prompt into Claude Code
2. The agent will make 4 changes across 2 files
3. After it's done, restart the backend: kill the wrangler process and run `cd backend && npx wrangler dev --port 8787 --local --show-interactive-dev-session false`
4. Run the 3 verification commands — test 1 should show results with varying match scores
5. Push the changes and let me know — I'll re-run the full 8-URL test battery with the seeded profile
