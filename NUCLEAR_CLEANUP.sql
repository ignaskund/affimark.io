-- ============================================================
-- AFFIMARK NUCLEAR CLEANUP - DROP EVERYTHING & START FRESH
-- ============================================================
-- WARNING: This will DELETE ALL data in public schema tables!
-- Make sure you have backups if needed.
--
-- Run this ENTIRE script in one go in Supabase SQL Editor
-- ============================================================

-- STEP 1: Drop ALL triggers first (to avoid dependency issues)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
    ) LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.trigger_name) || ' ON public.' || quote_ident(r.event_object_table) || ' CASCADE';
    END LOOP;
    RAISE NOTICE 'All triggers dropped';
END $$;

-- STEP 2: Drop ALL functions in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
    END LOOP;
    RAISE NOTICE 'All functions dropped';
END $$;

-- STEP 3: Drop ALL tables in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Disable triggers temporarily
    SET session_replication_role = 'replica';

    FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped table: %', r.tablename;
    END LOOP;

    -- Re-enable triggers
    SET session_replication_role = 'origin';

    RAISE NOTICE 'All tables dropped';
END $$;

-- STEP 4: Drop ALL views in public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT viewname
        FROM pg_views
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
    END LOOP;
    RAISE NOTICE 'All views dropped';
END $$;

-- STEP 5: Drop ALL types in public schema (if any custom types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT typname
        FROM pg_type t
        JOIN pg_namespace n ON t.typnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.typtype = 'e'  -- enum types
    ) LOOP
        EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
    RAISE NOTICE 'All custom types dropped';
END $$;

-- STEP 6: Verify cleanup
DO $$
DECLARE
    table_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM pg_tables
    WHERE schemaname = 'public';

    IF table_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '============================================================';
        RAISE NOTICE 'CLEANUP COMPLETE - Public schema is now empty';
        RAISE NOTICE '============================================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Next step: Run CLEAN_SCHEMA.sql to create the 9 essential tables';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE 'WARNING: % tables still remain', table_count;
    END IF;
END $$;

-- Show what's left (should be empty)
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
