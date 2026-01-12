'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ScannerInputProps {
  onScan: (data: ScanData) => Promise<void>;
  isScanning?: boolean;
}

export interface ScanData {
  source_type: 'youtube' | 'twitch' | 'tiktok' | 'upload' | 'url';
  source_url?: string;
  source_title?: string;
  transcript_text: string;
  transcript_metadata?: Record<string, any>;
}

export function ScannerInput({ onScan, isScanning = false }: ScannerInputProps) {
  const [sourceType, setSourceType] = useState<ScanData['source_type']>('upload');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!transcriptText.trim()) {
      setError('Transcript text is required');
      return;
    }

    try {
      await onScan({
        source_type: sourceType,
        source_url: sourceUrl || undefined,
        source_title: sourceTitle || undefined,
        transcript_text: transcriptText.trim(),
      });

      // Clear form on success
      setTranscriptText('');
      setSourceUrl('');
      setSourceTitle('');
    } catch (err) {
      console.error('Scan error:', err);
      setError('Failed to start scan. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Source Type Selection */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-300">
          Source Type
        </label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(['youtube', 'twitch', 'tiktok', 'upload', 'url'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSourceType(type)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-all ${
                sourceType === type
                  ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                  : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Source URL (optional) */}
      {(sourceType === 'youtube' || sourceType === 'twitch' || sourceType === 'tiktok' || sourceType === 'url') && (
        <div>
          <label htmlFor="source-url" className="mb-2 block text-sm font-medium text-gray-300">
            Source URL
            <span className="ml-1 text-xs text-gray-500">(optional)</span>
          </label>
          <input
            id="source-url"
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
      )}

      {/* Source Title (optional) */}
      <div>
        <label htmlFor="source-title" className="mb-2 block text-sm font-medium text-gray-300">
          Title
          <span className="ml-1 text-xs text-gray-500">(optional)</span>
        </label>
        <input
          id="source-title"
          type="text"
          value={sourceTitle}
          onChange={(e) => setSourceTitle(e.target.value)}
          placeholder="My Studio Tour 2024"
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
        />
      </div>

      {/* Transcript Text */}
      <div>
        <label htmlFor="transcript-text" className="mb-2 block text-sm font-medium text-gray-300">
          Transcript Text
          <span className="ml-1 text-xs text-red-400">*</span>
        </label>
        <textarea
          id="transcript-text"
          value={transcriptText}
          onChange={(e) => setTranscriptText(e.target.value)}
          placeholder="Paste your video transcript here... We'll scan it for product mentions and generate monetization suggestions."
          rows={12}
          className="w-full rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 font-mono text-sm text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          required
        />
        <p className="mt-2 text-xs text-gray-500">
          {transcriptText.length > 0
            ? `${transcriptText.length.toLocaleString()} characters`
            : 'Paste a transcript from YouTube, Twitch, TikTok, or any other source'}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isScanning || !transcriptText.trim()}
        className="w-full"
      >
        {isScanning ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin"
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
            Scanning transcript...
          </>
        ) : (
          <>
            <svg
              className="mr-2 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Scan for Products
          </>
        )}
      </Button>
    </form>
  );
}
