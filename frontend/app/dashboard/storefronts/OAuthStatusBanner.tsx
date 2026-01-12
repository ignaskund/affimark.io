'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

interface OAuthStatusBannerProps {
  success?: string;
  error?: string;
}

const SUCCESS_MESSAGES: Record<string, string> = {
  tradedoubler_connected: 'Tradedoubler account connected successfully! Your transactions will sync automatically.',
  awin_connected: 'Awin account connected successfully! Your transactions will sync automatically.',
};

const ERROR_MESSAGES: Record<string, string> = {
  tradedoubler_oauth_denied: 'Authorization was denied. Please try again or use CSV upload instead.',
  awin_oauth_denied: 'Authorization was denied. Please try again or use CSV upload instead.',
  missing_params: 'OAuth callback failed. Please try connecting again.',
  token_exchange_failed: 'Failed to complete authentication. Please try again.',
  db_error: 'Failed to save your account. Please try connecting again.',
  callback_failed: 'Connection failed unexpectedly. Please try again.',
};

export default function OAuthStatusBanner({ success, error }: OAuthStatusBannerProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleDismiss = () => {
    setDismissed(true);
    // Clean up URL without the query params
    router.replace('/dashboard/storefronts', { scroll: false });
  };

  if (dismissed || (!success && !error)) {
    return null;
  }

  const isSuccess = !!success;
  const message = isSuccess 
    ? SUCCESS_MESSAGES[success] || 'Account connected successfully!'
    : ERROR_MESSAGES[error!] || 'An error occurred. Please try again.';

  return (
    <div 
      className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
        isSuccess 
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
      ) : (
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
      )}
      
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          isSuccess 
            ? 'text-green-800 dark:text-green-200'
            : 'text-red-800 dark:text-red-200'
        }`}>
          {isSuccess ? 'Connection Successful' : 'Connection Failed'}
        </p>
        <p className={`text-sm mt-1 ${
          isSuccess 
            ? 'text-green-700 dark:text-green-300'
            : 'text-red-700 dark:text-red-300'
        }`}>
          {message}
        </p>
      </div>

      <button
        onClick={handleDismiss}
        className={`p-1 rounded-lg transition-colors ${
          isSuccess 
            ? 'text-green-600 hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-800/50'
            : 'text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-800/50'
        }`}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

