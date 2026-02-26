# Claude Code Prompt — Alternative Search Quality

Copy the prompt below and paste it into Claude Code.

---

## The Prompt

```
Read AGENTS.md at the repo root first — it documents the full onboarding→search data pipeline and quality principles.

## Goal

Improve alternative product search quality so that when a user inserts a product URL, the returned alternatives are accurate, personalized, and actionable. The search must deeply leverage ALL data collected during onboarding (Linktree scan + priority ranking).

## Context

The onboarding flow captures:
1. Linktree/bio-link URL → scraped into storefronts, products, socials (gives us: dominant categories, top brands, avg price point, preferred networks)
2. Ranked product priorities (quality, price, reviews, sustainability, design, shipping, warranty, brand_recognition)
3. Ranked brand priorities (commission, customer_service, return_policy, reputation, sustainability, payment_speed, cookie_duration, easy_approval)

This data flows into profile-builder.ts → UserProfile, which is used by the search in multi-network-search.ts and verifier-orchestrator.ts. The problem is that the search doesn't leverage all this context deeply enough.

## Phase 1: Explore (do this first, don't write code yet)

1. Read these files and understand the current scoring logic:
   - backend/src/services/profile-builder.ts (how profile is built from onboarding)
   - backend/src/services/multi-network-search.ts (how match score is calculated, the calculateProfileMatchScore and calculatePriorityScore functions)
   - backend/src/services/product-intent-analyzer.ts (how product intent is extracted from URL)
   - backend/src/services/outcome-feasibility-scorer.ts (business viability gate)
   - backend/src/services/verifier/alternatives-ranker.ts (how verifier ranks alternatives)
   - backend/src/services/verifier/verifier-orchestrator.ts (loadAlternativeCandidates function)
   - frontend/types/finder.ts (AlternativeProduct, PriorityAlignment types)

2. Identify the gaps — where is onboarding data NOT being used or underused? Specifically check:
   - Does calculatePriorityScore handle ALL 8 product priorities and ALL 8 brand priorities?
   - Does the Datafeedr search query incorporate the user's storefront context (dominant categories, brands)?
   - Does the verifier's loadAlternativeCandidates use any user context at all?
   - Is the brand priority ranking (commission, cookie_duration, etc.) actually influencing which programs surface?
   - Does price band targeting use the user's actual avg price from their storefront products?

3. Report your findings before writing any code. List each gap with the file and line number.

## Phase 2: Plan

Based on your findings, propose specific changes. The changes should address these quality dimensions:

1. **Product match accuracy** — the alternative must be the same type of item (not just same category)
2. **Priority-weighted scoring** — all 8 product priorities and all 8 brand priorities must have real scoring implementations (not just stubs returning 50-60)
3. **Storefront context integration** — search queries and scoring should use dominant categories, top brands, avg price point, preferred networks from the user's actual storefronts
4. **Brand priority impact** — if user ranked "commission" #1, high-commission programs must rank higher; if "cookie_duration" #1, long-cookie programs must rank higher
5. **Audience-aware filtering** — if we know audience demographics from social context, prefer products available in those regions/languages

Present the plan as a numbered list of changes with file paths. Don't implement yet.

## Phase 3: Implement

After we agree on the plan, implement the changes. For each change:
- Keep scoring deterministic (no AI calls in hot scoring path)
- Maintain backward compatibility — don't break the existing API contracts
- Add JSDoc comments explaining the scoring formula for each priority

## Verification

After implementation, verify by:
1. Run `cd backend && npx tsc --noEmit` — no NEW type errors (pre-existing ones are ok)
2. Trace through the code manually with this test case:
   - User has storefront on Amazon DE with avg price €80, dominant category "Beauty"
   - Product priorities: 1=quality, 2=reviews, 3=price, 4=sustainability, 5=shipping
   - Brand priorities: 1=commission, 2=return_policy, 3=reputation, 4=cookie_duration, 5=easy_approval
   - Inserted product: https://www.amazon.de/dp/B0EXAMPLE (a skincare product, €45)
   - Expected: alternatives should be beauty/skincare products, €35-105 range, highest-rated first, from high-commission programs with good return policies
3. Log the scoring breakdown for 3 sample products to verify priorities are respected
```

---

## Tips for using this prompt

- **Paste the whole thing at once** into Claude Code. The phased structure (Explore → Plan → Implement) prevents it from jumping to code before understanding the problem.
- **Phase 1 will end with a report**. Review the gaps it found. If it misses something, point it out.
- **Phase 2 will end with a plan**. Say "yes, implement" or adjust the plan before Phase 3.
- **If context gets long**, use `/clear` and re-paste with: "Continue from Phase 3. The plan we agreed on was: [paste the plan]. Implement it now."
- **AGENTS.md and CLAUDE.md are auto-loaded** — the agent will read them and understand the architecture without you needing to explain it.
