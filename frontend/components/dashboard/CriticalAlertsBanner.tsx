'use client';

/**
 * Critical Alerts Banner
 * Shows prominent banner when critical issues exist
 */

import { useState } from 'react';

interface CriticalAlertsBannerProps {
  criticalIssuesCount: number;
  estimatedLoss: number;
  onViewIssues: () => void;
  onFixFirst: () => void;
  className?: string;
}

export function CriticalAlertsBanner({
  criticalIssuesCount,
  estimatedLoss,
  onViewIssues,
  onFixFirst,
  className = '',
}: CriticalAlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (criticalIssuesCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-grow">
          <div className="flex items-center mb-2">
            <span className="text-3xl mr-3">⚠️</span>
            <h3 className="text-xl font-bold text-white">
              {criticalIssuesCount} Critical Issue{criticalIssuesCount > 1 ? 's' : ''} Detected
            </h3>
          </div>

          <p className="text-white text-lg mb-4 ml-11">
            Fix {criticalIssuesCount > 1 ? 'these issues' : 'this issue'} now to recover approximately €{Math.floor(estimatedLoss)}/month
          </p>

          <div className="flex flex-wrap gap-3 ml-11">
            <button
              onClick={onViewIssues}
              className="px-6 py-2 bg-white text-red-600 font-semibold rounded-lg hover:bg-gray-100 transition-all shadow-md"
            >
              View All Issues
            </button>
            <button
              onClick={onFixFirst}
              className="px-6 py-2 bg-red-700 text-white font-semibold rounded-lg hover:bg-red-800 transition-all shadow-md"
            >
              Fix First Issue
            </button>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => setDismissed(true)}
          className="text-white hover:text-gray-200 transition-colors ml-4"
          title="Dismiss"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
