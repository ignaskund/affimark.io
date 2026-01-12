import { cookies } from 'next/headers';
import { supabase } from './supabase-client';

export async function auth() {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('sb-access-token');
    
    if (!authCookie) {
      return null;
    }

    // Get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(authCookie.value);
    
    if (error || !user) {
      return null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split('@')[0],
      },
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

