# Claude Code Prompt — Fix Search Infrastructure Blockers

Copy the prompt below and paste it into Claude Code.

---

## The Prompt

```
Read AGENTS.md first for full architecture context.

You are fixing 8 infrastructure bugs that prevent the alternative search pipeline from working. These are confirmed bugs — do not skip any. Fix them in the order listed.

## Bug 1 (CRITICAL): profile-builder.ts uses D1 instead of Supabase

File: backend/src/services/profile-builder.ts
Function: getExistingProfile() at line ~116

Problem: Uses `env.DB.prepare(...)` which is Cloudflare D1 syntax. This project uses Supabase. The entire finder search crashes with "Cannot read properties of undefined (reading 'prepare')".

Fix: Rewrite getExistingProfile() to use Supabase REST API — same pattern as getUserPriorities() in the same file (line ~173). Use fetch() with `${supabaseUrl}/rest/v1/user_product_profiles?user_id=eq.${userId}` and the apikey/Authorization headers.

Verify: After fixing, run this and confirm no "prepare" error:
```bash
curl -s http://127.0.0.1:8787/api/finder/api/finder/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","input":"headphones","inputType":"category"}'
```

## Bug 2 (CRITICAL): finder-routes.ts has double-prefixed paths

File: backend/src/routes/finder-routes.ts

Problem: Routes are defined as `/api/finder/search`, `/api/finder/profile/build`, etc. But this file is mounted at `/api/finder` in api.ts (line 120: `api.route('/api/finder', finderRoutes)`). This creates double-prefixed paths like `/api/finder/api/finder/search`.

Fix: Change all route paths in finder-routes.ts to be relative:
- `/api/finder/search` → `/search`
- `/api/finder/profile/build` → `/profile/build`
- `/api/finder/profile/:userId` → `/profile/:userId`
- `/api/finder/intent/analyze` → `/intent/analyze`
- Any other `/api/finder/...` paths → strip the `/api/finder` prefix

Also update the frontend caller. In frontend/app/api/finder/search/route.ts at line ~76, the fetch URL is `${backendUrl}/api/finder/search` — this should remain as-is since it will now correctly resolve after the route fix.

Verify: After fixing:
```bash
curl -s http://127.0.0.1:8787/api/finder/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","input":"headphones","inputType":"category"}'
```
Should return JSON (not 404).

## Bug 3 (HIGH): searchViaDatafeedr returns 0 results for new users

File: backend/src/services/multi-network-search.ts
Function: searchViaDatafeedr() at line ~175

Problem: When avgPricePoint is 0 (new users with no storefront data), the price filter calculates priceMin=0 and priceMax=0, filtering out ALL products.

Fix: Add a guard at the top of the function:
```typescript
if (profile.storefrontContext.avgPricePoint <= 0) {
  // New user with no price history — don't apply price filters
  priceMin = undefined;
  priceMax = undefined;
}
```
Only apply the existing price range logic when avgPricePoint > 0.

## Bug 4 (HIGH): Verifier orchestrator doesn't pass user_context to loadAlternativeCandidates

File: backend/src/services/verifier/verifier-orchestrator.ts

Problem: The analyzeUrl function has `request.user_context` available (line ~39) but the call to `loadAlternativeCandidates` at line ~295 only passes `(brandSlug, category, region, supabase)` — never forwarding the user's min_commission_pct, min_cookie_days, or price_band filters.

Fix:
1. Update the call at line ~295 to pass user_context:
   ```typescript
   const candidates = await loadAlternativeCandidates(
     brandSlug,
     category,
     normalized.region || 'EU',
     supabase,
     request.user_context  // ADD THIS
   );
   ```
2. Update the loadAlternativeCandidates function signature to accept and use the user_context parameter. Apply the filters as `.gte()` / `.lte()` Supabase query modifiers when the values are provided.

## Bug 5 (MEDIUM): brand_recognition priority uses hardcoded 5-brand list

File: backend/src/services/multi-network-search.ts
Function: calculatePriorityScore(), case 'brand_recognition' at line ~320

Problem: Only Apple, Sony, Samsung, Nike, Adidas are treated as "known brands". Every other brand (Dyson, Bose, L'Oréal, Zara, etc.) gets a neutral 50.

Fix: Instead of a hardcoded list, use these signals:
- If the product has reviewCount > 500, it's likely a known brand → score 80
- If the product has reviewCount > 100, moderately known → score 70
- If the product brand appears in the user's storefrontContext.topBrands → score 85
- Fallback → 55

Remove the hardcoded knownBrands array entirely.

## Bug 6 (MEDIUM): storeUserProfile may create duplicate rows

File: backend/src/services/profile-builder.ts
Function: storeUserProfile() at line ~392

Problem: Uses Supabase REST with `Prefer: resolution=merge-duplicates` but this only works if there's a unique constraint on user_id. If the constraint is missing, duplicate rows accumulate.

Fix: Change the approach to check-then-upsert:
1. First try UPDATE where user_id matches
2. If no rows updated (count=0), then INSERT
Or simpler: use Supabase's `.upsert()` pattern via REST with `Prefer: return=representation,resolution=merge-duplicates` and ensure on_conflict is on user_id.

## Bug 7 (MEDIUM): Frontend falls back to fake mock data silently

File: frontend/app/api/finder/search/route.ts
Function: The catch blocks at lines ~103-109

Problem: When the backend search fails, the frontend silently returns hardcoded mock products (Sony WH-1000XM5, Bose QC45, Apple AirPods Max, etc.) as if they were real results. The user has no idea they're seeing fake data.

Fix:
1. Add an `isMockData: true` flag to the response when falling back to mocks
2. In the mock generator, prefix reasons with "[Demo] " so it's obvious
3. Log a clear warning: `console.warn('[Finder] FALLING BACK TO MOCK DATA — backend search failed')`

## Bug 8 (LOW): Verifier sessions table missing from Supabase

File: This is a database migration issue, not a code fix.

Problem: The verifier endpoint returns "Could not find the table 'public.verifier_sessions'" because the migration hasn't been run.

Fix: Check if COMPLETE_DATABASE_SETUP.sql or PRODUCT_FINDER_MIGRATION.sql contains the CREATE TABLE for verifier_sessions. If it does, note this in a comment at the top of verifier-orchestrator.ts:
```typescript
// REQUIRES: verifier_sessions and verifier_watchlist tables in Supabase
// Run COMPLETE_DATABASE_SETUP.sql if these tables are missing
```
If the table definition is NOT in any migration file, create the migration SQL based on the columns used in createSession() and updateSession() functions, and save it as VERIFIER_MIGRATION.sql in the repo root.

## Execution order

1. Fix Bug 2 first (route paths) — this unblocks testing everything else
2. Fix Bug 1 (D1→Supabase) — this unblocks the profile builder
3. Fix Bug 3 (price filter guard) — quick, 3 lines
4. Fix Bug 4 (pass user_context) — medium
5. Fix Bug 5 (brand_recognition) — medium
6. Fix Bug 6 (upsert) — medium
7. Fix Bug 7 (mock data flag) — quick
8. Fix Bug 8 (migration check) — documentation

## Final verification

After all fixes, restart the backend and run:

```bash
# 1. Route fix verification (should not 404)
curl -s http://127.0.0.1:8787/api/finder/search -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test","input":"wireless headphones","inputType":"category"}' | head -5

