'use client';

import { useState } from 'react';
import { Search, Loader2, Globe, Zap, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { UserContext, TrafficType } from '@/types/verifier';

interface VerifierInputProps {
  onAnalyze: (url: string, context?: UserContext) => void;
  isLoading: boolean;
  loadingPhase: string | null;
  error: string | null;
  onClearError: () => void;
}

export default function VerifierInput({
  onAnalyze,
  isLoading,
  loadingPhase,
  error,
  onClearError,
}: VerifierInputProps) {
  const [url, setUrl] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [region, setRegion] = useState('EU');
  const [trafficType, setTrafficType] = useState<TrafficType>('ORGANIC');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    onClearError();
    onAnalyze(url.trim(), { region, traffic_type: trafficType });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a product URL to analyze..."
            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-800 bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-base"
            disabled={isLoading}
          />
        </div>

        {/* Options Toggle */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Analysis options
          </button>

          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium text-sm transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Analyze
              </>
            )}
          </button>
        </div>

        {/* Options Panel */}
        {showOptions && (
          <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border border-gray-800 bg-gray-900/30">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Target Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="EU">Europe (EU)</option>
                <option value="DE">Germany</option>
                <option value="UK">United Kingdom</option>
                <option value="US">United States</option>
                <option value="GLOBAL">Global</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Traffic Type</label>
              <select
                value={trafficType}
                onChange={(e) => setTrafficType(e.target.value as TrafficType)}
                className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="ORGANIC">Organic</option>
                <option value="PAID">Paid</option>
                <option value="MIXED">Mixed</option>
              </select>
            </div>
          </div>
        )}
      </form>

      {/* Loading Progress */}
      {isLoading && loadingPhase && (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">{loadingPhase}</p>
            <p className="text-xs text-gray-500 mt-0.5">This may take a few moments</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/20 bg-red-500/5">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={onClearError}
              className="text-xs text-gray-500 hover:text-gray-400 mt-1"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
