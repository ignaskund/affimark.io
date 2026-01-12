/**
 * SmartWrapper Edit Page
 *
 * Edit SmartWrapper with priority chain builder
 * - Update basic info (name, product, merchant)
 * - Manage priority chain (add/remove/reorder destinations)
 * - Toggle autopilot
 * - View health status
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, AlertCircle } from 'lucide-react';

interface Destination {
  id: string;
  priority: number;
  destination_url: string;
  retailer: string;
  affiliate_tag: string;
  commission_rate: number;
  health_status: string;
}

interface SmartWrapper {
  id: string;
  short_code: string;
  link_label: string;
  product_name: string;
  merchant_name: string;
  affiliate_network: string;
  fallback_url: string;
  is_autopilot_enabled: boolean;
  click_count: number;
  destinations: Destination[];
}

export default function EditSmartWrapperPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [smartwrapper, setSmartWrapper] = useState<SmartWrapper | null>(null);
  const [formData, setFormData] = useState({
    linkLabel: '',
    productName: '',
    merchantName: '',
    affiliateNetwork: '',
    failsafeUrl: '',
    isAutopilotEnabled: true,
  });
  const [destinations, setDestinations] = useState<Destination[]>([]);

  // Load SmartWrapper
  useEffect(() => {
    async function loadSmartWrapper() {
      const response = await fetch(`/api/smartwrappers/${id}`);
      if (response.ok) {
        const data = await response.json();
        const sw = data.smartwrapper;

        setSmartWrapper(sw);
        setFormData({
          linkLabel: sw.link_label || '',
          productName: sw.product_name || '',
          merchantName: sw.merchant_name || '',
          affiliateNetwork: sw.affiliate_network || '',
          failsafeUrl: sw.fallback_url || '',
          isAutopilotEnabled: sw.is_autopilot_enabled,
        });
        setDestinations(sw.destinations || []);
      } else {
        alert('Failed to load SmartWrapper');
        router.push('/smartwrappers');
      }
      setLoading(false);
    }

    loadSmartWrapper();
  }, [id, router]);

  // Add new destination
  const addDestination = () => {
    setDestinations([
      ...destinations,
      {
        id: `temp-${Date.now()}`,
        priority: destinations.length + 1,
        destination_url: '',
        retailer: '',
        affiliate_tag: '',
        commission_rate: 0,
        health_status: 'unknown',
      },
    ]);
  };

  // Remove destination
  const removeDestination = (index: number) => {
    const newDestinations = destinations.filter((_, i) => i !== index);
    // Reorder priorities
    newDestinations.forEach((dest, i) => {
      dest.priority = i + 1;
    });
    setDestinations(newDestinations);
  };

  // Update destination field
  const updateDestination = (index: number, field: string, value: any) => {
    const newDestinations = [...destinations];
    (newDestinations[index] as any)[field] = value;
    setDestinations(newDestinations);
  };

  // Save changes
  const handleSave = async () => {
    setSaving(true);

    try {
      // Update basic info
      const updateResponse = await fetch(`/api/smartwrappers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.linkLabel,
          productName: formData.productName,
          merchantName: formData.merchantName,
          affiliateNetwork: formData.affiliateNetwork,
          failsafeUrl: formData.failsafeUrl,
          isAutopilotEnabled: formData.isAutopilotEnabled,
        }),
      });

      if (!updateResponse.ok) {
        throw new Error('Failed to update SmartWrapper');
      }

      // Update destinations (create/update/delete)
      for (const dest of destinations) {
        if (dest.id.startsWith('temp-')) {
          // Create new destination
          await fetch(`/api/smartwrappers/${id}/destinations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              priority: dest.priority,
              url: dest.destination_url,
              retailer: dest.retailer,
              affiliate_tag: dest.affiliate_tag,
              commission_rate: dest.commission_rate,
            }),
          });
        } else {
          // Update existing destination
          await fetch(`/api/smartwrappers/${id}/destinations/${dest.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              priority: dest.priority,
              url: dest.destination_url,
              retailer: dest.retailer,
              affiliate_tag: dest.affiliate_tag,
              commission_rate: dest.commission_rate,
            }),
          });
        }
      }

      alert('SmartWrapper updated successfully!');
      router.push('/smartwrappers');
    } catch (error) {
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SmartWrapper...</p>
        </div>
      </div>
    );
  }

  if (!smartwrapper) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/smartwrappers')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft size={20} />
            Back to SmartWrappers
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit SmartWrapper</h1>
              <p className="mt-1 text-sm text-gray-600">
                <code className="bg-gray-100 px-2 py-1 rounded">
                  go.affimark.com/{smartwrapper.short_code}
                </code>
                {' • '}
                {smartwrapper.click_count || 0} clicks
              </p>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Basic Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link Label
              </label>
              <input
                type="text"
                value={formData.linkLabel}
                onChange={(e) => setFormData({ ...formData, linkLabel: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="My Favorite Product"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="iPhone 15 Pro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Merchant Name
              </label>
              <input
                type="text"
                value={formData.merchantName}
                onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Amazon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Affiliate Network
              </label>
              <input
                type="text"
                value={formData.affiliateNetwork}
                onChange={(e) => setFormData({ ...formData, affiliateNetwork: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Amazon Associates"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAutopilotEnabled}
                onChange={(e) => setFormData({ ...formData, isAutopilotEnabled: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Enable Autopilot (automatic waterfall routing)
              </span>
            </label>
          </div>
        </div>

        {/* Priority Chain */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Priority Chain</h2>
              <p className="text-sm text-gray-600">Waterfall routing through destinations in order</p>
            </div>

            <button
              onClick={addDestination}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow hover:bg-indigo-700"
            >
              <Plus size={18} />
              Add Destination
            </button>
          </div>

          <div className="space-y-4">
            {destinations.map((dest, index) => (
              <div
                key={dest.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Drag Handle (future feature) */}
                  <div className="flex flex-col items-center justify-center pt-2">
                    <GripVertical size={20} className="text-gray-400" />
                    <span className="text-sm font-bold text-gray-700 mt-1">
                      {index + 1}
                    </span>
                  </div>

                  {/* Destination Fields */}
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Destination URL {index === 0 && '(Primary)'}
                      </label>
                      <input
                        type="url"
                        value={dest.destination_url}
                        onChange={(e) => updateDestination(index, 'destination_url', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://amazon.com/dp/..."
                        required={index === 0}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Retailer
                      </label>
                      <input
                        type="text"
                        value={dest.retailer}
                        onChange={(e) => updateDestination(index, 'retailer', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="Amazon"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Affiliate Tag
                      </label>
                      <input
                        type="text"
                        value={dest.affiliate_tag}
                        onChange={(e) => updateDestination(index, 'affiliate_tag', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        placeholder="yourtaghere-20"
                      />
                    </div>

                    {/* Health Status Badge */}
                    {dest.health_status !== 'unknown' && (
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          dest.health_status === 'healthy'
                            ? 'bg-green-100 text-green-800'
                            : dest.health_status === 'out_of_stock'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {dest.health_status === 'healthy' && '✓ Healthy'}
                          {dest.health_status === 'out_of_stock' && '⚠️ Out of Stock'}
                          {dest.health_status === 'broken' && '✗ Broken'}
                          {dest.health_status === 'tag_missing' && '⚠️ Tag Missing'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {index > 0 && (
                    <button
                      onClick={() => removeDestination(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {destinations.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                <AlertCircle className="mx-auto mb-2 text-gray-400" size={32} />
                <p className="text-gray-600">No destinations yet. Add your first destination above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
