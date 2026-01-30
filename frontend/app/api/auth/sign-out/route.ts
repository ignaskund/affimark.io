import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Clear Supabase auth cookies
    cookieStore.delete('sb-access-token');
    cookieStore.delete('sb-refresh-token');

    // Clear NextAuth session cookies
    cookieStore.delete('next-auth.session-token');
    cookieStore.delete('next-auth.callback-url');
    cookieStore.delete('next-auth.csrf-token');
    cookieStore.delete('__Secure-next-auth.session-token'); // For production with HTTPS
    cookieStore.delete('__Host-next-auth.csrf-token'); // For production with HTTPS

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sign out error:', error);
    return NextResponse.json({ error: 'Failed to sign out' }, { status: 500 });
  }
}

