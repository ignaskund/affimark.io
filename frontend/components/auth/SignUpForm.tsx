/**
 * Sign Up Form Component
 * Handles user registration with email and password
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2, Mail, Eye, EyeOff, CheckCircle2, Sparkles } from 'lucide-react';

interface SignUpFormProps {
  callbackUrl?: string;
}

export default function SignUpForm({ callbackUrl }: SignUpFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sign up');
      }

      // Show verification sent state
      setVerificationSent(true);
      
      // Redirect to verification page after a moment
      setTimeout(() => {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch (error: any) {
      console.error('Sign up error:', error);
      setError(error.message || 'Failed to create account. Please try again.');
      setLoading(false);
    }
  };

  // If verification email was sent, show success message
  if (verificationSent) {
    return (
      <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-600/10 rounded-full flex items-center justify-center">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Check your email!</h2>
        <p className="text-gray-400 mb-6">
          We've sent a 6-digit verification code to<br />
          <span className="text-white font-medium">{email}</span>
        </p>
        <p className="text-sm text-gray-500">
          Redirecting to verification page...
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-2xl p-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-purple-600/10 px-4 py-2 rounded-full mb-4">
          <Sparkles size={16} className="text-purple-400" />
          <span className="text-sm text-purple-300">Start Monetizing Your Content</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
        <p className="text-gray-400">
          Join AffiMark and discover your next partnership
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Sign Up Form */}
      <form onSubmit={handleEmailSignUp} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              disabled={loading}
              required
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full pl-4 pr-11 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              disabled={loading}
              required
              minLength={8}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Use 8+ characters with a mix of letters and numbers
          </p>
        </div>

        {/* Sign Up Button */}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={20} />
              Creating account...
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>

      {/* Terms */}
      <p className="mt-6 text-xs text-center text-gray-500">
        By signing up, you agree to our{' '}
        <Link href="/terms" className="text-purple-400 hover:text-purple-300">
          Terms of Service
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="text-purple-400 hover:text-purple-300">
          Privacy Policy
        </Link>
      </p>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-800"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-gray-900/50 text-gray-500">Already have an account?</span>
        </div>
      </div>

      {/* Sign In Link */}
      <Link
        href="/sign-in"
        className="block w-full text-center py-3 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
      >
        Sign in instead
      </Link>
    </div>
  );
}

