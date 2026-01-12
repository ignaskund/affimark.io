'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  ArrowLeft,
  MousePointerClick,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface ProductAnalytics {
  product_id: string;
  product_name: string;
  total_clicks: number;
  total_conversions: number;
  total_revenue: number;
  total_commission: number;
  conversion_rate: number;
  average_order_value: number;
  clicks_by_day: Array<{ date: string; clicks: number }>;
  conversions_by_day: Array<{ date: string; conversions: number; revenue: number }>;
  clicks_by_source: Array<{ source: string; clicks: number }>;
  clicks_by_hour: Array<{ hour: number; clicks: number }>;
}

const COLORS = ['#A855F7', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function ProductAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;

  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth check
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data.session) {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      } else {
        setAuthStatus('authenticated');
        setUserId(data.session.user.id);
      }
    }

    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        setAuthStatus('authenticated');
        setUserId(session.user.id);
      } else {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  // Fetch product analytics
  useEffect(() => {
    if (authStatus === 'authenticated' && userId && productId) {
      fetchProductAnalytics();
    }
  }, [authStatus, userId, productId]);

  const fetchProductAnalytics = async () => {
    setIsLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
      const response = await fetch(`${backendUrl}/api/analytics/product/${productId}`, {
        headers: {
          'x-user-id': userId!,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAnalytics(data.analytics);
      } else {
        router.push('/analytics');
      }
    } catch (error) {
      console.error('Failed to fetch product analytics:', error);
      router.push('/analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  const formatHour = (hour: number) => {
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}${suffix}`;
  };

  if (authStatus === 'loading' || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return null;
  }

  if (!analytics) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <p className="text-gray-400">Product analytics not available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/analytics')}
            className="mb-4 text-gray-400 hover:text-white"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Analytics
          </Button>
          <h1 className="mb-2 text-3xl font-bold text-white">{analytics.product_name}</h1>
          <p className="text-gray-400">Detailed product performance insights</p>
        </div>

        {/* Overview Cards */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Clicks */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Total Clicks</CardTitle>
              <MousePointerClick className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{analytics.total_clicks}</div>
            </CardContent>
          </Card>

          {/* Conversions */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Conversions</CardTitle>
              <ShoppingCart className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{analytics.total_conversions}</div>
              <p className="text-xs text-gray-400">
                {formatPercentage(analytics.conversion_rate)} conversion rate
              </p>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(analytics.total_revenue)}
              </div>
              <p className="text-xs text-gray-400">
                {formatCurrency(analytics.average_order_value)} avg order
              </p>
            </CardContent>
          </Card>

          {/* Commission */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-400">Commission</CardTitle>
              <TrendingUp className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(analytics.total_commission)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Clicks Over Time */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">Click Activity</CardTitle>
              <CardDescription className="text-gray-400">
                Daily click patterns for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.clicks_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Line type="monotone" dataKey="clicks" stroke="#A855F7" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Conversions Over Time */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">Conversion Timeline</CardTitle>
              <CardDescription className="text-gray-400">
                When conversions happened
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.conversions_by_day}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                  <Bar dataKey="conversions" fill="#10B981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Clicks by Hour */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">Click Heatmap by Hour</CardTitle>
              <CardDescription className="text-gray-400">
                Best times of day for this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.clicks_by_hour}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="hour"
                    stroke="#9CA3AF"
                    tickFormatter={formatHour}
                  />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    labelFormatter={formatHour}
                  />
                  <Bar dataKey="clicks" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Clicks by Source */}
          <Card className="border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">Traffic Sources</CardTitle>
              <CardDescription className="text-gray-400">
                Where clicks are coming from
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.clicks_by_source}
                    dataKey="clicks"
                    nameKey="source"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {analytics.clicks_by_source.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                    labelStyle={{ color: '#F3F4F6' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Traffic Sources Table */}
        <Card className="mb-8 border-gray-800 bg-gray-900">
          <CardHeader>
            <CardTitle className="text-white">Traffic Source Breakdown</CardTitle>
            <CardDescription className="text-gray-400">
              Detailed view of where your clicks originate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
                    <th className="pb-3">Source</th>
                    <th className="pb-3 text-right">Clicks</th>
                    <th className="pb-3 text-right">Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.clicks_by_source.map((source, index) => {
                    const percentage = (source.clicks / analytics.total_clicks) * 100;
                    return (
                      <tr
                        key={index}
                        className="border-b border-gray-800 text-white hover:bg-gray-800/50"
                      >
                        <td className="py-3 flex items-center">
                          <div
                            className="mr-3 h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {source.source}
                        </td>
                        <td className="py-3 text-right">{source.clicks}</td>
                        <td className="py-3 text-right">{formatPercentage(percentage)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Insights & Recommendations */}
        <Card className="border-gray-800 bg-gray-900">
          <CardHeader>
            <CardTitle className="text-white">Insights & Recommendations</CardTitle>
            <CardDescription className="text-gray-400">
              AI-powered suggestions to improve performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.conversion_rate < 2 && (
                <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-4">
                  <p className="text-sm text-yellow-400">
                    <strong>Low Conversion Rate:</strong> This product has high clicks but low conversions.
                    Consider improving product descriptions, adding discount codes, or featuring it in
                    different content.
                  </p>
                </div>
              )}

              {analytics.conversion_rate >= 5 && (
                <div className="rounded-lg border border-green-800 bg-green-900/20 p-4">
                  <p className="text-sm text-green-400">
                    <strong>High Performer:</strong> This product has an excellent conversion rate!
                    Consider featuring it more prominently in your content and shop.
                  </p>
                </div>
              )}

              {analytics.clicks_by_hour.some(h => h.clicks > analytics.total_clicks * 0.1) && (
                <div className="rounded-lg border border-blue-800 bg-blue-900/20 p-4">
                  <p className="text-sm text-blue-400">
                    <strong>Peak Hours Detected:</strong> Most clicks happen during specific times.
                    Schedule content featuring this product during peak traffic hours for better results.
                  </p>
                </div>
              )}

              {analytics.clicks_by_source[0]?.clicks > analytics.total_clicks * 0.5 && (
                <div className="rounded-lg border border-purple-800 bg-purple-900/20 p-4">
                  <p className="text-sm text-purple-400">
                    <strong>Single Source Dominance:</strong> Most traffic comes from one source (
                    {analytics.clicks_by_source[0]?.source}). Diversify by promoting on other platforms.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
