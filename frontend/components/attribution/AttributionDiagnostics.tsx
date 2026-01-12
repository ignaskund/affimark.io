'use client';

import { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, ExternalLink, Link2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface SmartWrapper {
  id: string;
  short_code: string;
  name: string | null;
  destination_url: string;
}

interface RedirectChainStep {
  step: number;
  url: string;
  status: number;
  contains_affiliate_tag: boolean;
  affiliate_params: string[];
}

interface DiagnosticResult {
  url: string;
  final_url: string;
  redirect_chain: RedirectChainStep[];
  affiliate_tag_present: boolean;
  affiliate_params_found: string[];
  confidence: 'high' | 'medium' | 'low';
  issues: string[];
  cookie_window_days: number | null;
  is_in_app_browser_safe: boolean;
}

interface AttributionDiagnosticsProps {
  smartwrappers: SmartWrapper[];
}

export default function AttributionDiagnostics({ smartwrappers }: AttributionDiagnosticsProps) {
  const [selectedUrl, setSelectedUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async (url: string) => {
    if (!url.trim()) {
      setError('Please enter a URL to test');
      return;
    }

    setTesting(true);
    setError(null);
    setResult(null);
    setSelectedUrl(url);

    try {
      const response = await fetch('/api/attribution/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Test failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  };

  const getConfidenceColor = (confidence: string): string => {
    if (confidence === 'high') return 'text-green-600 dark:text-green-400';
    if (confidence === 'medium') return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBg = (confidence: string): string => {
    if (confidence === 'high') return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    if (confidence === 'medium') return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
    return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  };

  return (
    <div className="space-y-8">
      {/* Test Input */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Test Your Links</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Enter any URL to trace the redirect chain and verify affiliate tracking
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* URL Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test URL
            </label>
            <div className="flex gap-3">
              <input
                type="url"
                value={selectedUrl}
                onChange={(e) => setSelectedUrl(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleTest(selectedUrl)}
                placeholder="https://go.affimark.com/xyz or any affiliate link"
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
              />
              <button
                onClick={() => handleTest(selectedUrl)}
                disabled={testing || !selectedUrl.trim()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {testing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Test Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Select SmartWrappers */}
          {smartwrappers.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Or test one of your SmartWrappers:
              </p>
              <div className="flex flex-wrap gap-2">
                {smartwrappers.map((sw) => (
                  <button
                    key={sw.id}
                    onClick={() => handleTest(`https://go.affimark.com/${sw.short_code}`)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Link2 className="h-3 w-3" />
                    {sw.name || sw.short_code}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Confidence Summary */}
          <div className={`border-2 rounded-xl p-6 ${getConfidenceBg(result.confidence)}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Tracking Confidence: {result.confidence.toUpperCase()}
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {result.affiliate_tag_present
                    ? '✓ Your affiliate tag appears in the final destination'
                    : '✗ Affiliate tag not found in final URL'}
                </p>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                {result.confidence === 'high' ? (
                  <ShieldCheck className="h-12 w-12 text-green-600 dark:text-green-400" />
                ) : (
                  <ShieldAlert className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
            </div>

            {result.affiliate_params_found.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Affiliate Parameters Found:
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.affiliate_params_found.map((param, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-mono rounded border border-gray-300 dark:border-gray-600"
                    >
                      {param}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {result.cookie_window_days && (
              <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                Cookie window: {result.cookie_window_days} days
              </p>
            )}
          </div>

          {/* Issues */}
          {result.issues.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-3">
                Potential Issues
              </h3>
              <ul className="space-y-2">
                {result.issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Redirect Chain */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Redirect Chain</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Full path from your link to the final destination
              </p>
            </div>

            <div className="p-6 space-y-4">
              {result.redirect_chain.map((step, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    step.contains_affiliate_tag
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          HTTP {step.status}
                        </span>
                        {step.contains_affiliate_tag && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded">
                            ✓ Tag Present
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                        {step.url}
                      </p>
                      {step.affiliate_params.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {step.affiliate_params.map((param, paramIdx) => (
                            <span
                              key={paramIdx}
                              className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-mono rounded"
                            >
                              {param}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs text-blue-900 dark:text-blue-300">
              <strong>Remember:</strong> This test confirms your tag reaches the retailer. It does NOT guarantee
              commission payment. Coupon extensions, ad blockers, or cookie settings may still interfere with tracking
              at checkout. Use this as a diagnostic tool, not a commission guarantee.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
