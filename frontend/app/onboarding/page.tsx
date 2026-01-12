/**
 * Onboarding Page
 * Redirects new users to Magic Onboarding for value-first experience.
 * Shows questionnaire only after initial import or via skip path.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase-client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export default function OnboardingPage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (data.session) {
        setAuthStatus('authenticated');
        await checkOnboardingStatus(data.session);
      } else {
        setAuthStatus('unauthenticated');
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      if (newSession) {
        setAuthStatus('authenticated');
        checkOnboardingStatus(newSession);
      } else {
        setAuthStatus('unauthenticated');
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const checkOnboardingStatus = async (session: Session) => {
    try {
      const token = session.access_token;
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const response = await fetch('/api/onboarding/preferences', {
        credentials: 'include',
        cache: 'no-store',
        headers,
      });

      if (response.ok) {
        const profile = await response.json();

        if (profile?.onboarding_completed) {
          // Already completed - go to dashboard
          router.replace('/dashboard');
          return;
        }
      }

      // New user - redirect to Magic Onboarding (value-first)
      router.replace('/onboarding/magic');
    } catch (error) {
      console.error('[Onboarding] Failed to check status', error);
      // On error, still try Magic Onboarding
      router.replace('/onboarding/magic');
    }
  };

  // Loading state
  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated - redirect to sign in
  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-3xl font-bold text-foreground mb-4">Sign in to continue</h1>
        <p className="text-muted-foreground mb-6 max-w-md">
          You need an AffiMark account to complete onboarding.
        </p>
        <button
          onClick={() => router.push('/sign-in?callbackUrl=/onboarding')}
          className="btn-primary"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // Authenticated - show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Setting up your experience...</p>
      </div>
    </div>
  );
}
