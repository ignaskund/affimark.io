'use client';

import { useState } from 'react';
import { X, Store, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

interface ConnectStorefrontModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Platform {
  id: string;
  name: string;
  icon: string;
  method: 'csv' | 'oauth' | 'coming_soon';
  region?: string;
  description?: string;
}

const PLATFORMS: Platform[] = [
  { id: 'amazon_de', name: 'Amazon Germany', icon: '🇩🇪', method: 'csv', region: 'DE' },
  { id: 'amazon_uk', name: 'Amazon UK', icon: '🇬🇧', method: 'csv', region: 'UK' },
  { id: 'amazon_us', name: 'Amazon US', icon: '🇺🇸', method: 'csv', region: 'US' },
  { id: 'amazon_fr', name: 'Amazon France', icon: '🇫🇷', method: 'csv', region: 'FR' },
  { id: 'amazon_es', name: 'Amazon Spain', icon: '🇪🇸', method: 'csv', region: 'ES' },
  { id: 'amazon_it', name: 'Amazon Italy', icon: '🇮🇹', method: 'csv', region: 'IT' },
  { id: 'awin', name: 'Awin', icon: '🔗', method: 'csv', description: 'CSV upload' },
  { id: 'ltk', name: 'LTK (RewardStyle)', icon: '💄', method: 'csv' },
  { id: 'shopmy', name: 'ShopMy', icon: '🛍️', method: 'csv' },
  { id: 'tradedoubler', name: 'Tradedoubler', icon: '🔗', method: 'oauth', description: 'Auto-sync via OAuth' },
];

export default function ConnectStorefrontModal({ isOpen, onClose }: ConnectStorefrontModalProps) {
  const [step, setStep] = useState<'select' | 'configure' | 'oauth_connecting'>('select');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [storefrontName, setStorefrontName] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlatformSelect = async (platform: Platform) => {
    if (platform.method === 'coming_soon') return;

    // For OAuth platforms, initiate the OAuth flow immediately
    if (platform.method === 'oauth') {
      setSelectedPlatform(platform);
      setConnecting(true);
      setError(null);
      setStep('oauth_connecting');

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setError('Please sign in to connect your account');
          setStep('select');
          setConnecting(false);
          return;
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
        const response = await fetch(`${backendUrl}/api/${platform.id}/oauth/authorize`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        const data = await response.json();

        if (data.authUrl) {
          // Redirect to OAuth provider
          window.location.href = data.authUrl;
        } else {
          setError(data.error || 'Failed to initiate OAuth flow');
          setStep('select');
          setConnecting(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setStep('select');
        setConnecting(false);
      }
      return;
    }

    // For CSV platforms, show the configure step
    setSelectedPlatform(platform);
    setStorefrontName(`My ${platform.name} Store`);
    setStep('configure');
  };

  const handleConnect = async () => {
    if (!selectedPlatform) return;

    setConnecting(true);
    setError(null);

    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: selectedPlatform.id,
          storefront_name: storefrontName,
          account_identifier: accountIdentifier || null,
          region: selectedPlatform.region || null,
        }),
      });

      const data = await response.json();

      if (response.ok && data.account) {
        // Success - reload page to show new account
        window.location.reload();
      } else {
        setError(data.error || 'Failed to connect storefront');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedPlatform(null);
    setStorefrontName('');
    setAccountIdentifier('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {step === 'select' ? 'Select Platform' : `Connect ${selectedPlatform?.name}`}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {step === 'select'
                ? 'Choose your affiliate platform to start importing earnings'
                : 'Configure your storefront connection'}
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {step === 'select' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {PLATFORMS.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformSelect(platform)}
                  disabled={platform.method === 'coming_soon' || connecting}
                  className={`p-6 border-2 rounded-lg transition-all text-left ${
                    platform.method === 'coming_soon'
                      ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-lg'
                  }`}
                >
                  <div className="text-4xl mb-3">{platform.icon}</div>
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {platform.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {platform.method === 'csv' && 'CSV Upload'}
                    {platform.method === 'oauth' && (
                      <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <ExternalLink className="h-3 w-3" />
                        Auto-sync
                      </span>
                    )}
                    {platform.method === 'coming_soon' && 'Coming Soon'}
                  </div>
                  {platform.description && platform.method === 'oauth' && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                      One-click connection
                    </div>
                  )}
                </button>
              ))}

              {error && (
                <div className="col-span-full flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'oauth_connecting' && selectedPlatform && (
            <div className="text-center py-12">
              <div className="text-6xl mb-6">{selectedPlatform.icon}</div>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Connecting to {selectedPlatform.name}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You'll be redirected to authorize access...
              </p>
            </div>
          )}

          {step === 'configure' && selectedPlatform && (
            <div className="space-y-6">
              {/* Storefront Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Storefront Name
                </label>
                <input
                  type="text"
                  value={storefrontName}
                  onChange={(e) => setStorefrontName(e.target.value)}
                  placeholder="My Amazon Store"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  A friendly name to identify this storefront (you can change this later)
                </p>
              </div>

              {/* Account Identifier (Optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {getAccountIdentifierLabel(selectedPlatform.id)}
                  <span className="text-gray-400 ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={accountIdentifier}
                  onChange={(e) => setAccountIdentifier(e.target.value)}
                  placeholder={getAccountIdentifierPlaceholder(selectedPlatform.id)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Your affiliate tag or ID (helps identify transactions)
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                  What happens next?
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li>We'll create your storefront connection</li>
                  <li>You'll upload your earnings report CSV</li>
                  <li>We'll import and normalize all transactions to EUR</li>
                  <li>Your earnings will appear in the dashboard</li>
                </ol>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'configure' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setStep('select')}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={handleConnect}
              disabled={!storefrontName || connecting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {connecting ? 'Connecting...' : 'Connect Storefront'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getAccountIdentifierLabel(platform: string): string {
  if (platform.startsWith('amazon_')) return 'Amazon Associate Tag';
  if (platform === 'awin') return 'Awin Publisher ID';
  if (platform === 'ltk') return 'LTK Creator ID';
  return 'Account Identifier';
}

function getAccountIdentifierPlaceholder(platform: string): string {
  if (platform.startsWith('amazon_')) return 'yourtag-21';
  if (platform === 'awin') return '123456';
  if (platform === 'ltk') return 'your-ltk-id';
  return 'account-id';
}
