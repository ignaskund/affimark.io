'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScannerInput, ScanResults, ScanData, ScanSuggestion } from '@/components/scanner';
import { ScanLine, Clock, Sparkles, CheckCircle2, XCircle } from 'lucide-react';

export default function ScannerPage() {
    const [currentScanId, setCurrentScanId] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<ScanSuggestion[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanCount, setScanCount] = useState(0);

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
            setScanCount((prev) => prev + 1);
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

    const approvedCount = suggestions.filter((s) => s.status === 'approved').length;
    const rejectedCount = suggestions.filter((s) => s.status === 'rejected').length;
    const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="animate-fade-in">
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                        <ScanLine className="w-5 h-5 text-purple-400" />
                    </div>
                    Content Scanner
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Scan video transcripts to detect product mentions and generate monetization suggestions
                </p>
            </div>

            {/* Stats */}
            {suggestions.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up">
                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Found</p>
                                <p className="mt-1 text-2xl font-bold text-foreground">{suggestions.length}</p>
                            </div>
                            <Sparkles className="w-5 h-5 text-purple-400" />
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                                <p className="mt-1 text-2xl font-bold text-amber-400">{pendingCount}</p>
                            </div>
                            <Clock className="w-5 h-5 text-amber-400" />
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                                <p className="mt-1 text-2xl font-bold text-emerald-400">{approvedCount}</p>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </div>
                    </div>

                    <div className="stat-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                                <p className="mt-1 text-2xl font-bold text-red-400">{rejectedCount}</p>
                            </div>
                            <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-scale-in">
                    {error}
                </div>
            )}

            {/* Layout */}
            <div className="grid gap-8 lg:grid-cols-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {/* Scanner Input */}
                <div>
                    <div className="glass-card p-6 sticky top-8">
                        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                            <ScanLine className="w-5 h-5 text-purple-400" />
                            Scan Transcript
                        </h2>
                        <ScannerInput onScan={handleScan} isScanning={isScanning || isProcessing} />

                        {isProcessing && (
                            <div className="mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-purple-300">
                                        Processing transcript and detecting products...
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Scan Results */}
                <div>
                    <div className="glass-card p-6">
                        <h2 className="text-lg font-semibold text-foreground mb-4">
                            Suggestions
                            {suggestions.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({suggestions.length})
                                </span>
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
        </div>
    );
}
