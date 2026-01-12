'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Link2, Copy } from 'lucide-react';

interface CreateSmartWrapperModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function CreateSmartWrapperModal({ isOpen, onClose, userId }: CreateSmartWrapperModalProps) {
  const [name, setName] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');
  const [autoFallbackEnabled, setAutoFallbackEnabled] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdLink, setCreatedLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!destinationUrl.trim()) {
      setError('Destination URL is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/smartwrappers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim() || null,
          destination_url: destinationUrl.trim(),
          fallback_url: fallbackUrl.trim() || null,
          auto_fallback_enabled: autoFallbackEnabled,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create SmartWrapper');
      }

      const shortLink = `https://go.affimark.com/${data.smartwrapper.short_code}`;
      setCreatedLink(shortLink);
      setCreated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SmartWrapper');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(createdLink);
  };

  const handleClose = () => {
    if (created) {
      window.location.reload();
    } else {
      setName('');
      setDestinationUrl('');
      setFallbackUrl('');
      setAutoFallbackEnabled(false);
      setCreated(false);
      setCreatedLink('');
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {created ? 'SmartWrapper Created!' : 'Create SmartWrapper'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {created ? 'Your short link is ready to use' : 'Create a short, trackable link'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!created ? (
            <div className="space-y-6">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name (Optional)
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sony Headphones Link"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
              </div>

              {/* Destination URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Destination URL *
                </label>
                <input
                  type="url"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  placeholder="https://www.amazon.de/dp/B08N5WRWNW?tag=youraffid-21"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Your affiliate link with tracking parameters
                </p>
              </div>

              {/* Fallback URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fallback URL (Optional)
                </label>
                <input
                  type="url"
                  value={fallbackUrl}
                  onChange={(e) => setFallbackUrl(e.target.value)}
                  placeholder="https://ltk.to/search?q=sony+headphones"
                  className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent"
                />
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  Where to redirect if product goes out of stock
                </p>
              </div>

              {/* Auto-Fallback Toggle */}
              {fallbackUrl && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="autoFallback"
                    checked={autoFallbackEnabled}
                    onChange={(e) => setAutoFallbackEnabled(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="autoFallback" className="text-sm font-medium text-amber-900 dark:text-amber-300 cursor-pointer">
                      Enable Auto-Fallback
                    </label>
                    <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                      Automatically redirect to fallback URL when we detect the product is out of stock
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="mx-auto h-16 w-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                SmartWrapper Created!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Use this link everywhere - Instagram, TikTok, YouTube, your website
              </p>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-blue-600" />
                  <code className="flex-1 text-sm font-mono text-gray-900 dark:text-white break-all">
                    {createdLink}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>

              <div className="text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  What happens now:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
                  <li>Clicks are tracked automatically</li>
                  <li>In-app browsers detected and handled</li>
                  <li>Your affiliate tag is preserved</li>
                  {autoFallbackEnabled && <li>Auto-fallback active if product goes OOS</li>}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!created && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !destinationUrl.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              {creating ? 'Creating...' : 'Create SmartWrapper'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
