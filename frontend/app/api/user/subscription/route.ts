import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Get user's current subscription details
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_type, subscription_status, subscription_period_end, stripe_customer_id')
      .eq('id', user.id)
      .single();

    return NextResponse.json({
      plan_type: profile?.plan_type || 'FREE',
      subscription_status: profile?.subscription_status,
      subscription_period_end: profile?.subscription_period_end,
      has_payment_method: !!profile?.stripe_customer_id,
    });
  } catch (error: any) {
    console.error('[Subscription] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

