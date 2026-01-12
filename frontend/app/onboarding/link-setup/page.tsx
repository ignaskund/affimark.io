'use client';

/**
 * Onboarding Step 3: Link Platform Input
 * User enters their Linktree/Beacons/etc URL
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LinkSetupPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    async function getUser() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/onboarding/signup');
        return;
      }

      setUserId(user.id);
    }
    getUser();
  }, [router]);

  // Detect platform from URL
  const detectPlatform = (url: string): string | null => {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('linktr.ee')) return 'linktree';
    if (urlLower.includes('beacons.ai')) return 'beacons';
    if (urlLower.includes('stan.store')) return 'stan';
    if (urlLower.includes('taplink.cc') || urlLower.includes('tap.bio')) return 'tapbio';
    if (urlLower.includes('koji.to')) return 'koji';
    if (urlLower.includes('.carrd.co')) return 'carrd';
    if (urlLower.includes('bio.link')) return 'biolink';
    if (urlLower.includes('campsite.bio')) return 'campsite';
    if (urlLower.includes('msha.ke')) return 'milkshake';
    if (urlLower.includes('hoo.be')) return 'hoobe';

    return 'custom';
  };

  // Handle URL input change
  const handleUrlChange = (url: string) => {
    setLinkUrl(url);
    setError('');

    if (url.length > 10) {
      const platform = detectPlatform(url);
      setDetectedPlatform(platform);
    } else {
      setDetectedPlatform(null);
    }
  };

  // Validate URL
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Handle continue
  const handleContinue = async () => {
    if (!linkUrl || !userId) return;

    // Validate URL
    if (!isValidUrl(linkUrl)) {
      setError('Please enter a valid URL (e.g., https://linktr.ee/yourname)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserClient();
      const platform = detectPlatform(linkUrl);

      // Save tracked link page
      const { data, error: insertError } = await supabase
        .from('tracked_link_pages')
        .insert({
          user_id: userId,
          page_url: linkUrl,
          page_type: platform,
          audit_enabled: true,
          audit_frequency: 'daily',
          is_active: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving link page:', insertError);
        setError('Failed to save link page. Please try again.');
        setLoading(false);
        return;
      }

      // Store page ID for health check
      localStorage.setItem('pending_page_id', data.id);

      // Continue to health check
      router.push('/onboarding/health-check');
    } catch (error) {
      console.error('Error:', error);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const getPlatformInfo = (platform: string | null) => {
    const platforms: Record<string, { name: string; icon: string; color: string }> = {
      linktree: { name: 'Linktree', icon: '🌳', color: 'bg-green-100 text-green-700 border-green-300' },
      beacons: { name: 'Beacons', icon: '📡', color: 'bg-purple-100 text-purple-700 border-purple-300' },
      stan: { name: 'Stan Store', icon: '🏪', color: 'bg-blue-100 text-blue-700 border-blue-300' },
      tapbio: { name: 'Tap Bio', icon: '👆', color: 'bg-pink-100 text-pink-700 border-pink-300' },
      koji: { name: 'Koji', icon: '🎨', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
      carrd: { name: 'Carrd', icon: '📇', color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
      biolink: { name: 'Bio.link', icon: '🔗', color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
      campsite: { name: 'Campsite', icon: '🏕️', color: 'bg-orange-100 text-orange-700 border-orange-300' },
      milkshake: { name: 'Milkshake', icon: '🥤', color: 'bg-red-100 text-red-700 border-red-300' },
      hoobe: { name: 'Hoo.be', icon: '🐝', color: 'bg-amber-100 text-amber-700 border-amber-300' },
      custom: { name: 'Custom Bio Link', icon: '🌐', color: 'bg-gray-100 text-gray-700 border-gray-300' },
    };

    return platform ? platforms[platform] : null;
  };

  const platformInfo = getPlatformInfo(detectedPlatform);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Let's scan your link page
          </h1>
          <p className="text-gray-600">
            Enter your Linktree, Beacons, or any bio link URL
          </p>
        </div>

        {/* Link Input Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="space-y-6">
            {/* URL Input */}
            <div>
              <label htmlFor="linkUrl" className="block text-sm font-medium text-gray-700 mb-2">
                Your link-in-bio URL
              </label>
              <input
                id="linkUrl"
                type="url"
                required
                value={linkUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                placeholder="https://linktr.ee/yourname"
                autoFocus
              />
            </div>

            {/* Platform Detection */}
            {platformInfo && (
              <div className={`flex items-center p-4 rounded-lg border-2 ${platformInfo.color}`}>
                <span className="text-2xl mr-3">{platformInfo.icon}</span>
                <div>
                  <p className="font-semibold">{platformInfo.name} detected</p>
                  <p className="text-sm opacity-75">We'll scan all links from this page</p>
                </div>
                <svg className="w-6 h-6 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Continue Button */}
            <button
              onClick={handleContinue}
              disabled={!linkUrl || loading}
              className="w-full px-6 py-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Continue to Health Check'
              )}
            </button>
          </div>

          {/* Supported Platforms */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4 text-center">
              Supported platforms:
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Linktree', 'Beacons', 'Stan Store', 'Tap Bio', 'Koji', 'Carrd', 'Bio.link', 'Campsite', 'Milkshake', 'Custom'].map((platform) => (
                <span
                  key={platform}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* What We'll Check */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-md">
          <h3 className="font-semibold text-gray-900 mb-4">What we'll check:</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-sm">Broken links</p>
                <p className="text-xs text-gray-500">404s, timeouts, errors</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-sm">Stock availability</p>
                <p className="text-xs text-gray-500">Out-of-stock products</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-sm">Missing affiliate tags</p>
                <p className="text-xs text-gray-500">Unmonetized links</p>
              </div>
            </div>
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium text-sm">Revenue health score</p>
                <p className="text-xs text-gray-500">0-100 overall rating</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
