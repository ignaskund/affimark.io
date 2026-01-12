'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScannerInput, ScanResults, ScanData, ScanSuggestion } from '@/components/scanner';
import { AppShell } from '@/components/layout/AppShell';

export default function ScannerPage() {
  const [currentScanId, setCurrentScanId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ScanSuggestion[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (scanData: ScanData) => {
    setIsScanning(true);
    setError(null);
    setSuggestions([]);
    setCurrentScanId(null);

    try {
      // Step 1: Create scan run
      const scanResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id', // TODO: Get from auth context
          },
          body: JSON.stringify(scanData),
        }
      );

      if (!scanResponse.ok) {
        throw new Error('Failed to create scan');
      }

      const scanResult = await scanResponse.json();
      const scanId = scanResult.scan_run.id;
      setCurrentScanId(scanId);

      // Step 2: Process scan (detect products)
      setIsProcessing(true);
      const processResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/process/${scanId}`,
        {
          method: 'POST',
          headers: {
            'X-User-ID': 'current-user-id',
          },
        }
      );

      if (!processResponse.ok) {
        throw new Error('Failed to process scan');
      }

      const processResult = await processResponse.json();
      setSuggestions(processResult.suggestions || []);
    } catch (err) {
      console.error('Scan error:', err);
      setError('Failed to scan transcript. Please try again.');
    } finally {
      setIsScanning(false);
      setIsProcessing(false);
    }
  };

  const handleApprove = async (suggestionId: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/suggestions/${suggestionId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({ status: 'approved' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to approve suggestion');
      }

      const result = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? result.suggestion : s))
      );
    } catch (err) {
      console.error('Approve error:', err);
      setError('Failed to approve suggestion');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReject = async (suggestionId: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/suggestions/${suggestionId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({ status: 'rejected' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to reject suggestion');
      }

      const result = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => (s.id === suggestionId ? result.suggestion : s))
      );
    } catch (err) {
      console.error('Reject error:', err);
      setError('Failed to reject suggestion');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleBulkUpdate = async (
    suggestionIds: string[],
    status: 'approved' | 'rejected'
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/scanner/suggestions/bulk-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id',
          },
          body: JSON.stringify({ suggestion_ids: suggestionIds, status }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to bulk update suggestions');
      }

      const result = await response.json();
      setSuggestions((prev) =>
        prev.map((s) => {
          const updated = result.suggestions?.find((u: ScanSuggestion) => u.id === s.id);
          return updated || s;
        })
      );
    } catch (err) {
      console.error('Bulk update error:', err);
      setError('Failed to update suggestions');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppShell>
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-bold text-white">Content Scanner</h1>
          <p className="text-gray-400">
            Scan video transcripts to detect product mentions and generate monetization
            suggestions
          </p>
        </div>
        <Link
          href="/scanner/history"
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Scan History
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Layout */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Scanner Input */}
        <div>
          <div className="sticky top-8">
            <h2 className="mb-4 text-xl font-semibold text-white">Scan Transcript</h2>
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
              <ScannerInput onScan={handleScan} isScanning={isScanning || isProcessing} />
            </div>
            {isProcessing && (
              <div className="mt-4 flex items-center gap-3 rounded-lg border border-purple-500/50 bg-purple-500/10 p-4">
                <svg
                  className="h-5 w-5 animate-spin text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm text-purple-300">
                  Processing transcript and detecting products...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Scan Results */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-white">
            Suggestions
            {suggestions.length > 0 && (
              <span className="ml-2 text-base text-gray-400">({suggestions.length})</span>
            )}
          </h2>
          <ScanResults
            suggestions={suggestions}
            onApprove={handleApprove}
            onReject={handleReject}
            onBulkUpdate={handleBulkUpdate}
            isUpdating={isUpdating}
          />
        </div>
      </div>
    </div>
    </AppShell>
  );
}
