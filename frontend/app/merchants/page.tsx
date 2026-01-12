'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MerchantBadge } from '@/components/product-search';
import { cn } from '@/lib/utils';

interface MerchantConnection {
  merchant_key: string;
  merchant_name: string;
  is_connected: boolean;
  credentials?: {
    shopDomain?: string;
    accessToken?: string;
  };
}

interface MerchantConfig {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  requiresCredentials: boolean;
  credentialFields?: {
    name: string;
    label: string;
    type: string;
    placeholder: string;
  }[];
}

const MERCHANT_CONFIGS: MerchantConfig[] = [
  {
    key: 'amazon',
    name: 'Amazon',
    description: 'Search and import products from Amazon marketplace',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14.193 8.485c0 1.338-0.168 2.417-0.504 3.237-0.336 0.82-0.874 1.23-1.614 1.23-0.893 0-1.492-0.679-1.492-1.697 0-1.771 1.59-2.094 3.61-2.094v0.324z" />
      </svg>
    ),
    color: 'bg-orange-500',
    requiresCredentials: false,
  },
  {
    key: 'shopify',
    name: 'Shopify',
    description: 'Import products from your Shopify store',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.337 2.786c-.096-.083-.184-.096-.28-.096-.023 0-.513.012-.513.012l-2.476 2.498s-.256.21-.44.289c-.183.072-.396.083-.513.083-.12-.012-.268-.036-.28-.048L9.6 4.687C9.096 4.43 8.387 4.3 7.69 4.3c-.092 0-.184 0-.28.012-.012-.024-.024-.048-.036-.072C7.24 3.944 6.94 3.65 6.545 3.52c-.792-.263-1.584-.072-2.063.443z" />
      </svg>
    ),
    color: 'bg-green-600',
    requiresCredentials: true,
    credentialFields: [
      {
        name: 'shopDomain',
        label: 'Shop Domain',
        type: 'text',
        placeholder: 'mystore.myshopify.com',
      },
      {
        name: 'accessToken',
        label: 'Access Token',
        type: 'password',
        placeholder: 'shpat_...',
      },
    ],
  },
  {
    key: 'gumroad',
    name: 'Gumroad',
    description: 'Import digital products from your Gumroad account',
    icon: (
      <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M15.826 6.244c-.646-.547-1.471-.82-2.467-.82H8.668c-.257 0-.479.213-.479.48v11.79c0 .257.213.48.479.48h1.198c.266 0 .48-.213.48-.48V13.48h2.502c1.005 0 1.83-.274 2.476-.82z" />
      </svg>
    ),
    color: 'bg-pink-500',
    requiresCredentials: false,
  },
];

