/**
 * SmartWrapper Analytics Page
 *
 * Performance metrics for individual SmartWrapper:
 * - Click trends chart
 * - Device breakdown
 * - Geographic distribution
 * - UTM source performance
 * - Priority chain performance
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, Smartphone, Globe, Tag, Target, DollarSign, ShoppingCart } from 'lucide-react';

interface SmartWrapper {
  id: string;
  short_code: string;
  link_label: string;
  click_count: number;
}

interface ConversionMetrics {
  totalConversions: number;
  totalRevenue: number;
  totalCommission: number;
  avgOrderValue: number;
  conversionRate: number;
}

interface ClickStat {
  date: string;
  total_clicks: number;
  mobile_clicks: number;
  desktop_clicks: number;
  tablet_clicks: number;
}

interface DeviceStats {
  mobile: { count: number; percentage: string };
  desktop: { count: number; percentage: string };
  tablet: { count: number; percentage: string };
}

interface CountryStats {
  country: string;
  count: number;
  percentage: string;
}

interface UtmSource {
  source: string;
  count: number;
  percentage: string;
}

interface PriorityPerformance {
  priority: number;
  retailer: string;
  url: string;
  healthStatus: string;
  clicks: number;
  percentage: string;
}

export default function SmartWrapperAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [smartwrapper, setSmartWrapper] = useState<SmartWrapper | null>(null);
  const [period, setPeriod] = useState('30d');
  const [clickStats, setClickStats] = useState<ClickStat[]>([]);
  const [deviceStats, setDeviceStats] = useState<DeviceStats | null>(null);
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [utmSources, setUtmSources] = useState<UtmSource[]>([]);
  const [priorityPerformance, setPriorityPerformance] = useState<PriorityPerformance[]>([]);
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics | null>(null);

  // Load all analytics data
  useEffect(() => {
    async function loadAnalytics() {
      setLoading(true);

      // Load SmartWrapper
      const swResponse = await fetch(`/api/smartwrappers/${id}`);
      if (swResponse.ok) {
        const swData = await swResponse.json();
        setSmartWrapper(swData.smartwrapper);
      }

      // Load all analytics in parallel
      const [clicks, devices, geography, utm, priority, conversions] = await Promise.all([
        fetch(`/api/analytics/smartwrappers/${id}/clicks?period=${period}`).then((r) => r.json()),
        fetch(`/api/analytics/smartwrappers/${id}/devices`).then((r) => r.json()),
        fetch(`/api/analytics/smartwrappers/${id}/geography`).then((r) => r.json()),
        fetch(`/api/analytics/smartwrappers/${id}/utm-sources`).then((r) => r.json()),
        fetch(`/api/analytics/smartwrappers/${id}/priority-performance`).then((r) => r.json()),
        fetch(`/api/conversions/smartwrappers/${id}/conversions?period=${period}`).then((r) => r.json()).catch(() => ({ metrics: null })),
      ]);

      setClickStats(clicks.stats || []);
      setDeviceStats(devices.devices || null);
      setCountryStats(geography.countries || []);
      setUtmSources(utm.sources || []);
      setPriorityPerformance(priority.performance || []);
      setConversionMetrics(conversions.metrics || null);

      setLoading(false);
    }

    loadAnalytics();
  }, [id, period]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!smartwrapper) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
              <p className="mt-1 text-gray-600">{smartwrapper.link_label}</p>
              <p className="text-sm text-gray-500">
                <code className="bg-gray-100 px-2 py-1 rounded">
                  go.affimark.com/{smartwrapper.short_code}
                </code>
              </p>
            </div>

            {/* Period Selector */}
            <div className="flex gap-2">
              {['7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    period === p
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p === '7d' && 'Last 7 Days'}
                  {p === '30d' && 'Last 30 Days'}
                  {p === '90d' && 'Last 90 Days'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Conversion Metrics Cards */}
        {conversionMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            {/* Total Conversions */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingCart className="text-green-600" size={18} />
                <p className="text-sm text-gray-600 font-medium">Conversions</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{conversionMetrics.totalConversions}</p>
              <p className="text-xs text-gray-500 mt-1">Total sales</p>
            </div>

            {/* Total Revenue */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="text-blue-600" size={18} />
                <p className="text-sm text-gray-600 font-medium">Revenue</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">${conversionMetrics.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Total sales value</p>
            </div>

            {/* Total Commission */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="text-green-600" size={18} />
                <p className="text-sm text-gray-600 font-medium">Commission</p>
              </div>
              <p className="text-2xl font-bold text-green-600">${conversionMetrics.totalCommission.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Your earnings</p>
            </div>

            {/* Average Order Value */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="text-purple-600" size={18} />
                <p className="text-sm text-gray-600 font-medium">Avg Order</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">${conversionMetrics.avgOrderValue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">Average value</p>
            </div>

            {/* Conversion Rate */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="text-indigo-600" size={18} />
                <p className="text-sm text-gray-600 font-medium">CVR</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">{conversionMetrics.conversionRate.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-1">Click to conversion</p>
            </div>
          </div>
        )}

        {/* Click Trends Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-indigo-600" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Click Trends</h2>
          </div>

          <div className="h-64 flex items-end gap-2">
            {clickStats.map((stat, index) => {
              const maxClicks = Math.max(...clickStats.map((s) => s.total_clicks));
              const height = maxClicks > 0 ? (stat.total_clicks / maxClicks) * 100 : 0;

              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-indigo-500 rounded-t hover:bg-indigo-600 transition-colors relative group"
                    style={{ height: `${height}%`, minHeight: stat.total_clicks > 0 ? '4px' : '0' }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {stat.total_clicks} clicks
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>

          {clickStats.length === 0 && (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No click data for this period
            </div>
          )}
        </div>

        {/* Device Breakdown & Geography */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Device Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Smartphone className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Device Breakdown</h2>
            </div>

            {deviceStats && (
              <div className="space-y-4">
                {Object.entries(deviceStats).map(([device, stats]) => (
                  <div key={device}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 capitalize">{device}</span>
                      <span className="text-gray-600">{stats.count} ({stats.percentage})</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          device === 'mobile' ? 'bg-blue-500' : device === 'desktop' ? 'bg-green-500' : 'bg-purple-500'
                        }`}
                        style={{ width: stats.percentage }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Geographic Distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Top Countries</h2>
            </div>

            {countryStats.length > 0 ? (
              <div className="space-y-3">
                {countryStats.slice(0, 5).map((country) => (
                  <div key={country.country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getCountryFlag(country.country)}</span>
                      <span className="font-medium text-gray-700">{country.country}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {country.count} ({country.percentage})
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No geographic data yet</p>
            )}
          </div>
        </div>

        {/* UTM Sources & Priority Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* UTM Sources */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Tag className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Top UTM Sources</h2>
            </div>

            {utmSources.length > 0 ? (
              <div className="space-y-3">
                {utmSources.slice(0, 5).map((source) => (
                  <div key={source.source} className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">{source.source}</span>
                    <div className="text-sm text-gray-600">
                      {source.count} ({source.percentage})
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No UTM tracking data yet</p>
            )}
          </div>

          {/* Priority Chain Performance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="text-indigo-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Priority Performance</h2>
            </div>

            {priorityPerformance.length > 0 ? (
              <div className="space-y-3">
                {priorityPerformance.map((dest) => (
                  <div key={dest.priority}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">#{dest.priority}</span>
                        <span className="text-sm text-gray-700">{dest.retailer || 'Unknown'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          dest.healthStatus === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {dest.healthStatus}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {dest.clicks} ({dest.percentage})
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: dest.percentage }}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No destination performance data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper: Get country flag emoji
function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}
