/**
 * Onboarding Page
 * Redirects new users to Magic Onboarding for value-first experience.
 * Shows questionnaire only after initial import or via skip path.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [checkingStatus, setCheckingStatus] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      // Not logged in - redirect to sign-in
      router.push('/sign-in?callbackUrl=/onboarding');
      return;
    }

    if (status === 'authenticated' && session?.user) {
      checkOnboardingStatus();
    }
  }, [status, session]);

  const checkOnboardingStatus = async () => {
    try {
      const response = await fetch('/api/onboarding/preferences', {
        credentials: 'include',
        cache: 'no-store',
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
    } finally {
      setCheckingStatus(false);
    }
  };

  // Loading state
  if (status === 'loading' || checkingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Setting up your experience...</p>
        </div>
      </div>
    );
  }

  // Authenticated - show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

