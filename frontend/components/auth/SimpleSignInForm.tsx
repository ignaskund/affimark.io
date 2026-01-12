/**
 * Simple Sign In Form - Email/Password Only
 * BYPASSES OAUTH ISSUES - Gets you working NOW
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

interface SimpleSignInFormProps {
  callbackUrl?: string;
}

export default function SimpleSignInForm({ callbackUrl }: SimpleSignInFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('Supabase sign-in error:', signInError);
        setError('Invalid email or password');
        setLoading(false);
        return;
      }

      // Check onboarding status to decide where to go next
      try {
        const profileRes = await fetch('/api/onboarding/preferences', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();

          if (!profile?.onboarding_completed || !profile?.user_type) {
            router.push('/onboarding');
            return;
          }

          const destination =
            profile.user_type === 'brand' ||
            profile.user_type === 'startup' ||
            profile.user_type === 'agency'
              ? '/dashboard/brand'
              : '/chat';
          router.push(destination);
          return;
        }
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
      }

      router.push(callbackUrl || '/dashboard');
    } catch (error) {
      console.error('Sign in error:', error);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Affimark</h1>
        <p className="text-gray-400">Sign in to continue to your dashboard</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email address
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5 mr-2" />
              Sign In
            </>
          )}
        </Button>
      </form>

      {/* Test Credentials */}
      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-400 font-medium mb-2">🔑 Dev Test Account:</p>
        <p className="text-xs text-blue-300 font-mono">dev@affimark.com</p>
        <p className="text-xs text-blue-300 font-mono">DevPassword123!</p>
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-400">
          Don't have an account?{' '}
          <Link
            href="/sign-up"
            className="text-purple-400 hover:underline"
          >
            Create Account
          </Link>
        </p>
      </div>

      {/* Privacy note */}
      <div className="mt-6 text-center text-xs text-gray-500">
        By continuing, you agree to our Terms of Service and Privacy Policy
      </div>
    </div>
  );
}

