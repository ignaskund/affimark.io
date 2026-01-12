'use client';

import { useState } from 'react';
import {
  Store,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Settings,
  Trash2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import CSVUploadModal from './CSVUploadModal';

interface ConnectedAccount {
  id: string;
  platform: string;
  storefront_name: string | null;
  account_identifier: string | null;
  region: string | null;
  sync_status: 'pending' | 'syncing' | 'success' | 'error';
  sync_error: string | null;
  last_sync_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface ConnectedAccountsListProps {
  accounts: ConnectedAccount[];
}

const PLATFORM_LABELS: Record<string, { name: string; icon: string }> = {
  amazon_de: { name: 'Amazon Germany', icon: '🇩🇪' },
  amazon_uk: { name: 'Amazon UK', icon: '🇬🇧' },
  amazon_us: { name: 'Amazon US', icon: '🇺🇸' },
  amazon_fr: { name: 'Amazon France', icon: '🇫🇷' },
  amazon_es: { name: 'Amazon Spain', icon: '🇪🇸' },
  amazon_it: { name: 'Amazon Italy', icon: '🇮🇹' },
  awin: { name: 'Awin', icon: '🔗' },
  ltk: { name: 'LTK (RewardStyle)', icon: '💄' },
  shopmy: { name: 'ShopMy', icon: '🛍️' },
  tradedoubler: { name: 'Tradedoubler', icon: '🔗' },
};

export default function ConnectedAccountsList({ accounts }: ConnectedAccountsListProps) {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ConnectedAccount | null>(null);

  const handleUploadClick = (account: ConnectedAccount) => {
    setSelectedAccount(account);
    setUploadModalOpen(true);
  };

  return (
    <>
      <div className="grid gap-4">
        {accounts.map((account) => (
          <ConnectedAccountCard
            key={account.id}
            account={account}
            onUploadClick={() => handleUploadClick(account)}
          />
        ))}
      </div>

      {selectedAccount && (
        <CSVUploadModal
          isOpen={uploadModalOpen}
          onClose={() => {
            setUploadModalOpen(false);
            setSelectedAccount(null);
          }}
          account={selectedAccount}
        />
      )}
    </>
  );
}

function ConnectedAccountCard({
  account,
  onUploadClick,
}: {
  account: ConnectedAccount;
  onUploadClick: () => void;
}) {
  const platformInfo = PLATFORM_LABELS[account.platform] || {
    name: account.platform,
    icon: '🔗',
  };

  const statusConfig = {
    pending: { color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-700', icon: Calendar },
    syncing: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900', icon: Loader2 },
    success: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900', icon: CheckCircle2 },
    error: { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900', icon: AlertCircle },
  };

  const status = statusConfig[account.sync_status];
  const StatusIcon = status.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="text-4xl">{platformInfo.icon}</div>

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {account.storefront_name || platformInfo.name}
              </h3>
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}
              >
                <StatusIcon className={`h-3.5 w-3.5 ${account.sync_status === 'syncing' ? 'animate-spin' : ''}`} />
                {account.sync_status}
              </div>
            </div>

            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {platformInfo.name}
              {account.region && ` • ${account.region}`}
              {account.account_identifier && (
                <span className="ml-2 font-mono text-xs">({account.account_identifier})</span>
              )}
            </div>

            {account.last_sync_at && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                Last synced {formatDistanceToNow(new Date(account.last_sync_at), { addSuffix: true })}
              </div>
            )}

            {account.sync_error && (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                {account.sync_error}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onUploadClick}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </button>

          <button
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </button>

          <button
            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Delete"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
