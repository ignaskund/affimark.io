'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

export default function CreateSmartWrapperPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    linkLabel: '',
    productName: '',
    merchantName: '',
    affiliateNetwork: '',
    isAutopilotEnabled: true,
    destinations: [
      { url: '', priority: 1, retailer: '' },
    ],
  });

  const addDestination = () => {
    setFormData({
      ...formData,
      destinations: [
        ...formData.destinations,
        { url: '', priority: formData.destinations.length + 1, retailer: '' },
      ],
    });
  };

  const removeDestination = (index: number) => {
    setFormData({
      ...formData,
      destinations: formData.destinations.filter((_, i) => i !== index),
    });
  };

  const updateDestination = (index: number, field: string, value: string) => {
    const newDestinations = [...formData.destinations];
    newDestinations[index] = { ...newDestinations[index], [field]: value };
    setFormData({ ...formData, destinations: newDestinations });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create SmartWrapper via API
      const response = await fetch('/api/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationUrl: formData.destinations[0].url, // Primary destination
          linkLabel: formData.linkLabel,
          productName: formData.productName,
          merchantName: formData.merchantName,
          affiliateNetwork: formData.affiliateNetwork,
          fallbackUrl: formData.destinations[1]?.url || null, // Secondary as fallback
          isAutopilotEnabled: formData.isAutopilotEnabled,
        }),
      });

      if (response.ok) {
        router.push('/smartwrappers');
      } else {
        alert('Failed to create SmartWrapper');
      }
    } catch (error) {
      console.error('Error creating SmartWrapper:', error);
      alert('Error creating SmartWrapper');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create SmartWrapper</h1>
          <p className="mt-1 text-sm text-gray-500">
            Set up intelligent routing with waterfall fallbacks
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Link Label
                </label>
                <input
                  type="text"
                  value={formData.linkLabel}
                  onChange={(e) => setFormData({ ...formData, linkLabel: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="My Camera Link"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Sony A7 IV Camera"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={formData.merchantName}
                    onChange={(e) => setFormData({ ...formData, merchantName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Amazon"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Affiliate Network
                  </label>
                  <input
                    type="text"
                    value={formData.affiliateNetwork}
                    onChange={(e) => setFormData({ ...formData, affiliateNetwork: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Amazon Associates"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Waterfall Destinations */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Waterfall Destinations</h2>
                <p className="text-sm text-gray-500">Traffic routes to Priority 1 first, then 2, then 3...</p>
              </div>
              <button
                type="button"
                onClick={addDestination}
                className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 font-medium rounded-lg hover:bg-indigo-100 transition-colors"
              >
                <Plus size={16} />
                Add Fallback
              </button>
            </div>

            <div className="space-y-4">
              {formData.destinations.map((dest, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Priority {index + 1} {index === 0 ? '(Primary)' : `(Fallback ${index})`}
                    </span>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeDestination(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Destination URL *
                      </label>
                      <input
                        type="url"
                        value={dest.url}
                        onChange={(e) => updateDestination(index, 'url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="https://amazon.com/dp/..."
                        required={index === 0}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Retailer (optional)
                      </label>
                      <input
                        type="text"
                        value={dest.retailer}
                        onChange={(e) => updateDestination(index, 'retailer', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Amazon, B&H Photo, etc."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autopilot Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Autopilot Settings</h2>
            
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="autopilot"
                checked={formData.isAutopilotEnabled}
                onChange={(e) => setFormData({ ...formData, isAutopilotEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <div>
                <label htmlFor="autopilot" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Enable Auto-Swapping
                </label>
                <p className="text-sm text-gray-500">
                  Automatically route to fallback URLs when primary destination goes out of stock or breaks
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.destinations[0].url}
              className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create SmartWrapper'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
