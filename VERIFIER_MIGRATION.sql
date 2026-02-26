-- VERIFIER_MIGRATION.sql
-- Creates the two tables required by the Product Verifier pipeline.
-- Run this against your Supabase project if the verifier endpoint returns
-- "Could not find the table 'public.verifier_sessions'".
--
-- Prerequisites: auth.users must exist (standard Supabase setup).
-- This migration is idempotent — safe to run multiple times.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. verifier_sessions
--    Stores the full state of one product-analysis run.
--    Created by analyzeUrl(), updated incrementally as each phase completes.
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verifier_sessions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input
  url                    TEXT NOT NULL,
  normalized_url         TEXT,
  merchant               TEXT,
  platform               TEXT,
  region                 TEXT,
  user_context           JSONB DEFAULT '{}',

  -- Pipeline status
  status                 TEXT NOT NULL DEFAULT 'analyzing',
  -- Allowed values: analyzing | recommendations_ready | playbook_ready | completed | failed

  -- Scores (populated after scoring-engine runs)
  product_viability_score  NUMERIC(5,2),
  offer_merchant_score     NUMERIC(5,2),
  economics_score          NUMERIC(5,2),
  score_breakdowns         JSONB,

  -- Verdict + insights
  confidence             TEXT,          -- LOW | MED | HIGH
  verdict                TEXT,          -- GREEN | YELLOW | RED | TEST_FIRST
  primary_action         TEXT,
  hard_stop_flags        JSONB DEFAULT '[]',
  top_pros               JSONB DEFAULT '[]',
  top_risks              JSONB DEFAULT '[]',
  key_assumptions        JSONB DEFAULT '[]',
  evidence_summary       JSONB,

  -- Full scraped product data
  product_data           JSONB,

  -- Economics / commission details
  economics_details      JSONB,

  -- Coverage (data quality assessment)
  coverage               JSONB,

  -- Alternative ranking
  routing                JSONB,
  rank_mode              TEXT,          -- balanced | demand_first | trust_first | economics_first
  ranked_alternatives    JSONB DEFAULT '[]',
  alternatives           JSONB DEFAULT '[]',
  winner                 JSONB,
  buckets                JSONB DEFAULT '[]',

  -- Playbook phase
  selected_alternative_id  UUID,
  approved_item            JSONB,
  playbook                 JSONB,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS verifier_sessions_user_id_idx
  ON public.verifier_sessions (user_id, created_at DESC);

-- Row-level security: users can only see their own sessions
ALTER TABLE public.verifier_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own verifier sessions" ON public.verifier_sessions;
CREATE POLICY "Users can manage their own verifier sessions"
  ON public.verifier_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role can read/write all sessions (used by backend Workers)
DROP POLICY IF EXISTS "Service role full access to verifier_sessions" ON public.verifier_sessions;
CREATE POLICY "Service role full access to verifier_sessions"
  ON public.verifier_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. verifier_watchlist
--    A user's saved products for periodic re-analysis.
--    Created by addToWatchlist(), read by watchlist-monitor.ts (cron).
-- ──────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.verifier_watchlist (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id       UUID REFERENCES public.verifier_sessions(id) ON DELETE SET NULL,

  url              TEXT NOT NULL,
  normalized_url   TEXT,
  product_name     TEXT,
  brand            TEXT,
  merchant         TEXT,
  category         TEXT,

  -- Snapshot of scores at the time the item was added
  last_snapshot    JSONB,

  -- Monitoring schedule
  check_interval_hours  INTEGER NOT NULL DEFAULT 24,
  last_checked_at       TIMESTAMPTZ,
  next_check_at         TIMESTAMPTZ,

  is_active        BOOLEAN NOT NULL DEFAULT TRUE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cron job: find items due for a check
CREATE INDEX IF NOT EXISTS verifier_watchlist_next_check_idx
  ON public.verifier_watchlist (next_check_at ASC)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS verifier_watchlist_user_id_idx
  ON public.verifier_watchlist (user_id, created_at DESC);

ALTER TABLE public.verifier_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own watchlist" ON public.verifier_watchlist;
CREATE POLICY "Users can manage their own watchlist"
  ON public.verifier_watchlist
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access to verifier_watchlist" ON public.verifier_watchlist;
CREATE POLICY "Service role full access to verifier_watchlist"
  ON public.verifier_watchlist
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
