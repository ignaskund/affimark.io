import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userEmail = (session.user as any).email;
    const userName = (session.user as any).name;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    // ============================================
    // Find correct user ID (NextAuth ID may differ from Supabase)
    // ============================================
    let effectiveUserId = userId;

    // First check if profile exists with NextAuth user ID
    const { data: existingProfile } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      console.log(`[Onboarding Complete] No profile for NextAuth ID ${userId}, looking up by email: ${userEmail}`);

      // Check if profile exists by email
      const { data: profileByEmail } = await supabaseServer
        .from('profiles')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (profileByEmail) {
        // Use existing profile's user ID
        effectiveUserId = profileByEmail.id;
        console.log(`[Onboarding Complete] Found profile by email with ID: ${effectiveUserId}`);
      } else {
        // No profile exists at all - this shouldn't happen if migration/apply ran first
        console.log(`[Onboarding Complete] No profile found for email ${userEmail}`);
        return NextResponse.json(
          { error: 'Profile not found. Please complete the import step first.' },
          { status: 400 }
        );
      }
    }

    // Update profile with onboarding complete
    const { error: updateError } = await supabaseServer
      .from('profiles')
      .update({
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', effectiveUserId);

    if (updateError) {
      console.error('[Onboarding Complete] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark onboarding complete', details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[Onboarding Complete] Profile ${effectiveUserId} updated with onboarding_completed=true`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Onboarding Complete] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
