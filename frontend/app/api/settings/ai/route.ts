import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createClient } from '@/utils/supabase/server';

const supabaseServer = createClient();

/**
 * GET /api/settings/ai
 * Retrieve user's AI personalization settings
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch user personalization
    const { data, error } = await supabaseServer
      .from('user_personalization')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      // If no personalization exists, create default
      const { data: newData, error: insertError } = await supabaseServer
        .from('user_personalization')
        .insert({
          user_id: session.user.id,
          ai_intensity: 'light',
          ai_calls_limit: 100,
          ai_calls_this_month: 0,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[AI Settings] Failed to create personalization:', insertError);
        return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
      }

      return NextResponse.json({
        ai_intensity: newData.ai_intensity,
        ai_calls_this_month: newData.ai_calls_this_month,
        ai_calls_limit: newData.ai_calls_limit,
        analysis_count: newData.analysis_count,
        experience_level: getExperienceLevel(newData.analysis_count),
      });
    }

    return NextResponse.json({
      ai_intensity: data.ai_intensity,
      ai_calls_this_month: data.ai_calls_this_month,
      ai_calls_limit: data.ai_calls_limit,
      analysis_count: data.analysis_count,
      experience_level: getExperienceLevel(data.analysis_count),
      primary_niches: data.primary_niches || [],
      total_savings_found: data.total_savings_found || 0,
    });
  } catch (error) {
    console.error('[AI Settings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/settings/ai
 * Update user's AI personalization settings
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ai_intensity } = body;

    // Validate ai_intensity
    if (ai_intensity && !['off', 'light', 'full'].includes(ai_intensity)) {
      return NextResponse.json(
        { error: 'Invalid ai_intensity. Must be "off", "light", or "full"' },
        { status: 400 }
      );
    }

    // Update personalization
    const { data, error } = await supabaseServer
      .from('user_personalization')
      .update({
        ai_intensity,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      console.error('[AI Settings] Update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ai_intensity: data.ai_intensity,
      ai_calls_this_month: data.ai_calls_this_month,
      ai_calls_limit: data.ai_calls_limit,
    });
  } catch (error) {
    console.error('[AI Settings] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Helper: Get user experience level based on analysis count
 */
function getExperienceLevel(analysisCount: number): 'new' | 'intermediate' | 'advanced' {
  if (analysisCount < 5) return 'new';
  if (analysisCount < 50) return 'intermediate';
  return 'advanced';
}
