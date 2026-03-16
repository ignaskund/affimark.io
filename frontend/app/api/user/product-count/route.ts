/**
 * GET /api/user/product-count
 *
 * Returns the number of products in user_storefront_products that have all
 * three core data fields: brand, category, and current_price. Used by the
 * onboarding quality gate (U12) to warn before proceeding with low data.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Total product count
    const { count: total } = await supabaseServer
      .from('user_storefront_products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    // Products with all three core fields populated
    const { count: enriched } = await supabaseServer
      .from('user_storefront_products')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('brand', 'is', null)
      .not('category', 'is', null)
      .not('current_price', 'is', null);

    return NextResponse.json({
      total: total ?? 0,
      enriched: enriched ?? 0,
    });
  } catch (error: any) {
    console.error('[product-count] Error:', error);
    return NextResponse.json({ total: 0, enriched: 0 });
  }
}
