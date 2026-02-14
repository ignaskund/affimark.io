/**
 * User Preferences API
 * Handles fetching and updating user preferences for personalization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseServer } from '@/lib/supabase-server';

// Lightweight auth helper: trust Supabase access token from Authorization header
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const prefix = 'bearer ';
  const token = authHeader.toLowerCase().startsWith(prefix)
    ? authHeader.slice(prefix.length)
    : null;

  if (!token) return null;

  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// GET /api/onboarding/preferences - Get user profile with tech fields
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const supabase = supabaseServer;

    // Fetch profile with tech-specific fields
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        user_type,
        full_name,
        email,
        avatar_url,
        bio,
        website,
        location,
        onboarding_completed,
        tech_skills,
        tech_domains,
        content_formats,
        min_rate,
        preferred_comp_types,
        product_type,
        target_personas,
        brand_tech_stack,
        typical_budget_range,
        primary_platforms,
        target_regions,
        languages,
        website_url,
        website_analysis,
        website_analyzed_at,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Preferences] Fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    // Return empty object if no profile (will be created on POST)
    if (!profile) {
      return NextResponse.json({});
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[Preferences] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/onboarding/preferences - Update user preferences
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();

    const supabase = supabaseServer;

    // Validate and sanitize input
    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    // Content preferences
    if (body.content_niches !== undefined) {
      updates.content_niches = Array.isArray(body.content_niches) ? body.content_niches : [];
    }
    if (body.content_language) {
      updates.content_language = body.content_language;
    }
    if (body.content_frequency) {
      updates.content_frequency = body.content_frequency;
    }

    // Partnership preferences
    if (body.preferred_partnership_types !== undefined) {
      updates.preferred_partnership_types = Array.isArray(body.preferred_partnership_types)
        ? body.preferred_partnership_types
        : [];
    }
    if (body.min_partnership_budget !== undefined) {
      updates.min_partnership_budget = parseFloat(body.min_partnership_budget) || null;
    }
    if (body.max_partnership_budget !== undefined) {
      updates.max_partnership_budget = parseFloat(body.max_partnership_budget) || null;
    }
    if (body.willing_to_travel !== undefined) {
      updates.willing_to_travel = Boolean(body.willing_to_travel);
    }
    if (body.preferred_brands !== undefined) {
      updates.preferred_brands = Array.isArray(body.preferred_brands) ? body.preferred_brands : [];
    }
    if (body.blacklisted_brands !== undefined) {
      updates.blacklisted_brands = Array.isArray(body.blacklisted_brands)
        ? body.blacklisted_brands
        : [];
    }

    // Communication preferences
    if (body.email_notifications !== undefined) {
      updates.email_notifications = Boolean(body.email_notifications);
    }
    if (body.partnership_alerts !== undefined) {
      updates.partnership_alerts = Boolean(body.partnership_alerts);
    }
    if (body.weekly_insights !== undefined) {
      updates.weekly_insights = Boolean(body.weekly_insights);
    }
    if (body.marketing_emails !== undefined) {
      updates.marketing_emails = Boolean(body.marketing_emails);
    }

    // Payment preferences
    if (body.preferred_payment_method) {
      updates.preferred_payment_method = body.preferred_payment_method;
    }
    if (body.payment_email) {
      updates.payment_email = body.payment_email;
    }
    if (body.payment_info) {
      updates.payment_info = body.payment_info;
    }

    // Audience goals
    if (body.target_audience_size !== undefined) {
      updates.target_audience_size = parseInt(body.target_audience_size) || null;
    }
    if (body.growth_goals !== undefined) {
      updates.growth_goals = Array.isArray(body.growth_goals) ? body.growth_goals : [];
    }

    // Update preferences
    const { data: updatedPreferences, error } = await supabase
      .from('user_preferences')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[Preferences] Update error:', error);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    // Update onboarding progress if preferences were set for the first time
    if (body.markStepComplete) {
      await supabase
        .from('onboarding_progress')
        .update({
          step_5_preferences_set: true,
          step_5_completed_at: new Date().toISOString(),
          current_step: 6,
          last_activity_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    }

    return NextResponse.json(updatedPreferences);
  } catch (error) {
    console.error('[Preferences] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/onboarding/preferences - Save tech-aware profile data
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    const body = await request.json();

    // Prefer trusted backend auth; fall back to explicit user_id from body
    const userId: string | undefined = (user?.id || body.user_id) ?? undefined;
    const userEmail: string | undefined = (user?.email || body.user_email) ?? undefined;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    console.log('[Preferences] POST body:', JSON.stringify(body, null, 2));

    const supabase = supabaseServer;

    // Build profile update data with tech-specific fields
    const profileData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // User type
    if (body.user_type !== undefined) profileData.user_type = body.user_type;

    // Creator-specific tech fields
    if (body.tech_skills !== undefined) profileData.tech_skills = body.tech_skills;
    if (body.tech_domains !== undefined) profileData.tech_domains = body.tech_domains;
    if (body.content_formats !== undefined) profileData.content_formats = body.content_formats;
    if (body.min_rate !== undefined) profileData.min_rate = body.min_rate;
    if (body.preferred_comp_types !== undefined) profileData.preferred_comp_types = body.preferred_comp_types;

    // Brand-specific tech fields
    if (body.product_type !== undefined) profileData.product_type = body.product_type;
    if (body.target_personas !== undefined) profileData.target_personas = body.target_personas;
    if (body.brand_tech_stack !== undefined) profileData.brand_tech_stack = body.brand_tech_stack;
    if (body.typical_budget_range !== undefined) profileData.typical_budget_range = body.typical_budget_range;

    // Website analysis (brands/startups)
    if (body.website_url !== undefined) profileData.website_url = body.website_url;
    if (body.website_analysis !== undefined) {
      profileData.website_analysis = body.website_analysis;
      profileData.website_analyzed_at = new Date().toISOString();
    }

    // Shared fields
    if (body.primary_platforms !== undefined) profileData.primary_platforms = body.primary_platforms;
    if (body.target_regions !== undefined) profileData.target_regions = body.target_regions;
    if (body.languages !== undefined) profileData.languages = body.languages;

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    let result: any;
    let error: any;

    if (existingProfile) {
      // Update existing profile
      const updateResult = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', userId)
        .select()
        .single();

      result = updateResult.data;
      error = updateResult.error;
    } else {
      // Create new profile with required fields
      const insertResult = await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: userEmail?.split('@')[0] || 'User',
          user_type: body.user_type || 'creator',
          onboarding_completed: false,
          ...profileData,
        })
        .select()
        .single();

      result = insertResult.data;
      error = insertResult.error;
    }

    if (error) {
      console.error('[Preferences] Save error:', error);
      console.error('[Preferences] Data attempted:', JSON.stringify(profileData, null, 2));
      return NextResponse.json(
        { error: 'Failed to save profile data', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Preferences] Successfully saved profile:', result);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Preferences] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

