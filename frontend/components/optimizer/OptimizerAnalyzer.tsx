'use client';

import { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle2, TrendingUp, ExternalLink } from 'lucide-react';

interface AnalysisResult {
  brand: { brand: string; product?: string };
  current_link: {
    url: string;
    platform: string;
    platform_name: string;
    commission_rate: number | null;
  };
  alternatives: Array<{
    id: string;
    network: string;
    brand_name: string;
    commission_rate_low: number;
    commission_rate_high: number;
    cookie_duration: number;
    requires_application: boolean;
    confidence_score: number;
    last_verified: string;
    potential_gain_low: number;
    potential_gain_high: number;
  }>;
  user_stats: {
    avg_clicks_per_month: number;
    avg_commission_per_click: number;
  };
}

interface OptimizerAnalyzerProps {
  userId: string;
}

export default function OptimizerAnalyzer({ userId }: OptimizerAnalyzerProps) {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/optimizer/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const renderConfidenceStars = (score: number) => {
    const filled = '●';
    const empty = '○';
    return filled.repeat(score) + empty.repeat(5 - score);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Analyze Link</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Paste any affiliate link to find better commission rates
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* URL Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Affiliate Link
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
              placeholder="https://amzn.to/xyz or https://www.amazon.de/dp/B08..."
              className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent"
            />
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-5 w-5" />
                  Analyze
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Analysis Result */}
        {result && (
          <div className="space-y-6">
            {/* Current Link Info */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current Link</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Brand</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{result.brand.brand}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Platform</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{result.current_link.platform_name}</p>
                </div>
                {result.current_link.commission_rate && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Current Commission Rate</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {result.current_link.commission_rate}%
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Alternatives */}
            {result.alternatives.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Better Alternatives Found
                </h3>
                <div className="space-y-4">
                  {result.alternatives.map((alt, index) => (
                    <div
                      key={alt.id}
                      className={`p-6 rounded-lg border-2 transition-all ${
                        index === 0
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          {index === 0 && (
                            <span className="inline-block px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded mb-2">
                              🥇 BEST OPTION
                            </span>
                          )}
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {alt.brand_name} via {alt.network}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Last verified: {new Date(alt.last_verified).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                            {alt.commission_rate_low}-{alt.commission_rate_high}%
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">commission rate</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Confidence</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {renderConfidenceStars(alt.confidence_score)}{' '}
                            {alt.confidence_score === 5 ? 'Very High' : alt.confidence_score >= 3 ? 'High' : 'Medium'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">Cookie Duration</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{alt.cookie_duration} days</p>
                        </div>
                      </div>

                      {/* Potential Earnings */}
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                          <p className="text-sm font-semibold text-green-900 dark:text-green-300">
                            Potential Extra Earnings
                          </p>
                        </div>
                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                          €{alt.potential_gain_low.toFixed(0)} - €{alt.potential_gain_high.toFixed(0)}
                          <span className="text-sm font-normal">/month</span>
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-500 mt-1">
                          Based on your average {result.user_stats.avg_clicks_per_month.toLocaleString()} monthly clicks
                        </p>
                      </div>

                      {alt.requires_application && (
                        <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                          <p className="text-xs text-amber-800 dark:text-amber-400">
                            ⚠️ Requires application approval from affiliate network
                          </p>
                        </div>
                      )}

                      <div className="mt-4 flex gap-3">
                        <button
                          onClick={() => window.open(`https://${alt.network}.com`, '_blank')}
                          className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Apply on {alt.network}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
                  You're already using a great program!
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  We couldn't find any better-paying alternatives for this brand right now.
                </p>
              </div>
            )}

            {/* Disclaimer */}
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Important:</strong> Commission rates shown are estimates and may vary by product category, region,
                volume tiers, or your approval status with the affiliate network. Potential earnings are calculated based on
                your historical traffic patterns and average conversion rates. Always verify current rates with the affiliate
                network before switching programs.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
