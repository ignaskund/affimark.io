'use client';

import { useState } from 'react';
import { CheckCircle2, X, ExternalLink, Sparkles } from 'lucide-react';

interface Suggestion {
  id: string;
  original_url: string;
  original_program: string;
  original_rate: number | null;
  potential_gain_low: number;
  potential_gain_high: number;
  status: string;
  created_at: string;
  affiliate_programs: {
    brand_name: string;
    network: string;
    commission_rate_low: number;
    commission_rate_high: number;
  } | null;
}

interface OptimizationSuggestionsProps {
  suggestions: Suggestion[];
}

export default function OptimizationSuggestions({ suggestions: initialSuggestions }: OptimizationSuggestionsProps) {
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const handleAction = async (id: string, action: 'apply' | 'dismiss') => {
    setActioningId(id);

    try {
      const response = await fetch(`/api/optimizer/${action}/${id}`, {
        method: 'POST',
      });

      if (response.ok) {
        // Remove from list
        setSuggestions(suggestions.filter((s) => s.id !== id));
      }
    } catch (err) {
      console.error('Failed to action suggestion:', err);
    } finally {
      setActioningId(null);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Suggestions Yet</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Analyze links to see optimization suggestions here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Suggestions</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Your optimization history</p>
      </div>

      <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="mb-3">
              {suggestion.affiliate_programs && (
                <>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {suggestion.affiliate_programs.brand_name}
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    via {suggestion.affiliate_programs.network}
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Current</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {suggestion.original_rate ? `${suggestion.original_rate}%` : 'Unknown'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-600 dark:text-gray-400">Better Rate</p>
                <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                  {suggestion.affiliate_programs
                    ? `${suggestion.affiliate_programs.commission_rate_low}-${suggestion.affiliate_programs.commission_rate_high}%`
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2 mb-3">
              <p className="text-xs text-green-700 dark:text-green-400">
                Potential: €{suggestion.potential_gain_low.toFixed(0)} - €{suggestion.potential_gain_high.toFixed(0)}/mo
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAction(suggestion.id, 'apply')}
                disabled={actioningId === suggestion.id}
                className="flex-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="h-3 w-3" />
                Applied
              </button>
              <button
                onClick={() => handleAction(suggestion.id, 'dismiss')}
                disabled={actioningId === suggestion.id}
                className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:border-red-500 dark:hover:border-red-400 text-gray-700 dark:text-gray-300 text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
              >
                <X className="h-3 w-3" />
                Dismiss
              </button>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {new Date(suggestion.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