export default function MerchantsPage() {
  const [connections, setConnections] = useState<MerchantConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingMerchant, setConnectingMerchant] = useState<string | null>(
    null
  );
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [importingFrom, setImportingFrom] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/merchants/connections');
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async (merchantKey: string) => {
    setConnectingMerchant(merchantKey);

    try {
      const merchantConfig = MERCHANT_CONFIGS.find(
        (m) => m.key === merchantKey
      );

      if (merchantConfig?.requiresCredentials) {
        const creds = credentials[merchantKey];
        if (
          !creds ||
          !merchantConfig.credentialFields?.every((field) => creds[field.name])
        ) {
          alert('Please fill in all required credentials');
          return;
        }

        const response = await fetch('/api/merchants/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            merchant_key: merchantKey,
            credentials: creds,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to connect merchant');
        }
      }

      // Refresh connections
      await fetchConnections();
      setCredentials((prev) => {
        const next = { ...prev };
        delete next[merchantKey];
        return next;
      });
    } catch (error) {
      console.error('Connect error:', error);
      alert('Failed to connect merchant');
    } finally {
      setConnectingMerchant(null);
    }
  };

  const handleDisconnect = async (merchantKey: string) => {
    if (!confirm('Are you sure you want to disconnect this merchant?')) {
      return;
    }

    try {
      const response = await fetch('/api/merchants/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ merchant_key: merchantKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect merchant');
      }

      await fetchConnections();
    } catch (error) {
      console.error('Disconnect error:', error);
      alert('Failed to disconnect merchant');
    }
  };

  const handleImport = async (merchantKey: string) => {
    setImportingFrom(merchantKey);
    setImportResults((prev) => ({ ...prev, [merchantKey]: null }));

    try {
      const connection = connections.find((c) => c.merchant_key === merchantKey);
      const body: any = { source: merchantKey };

      if (merchantKey === 'shopify' && connection?.credentials) {
        body.credentials = connection.credentials;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}/api/products/import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': 'current-user-id', // TODO: Get from auth context
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const data = await response.json();
      setImportResults((prev) => ({
        ...prev,
        [merchantKey]: {
          success: true,
          imported: data.imported || 0,
          skipped: data.skipped || 0,
        },
      }));
    } catch (error) {
      console.error('Import error:', error);
      setImportResults((prev) => ({
        ...prev,
        [merchantKey]: { success: false, error: 'Import failed' },
      }));
    } finally {
      setImportingFrom(null);
    }
  };

  const updateCredential = (
    merchantKey: string,
    field: string,
    value: string
  ) => {
    setCredentials((prev) => ({
      ...prev,
      [merchantKey]: {
        ...prev[merchantKey],
        [field]: value,
      },
    }));
  };

  const isConnected = (merchantKey: string) => {
    return connections.some(
      (c) => c.merchant_key === merchantKey && c.is_connected
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mb-4 inline-block">
            <svg
              className="h-12 w-12 animate-spin text-purple-500"
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
          </div>
          <p className="text-lg font-medium text-white">Loading merchants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-white">
          Merchant Connections
        </h1>
        <p className="text-gray-400">
          Connect your merchant accounts to import and manage products
        </p>
      </div>

      {/* Merchants Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {MERCHANT_CONFIGS.map((merchant) => {
          const connected = isConnected(merchant.key);
          const importing = importingFrom === merchant.key;
          const result = importResults[merchant.key];

          return (
            <div
              key={merchant.key}
              className="flex flex-col overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50 backdrop-blur-sm"
            >
              {/* Header */}
              <div className="flex items-start gap-4 border-b border-gray-800 p-6">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-lg text-white',
                    merchant.color
                  )}
                >
                  {merchant.icon}
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {merchant.name}
                    </h3>
                    {connected && (
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-400">
                        Connected
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{merchant.description}</p>
                </div>
              </div>

              {/* Credentials Form */}
              {merchant.requiresCredentials && !connected && (
                <div className="space-y-4 p-6">
                  {merchant.credentialFields?.map((field) => (
                    <div key={field.name}>
                      <label className="mb-2 block text-sm font-medium text-gray-300">
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={
                          credentials[merchant.key]?.[field.name] || ''
                        }
                        onChange={(e) =>
                          updateCredential(
                            merchant.key,
                            field.name,
                            e.target.value
                          )
                        }
                        placeholder={field.placeholder}
                        className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-white placeholder:text-gray-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Import Results */}
              {result && (
                <div
                  className={cn(
                    'mx-6 mb-4 rounded-lg p-3 text-sm',
                    result.success
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  )}
                >
                  {result.success ? (
                    <>
                      Imported {result.imported} products
                      {result.skipped > 0 && ` (${result.skipped} skipped)`}
                    </>
                  ) : (
                    <>{result.error}</>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto flex gap-2 p-6 pt-0">
                {!connected ? (
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={() => handleConnect(merchant.key)}
                    disabled={connectingMerchant === merchant.key}
                  >
                    {connectingMerchant === merchant.key
                      ? 'Connecting...'
                      : 'Connect'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleImport(merchant.key)}
                      disabled={importing || !connected}
                    >
                      {importing ? 'Importing...' : 'Import Products'}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDisconnect(merchant.key)}
                    >
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
