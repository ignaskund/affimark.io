'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ScanSuggestion {
  id: string;
  scan_run_id: string;
  detected_product_name: string;
  detected_brand?: string;
  detected_category?: string;
  context_snippet: string;
  confidence_score: number;
  status: 'pending' | 'approved' | 'rejected' | 'in_inventory';
  reviewed_at?: string;
  created_at: string;
}

export interface ScanResultsProps {
  suggestions: ScanSuggestion[];
  onApprove?: (suggestionId: string) => Promise<void>;
  onReject?: (suggestionId: string) => Promise<void>;
  onBulkUpdate?: (suggestionIds: string[], status: 'approved' | 'rejected') => Promise<void>;
  isUpdating?: boolean;
}

export function ScanResults({
  suggestions,
  onApprove,
  onReject,
  onBulkUpdate,
  isUpdating = false,
}: ScanResultsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(suggestions.filter(s => s.status === 'pending').map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (suggestionId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(suggestionId);
    } else {
      newSelected.delete(suggestionId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || !onBulkUpdate) return;
    await onBulkUpdate(Array.from(selectedIds), 'approved');
    setSelectedIds(new Set());
  };

  const handleBulkReject = async () => {
    if (selectedIds.size === 0 || !onBulkUpdate) return;
    await onBulkUpdate(Array.from(selectedIds), 'rejected');
    setSelectedIds(new Set());
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
  const reviewedSuggestions = suggestions.filter((s) => s.status !== 'pending');

  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 p-12">
        <svg
          className="mb-4 h-16 w-16 text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-lg text-white">No suggestions found</p>
        <p className="mt-2 text-sm text-gray-400">
          Try scanning a transcript with product mentions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      {pendingSuggestions.length > 0 && onBulkUpdate && (
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === pendingSuggestions.length}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-400">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all pending'}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                disabled={isUpdating}
              >
                Approve Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkReject}
                disabled={isUpdating}
              >
                Reject Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Pending Suggestions */}
      {pendingSuggestions.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            Pending Suggestions ({pendingSuggestions.length})
          </h3>
          <div className="space-y-3">
            {pendingSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApprove={onApprove}
                onReject={onReject}
                isUpdating={isUpdating}
                isSelected={selectedIds.has(suggestion.id)}
                onSelect={(checked) => handleSelectOne(suggestion.id, checked)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Reviewed Suggestions */}
      {reviewedSuggestions.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold text-white">
            Reviewed ({reviewedSuggestions.length})
          </h3>
          <div className="space-y-3">
            {reviewedSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                isUpdating={false}
                isSelected={false}
                onSelect={() => {}}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: ScanSuggestion;
  onApprove?: (suggestionId: string) => Promise<void>;
  onReject?: (suggestionId: string) => Promise<void>;
  isUpdating?: boolean;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
}

function SuggestionCard({
  suggestion,
  onApprove,
  onReject,
  isUpdating = false,
  isSelected,
  onSelect,
}: SuggestionCardProps) {
  const isPending = suggestion.status === 'pending';
  const statusColors = {
    pending: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400',
    approved: 'border-green-500/50 bg-green-500/10 text-green-400',
    rejected: 'border-red-500/50 bg-red-500/10 text-red-400',
    in_inventory: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
  };

  const confidenceColor =
    suggestion.confidence_score >= 80
      ? 'text-green-400'
      : suggestion.confidence_score >= 60
      ? 'text-yellow-400'
      : 'text-orange-400';

  return (
    <div className="flex gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 transition-colors hover:border-gray-700">
      {/* Checkbox (only for pending) */}
      {isPending && (
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(e.target.checked)}
            className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <h4 className="text-base font-semibold text-white">
              {suggestion.detected_product_name}
            </h4>
            {suggestion.detected_brand && (
              <p className="text-sm text-gray-400">{suggestion.detected_brand}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-medium ${confidenceColor}`}>
              {suggestion.confidence_score}% confidence
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${statusColors[suggestion.status]}`}
            >
              {suggestion.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {suggestion.detected_category && (
          <p className="mb-2 text-xs text-gray-500">
            Category: {suggestion.detected_category}
          </p>
        )}

        <div className="mb-3 rounded-lg border border-gray-800 bg-gray-800/50 p-3">
          <p className="text-sm italic text-gray-300">{suggestion.context_snippet}</p>
        </div>

        {/* Actions (only for pending) */}
        {isPending && onApprove && onReject && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApprove(suggestion.id)}
              disabled={isUpdating}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReject(suggestion.id)}
              disabled={isUpdating}
            >
              <svg
                className="mr-1.5 h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
