import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    // First check if profile exists
    const { data: existingProfile } = await supabaseServer
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingProfile) {
      // Create profile if it doesn't exist
      console.log(`[Onboarding Complete] Profile doesn't exist, creating for user ${userId}`);
      const userEmail = (session.user as any).email;
      const userName = (session.user as any).name;

      const { error: insertError } = await supabaseServer
        .from('profiles')
        .insert({
          id: userId,
          email: userEmail,
          full_name: userName || userEmail?.split('@')[0] || 'User',
          user_type: 'creator',
          onboarding_completed: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[Onboarding Complete] Insert error:', insertError);
        return NextResponse.json(
          { error: 'Failed to create profile', details: insertError.message },
          { status: 500 }
        );
      }

      console.log(`[Onboarding Complete] Profile created with onboarding_completed=true`);
    } else {
      // Update existing profile
      const { error: updateError } = await supabaseServer
        .from('profiles')
        .update({
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateError) {
        console.error('[Onboarding Complete] Update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark onboarding complete', details: updateError.message },
          { status: 500 }
        );
      }

      console.log(`[Onboarding Complete] Profile updated with onboarding_completed=true`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Onboarding Complete] Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