# 2. Profile builder doesn't crash
curl -s http://127.0.0.1:8787/api/finder/profile/build -X POST \
  -H "Content-Type: application/json" \
  -d '{"userId":"test"}' | head -5

# 3. TypeScript check (no NEW errors)
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
# Should be same count as before (pre-existing errors only)
```

Do NOT modify any files outside the ones listed above. Do NOT refactor unrelated code.
```

---

## How to use this prompt

1. **Make sure your 8 scoring fixes are committed and pushed first.** This prompt builds on top of those.
2. **Paste the entire prompt at once.** The numbered structure and execution order prevent the agent from jumping around.
3. **Each bug has a verify step.** If the agent skips verification, say: "Run the verify command for Bug N before proceeding."
4. **If context fills up** mid-way, use `/clear` and paste: "Continue from Bug N. Bugs 1 through N-1 are already fixed. Read AGENTS.md for context, then fix Bug N."
5. **After completion**, review the diff. The changes should touch exactly these files:
   - `backend/src/services/profile-builder.ts` (bugs 1, 6)
   - `backend/src/routes/finder-routes.ts` (bug 2)
   - `backend/src/services/multi-network-search.ts` (bugs 3, 5)
   - `backend/src/services/verifier/verifier-orchestrator.ts` (bug 4)
   - `frontend/app/api/finder/search/route.ts` (bug 7)
   - Possibly a new `VERIFIER_MIGRATION.sql` (bug 8)
