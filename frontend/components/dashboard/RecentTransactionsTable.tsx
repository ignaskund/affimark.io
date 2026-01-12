'use client';

import { Calendar, TrendingUp } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_date: string;
  platform: string;
  product_name: string | null;
  clicks: number;
  orders: number;
  commission: number;
  original_currency: string;
  commission_eur: number;
}

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  currency: string;
}

const PLATFORM_LABELS: Record<string, { name: string; icon: string }> = {
  amazon_de: { name: 'Amazon DE', icon: '🇩🇪' },
  amazon_uk: { name: 'Amazon UK', icon: '🇬🇧' },
  amazon_us: { name: 'Amazon US', icon: '🇺🇸' },
  amazon_fr: { name: 'Amazon FR', icon: '🇫🇷' },
  amazon_es: { name: 'Amazon ES', icon: '🇪🇸' },
  amazon_it: { name: 'Amazon IT', icon: '🇮🇹' },
  awin: { name: 'Awin', icon: '🔗' },
  ltk: { name: 'LTK', icon: '💄' },
  shopmy: { name: 'ShopMy', icon: '🛍️' },
  tradedoubler: { name: 'Tradedoubler', icon: '🔗' },
};

export default function RecentTransactionsTable({ transactions, currency }: RecentTransactionsTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="text-center">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Transactions Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Upload your first CSV to see transaction history
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent Transactions
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Latest {transactions.length} earnings across all storefronts
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Platform
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Performance
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Commission
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {transactions.map((transaction) => {
              const platformInfo = PLATFORM_LABELS[transaction.platform] || {
                name: transaction.platform,
                icon: '🔗',
              };

              return (
                <tr
                  key={transaction.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(transaction.transaction_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{platformInfo.icon}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {platformInfo.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {transaction.product_name || 'Product Name Unavailable'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {transaction.clicks.toLocaleString()} clicks
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {transaction.orders} {transaction.orders === 1 ? 'order' : 'orders'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {currency === 'EUR' && '€'}
                      {currency === 'GBP' && '£'}
                      {currency === 'USD' && '$'}
                      {transaction.commission_eur.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    {transaction.original_currency !== currency && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {transaction.original_currency}{' '}
                        {transaction.commission.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/dashboard/transactions"
          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center justify-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          View all transactions →
        </a>
      </div>
    </div>
  );
}
