/**
 * Supabase Client for Browser
 * Creates a Supabase client for use in Client Components
 */

import { createBrowserClient as createClient } from '@supabase/ssr';

export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const createClient = createBrowserClient;
