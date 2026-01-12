'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Youtube, Twitter, Music2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface SocialAccount {
  id: string;
  platform: 'youtube' | 'twitter' | 'tiktok';
  channel_name: string;
  follower_count: number;
  is_active: boolean;
}

interface SocialAccountSidebarProps {
  onAccountsChange?: (accounts: SocialAccount[]) => void;
}

export function SocialAccountSidebar({ onAccountsChange }: SocialAccountSidebarProps) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (onAccountsChange) {
      onAccountsChange(accounts);
    }
  }, [accounts, onAccountsChange]);

  const loadAccounts = async () => {
    try {
      const response = await fetch('/api/social-accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts || []);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (platform: 'youtube' | 'twitter' | 'tiktok') => {
    setConnecting(platform);
    
    try {
      // Redirect to OAuth flow
      if (platform === 'youtube') {
        window.location.href = '/api/auth/youtube/connect';
      } else if (platform === 'twitter') {
        window.location.href = '/api/auth/twitter/connect';
      } else if (platform === 'tiktok') {
        window.location.href = '/api/auth/tiktok/connect';
      }
    } catch (error) {
      console.error('Failed to connect:', error);
      setConnecting(null);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube':
        return <Youtube size={20} className="text-red-500" />;
      case 'twitter':
        return <Twitter size={20} className="text-blue-400" />;
      case 'tiktok':
        return <Music2 size={20} className="text-pink-500" />;
      default:
        return null;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="w-80 bg-gray-900 border-l border-gray-800 p-6 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-800 p-6 flex flex-col">
      <h2 className="text-lg font-bold text-white mb-6">Connected Accounts</h2>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="space-y-3 mb-6">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex items-center gap-3 mb-2">
                {getPlatformIcon(account.platform)}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{account.channel_name}</p>
                  <p className="text-xs text-gray-400">
                    {formatNumber(account.follower_count)} followers
                  </p>
                </div>
                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {accounts.length > 0 && (
        <Separator className="my-6" />
      )}

      {/* Connect New Accounts */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Add More Accounts</h3>
        
        {!accounts.some(a => a.platform === 'youtube') && (
          <Button
            onClick={() => handleConnect('youtube')}
            disabled={connecting === 'youtube'}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 justify-start gap-3"
          >
            {connecting === 'youtube' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Youtube size={20} className="text-red-500" />
            )}
            <span>Connect YouTube</span>
          </Button>
        )}

        {!accounts.some(a => a.platform === 'twitter') && (
          <Button
            onClick={() => handleConnect('twitter')}
            disabled={connecting === 'twitter'}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 justify-start gap-3"
          >
            {connecting === 'twitter' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Twitter size={20} className="text-blue-400" />
            )}
            <span>Connect Twitter/X</span>
          </Button>
        )}

        {!accounts.some(a => a.platform === 'tiktok') && (
          <Button
            onClick={() => handleConnect('tiktok')}
            disabled={connecting === 'tiktok'}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 justify-start gap-3"
          >
            {connecting === 'tiktok' ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Music2 size={20} className="text-pink-500" />
            )}
            <span>Connect TikTok</span>
          </Button>
        )}
      </div>

      {accounts.length === 0 && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-300 mb-1">No accounts connected</p>
              <p className="text-xs text-gray-500">
                Connect your social media accounts to unlock insights, analytics, and personalized product recommendations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-auto pt-6">
        <p className="text-xs text-gray-500 leading-relaxed">
          Your accounts are secure and encrypted. We only access data you explicitly share.
        </p>
      </div>
    </div>
  );
}

