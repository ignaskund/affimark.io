'use client';

import { useState } from 'react';
import { executeRecommendation, completeAction } from '@/lib/api/audit-api';

interface Recommendation {
  id: string;
  action_type: string;
  priority: number;
  title: string;
  description?: string;
  estimated_revenue_gain?: number;
  implementation_difficulty?: 'easy' | 'medium' | 'hard';
}

interface Issue {
  id: string;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description?: string;
  revenue_impact_estimate?: number;
  evidence?: Record<string, any>;
  created_at: string;
}

interface IssueDetailModalProps {
  issue: Issue;
  recommendations: Recommendation[];
  userId: string;
  onClose: () => void;
  onIssueResolved: () => void;
}

export default function IssueDetailModal({
  issue,
  recommendations,
  userId,
  onClose,
  onIssueResolved
}: IssueDetailModalProps) {
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'info':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'hard':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleExecute = async (recommendation: Recommendation) => {
    setExecuting(true);
    setSelectedRec(recommendation);

    try {
      const result = await executeRecommendation(recommendation.id, userId);

      if (result.success) {
        setExecutionResult(result);
        setShowInstructions(true);
      } else {
        alert(`Failed to execute: ${result.error}`);
        setExecuting(false);
      }
    } catch (error) {
      alert('Error executing recommendation');
      setExecuting(false);
    }
  };

  const handleComplete = async () => {
    if (!executionResult?.action_id) return;

    try {
      const result = await completeAction(
        executionResult.action_id,
        'Fixed manually via dashboard'
      );

      if (result.success) {
        alert('Fix completed! Issue resolved.');
        onIssueResolved();
        onClose();
      } else {
        alert(`Failed to complete: ${result.error}`);
      }
    } catch (error) {
      alert('Error completing fix');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    alert('Link copied to clipboard!');
  };

  const daysOld = Math.floor(
    (Date.now() - new Date(issue.created_at).getTime()) / 86400000
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold border ${getSeverityColor(
                  issue.severity
                )}`}
              >
                {issue.severity.toUpperCase()}
              </span>
              {issue.revenue_impact_estimate && issue.revenue_impact_estimate > 0 && (
                <span className="text-red-600 font-semibold">
                  -€{Math.floor(issue.revenue_impact_estimate)}/month
                </span>
              )}
              <span className="text-gray-500 text-sm">{daysOld} days old</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{issue.title}</h2>
            {issue.description && (
              <p className="text-gray-600 mt-2">{issue.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold ml-4"
          >
            ×
          </button>
        </div>

        {/* Evidence Section */}
        {issue.evidence && Object.keys(issue.evidence).length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Evidence</h3>
            <div className="space-y-1">
              {issue.evidence.status_code && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">HTTP Status:</span> {issue.evidence.status_code}
                </p>
              )}
              {issue.evidence.link_url && (
                <p className="text-sm text-gray-600 truncate">
                  <span className="font-medium">Link:</span> {issue.evidence.link_url}
                </p>
              )}
              {issue.evidence.destination_url && (
                <p className="text-sm text-gray-600 truncate">
                  <span className="font-medium">Destination:</span>{' '}
                  {issue.evidence.destination_url}
                </p>
              )}
              {issue.evidence.stock_status && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Stock Status:</span>{' '}
                  {issue.evidence.stock_status}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Instructions View (After Execution) */}
        {showInstructions && executionResult ? (
          <div className="px-6 py-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                ✓ Fix Generated Successfully!
              </h3>
              <p className="text-green-700 text-sm">
                Follow the steps below to apply this fix to your link-in-bio page.
              </p>
            </div>

            {/* Old vs New Link */}
            {executionResult.old_link && executionResult.new_link && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-3">Link Replacement</h4>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-blue-600 font-medium mb-1">OLD LINK (Remove)</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={executionResult.old_link}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-blue-300 rounded text-sm text-gray-700"
                      />
                      <button
                        onClick={() => handleCopyLink(executionResult.old_link)}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-green-600 font-medium mb-1">NEW LINK (Use This)</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={executionResult.new_link}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm text-gray-700 font-semibold"
                      />
                      <button
                        onClick={() => handleCopyLink(executionResult.new_link)}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>

                {executionResult.estimated_revenue_gain && executionResult.estimated_revenue_gain > 0 && (
                  <p className="text-green-700 font-semibold mt-3 text-sm">
                    💰 Estimated revenue gain: €{Math.floor(executionResult.estimated_revenue_gain)}/month
                  </p>
                )}
              </div>
            )}

            {/* Step-by-Step Instructions */}
            {executionResult.instructions && executionResult.instructions.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-gray-900 mb-3">
                  📋 Step-by-Step Instructions
                </h4>
                <ol className="space-y-2">
                  {executionResult.instructions.map((instruction: string, index: number) => (
                    <li key={index} className="text-sm text-gray-700 flex">
                      <span className="mr-2">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                ✓ Mark as Fixed
              </button>
            </div>
          </div>
        ) : (
          /* Recommendations View (Before Execution) */
          <div className="px-6 py-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recommended Fixes
            </h3>

            {recommendations.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No automated fix available for this issue.
              </p>
            ) : (
              <div className="space-y-3">
                {recommendations
                  .sort((a, b) => b.priority - a.priority)
                  .map((rec) => (
                    <div
                      key={rec.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                          {rec.description && (
                            <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                          )}
                        </div>
                        <span
                          className={`ml-3 px-2 py-1 rounded text-xs font-semibold ${getDifficultyColor(
                            rec.implementation_difficulty
                          )}`}
                        >
                          {rec.implementation_difficulty || 'medium'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-4 text-sm">
                          {rec.estimated_revenue_gain && rec.estimated_revenue_gain > 0 && (
                            <span className="text-green-600 font-semibold">
                              +€{Math.floor(rec.estimated_revenue_gain)}/mo
                            </span>
                          )}
                          <span className="text-gray-500">
                            Priority: {rec.priority}/100
                          </span>
                        </div>

                        <button
                          onClick={() => handleExecute(rec)}
                          disabled={executing}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {executing && selectedRec?.id === rec.id
                            ? 'Preparing Fix...'
                            : 'Apply This Fix'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
