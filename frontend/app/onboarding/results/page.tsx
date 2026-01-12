'use client';

/**
 * Onboarding Step 5: Results Screen (The "Aha" Moment)
 * Shows Revenue Health Score and top issues
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { getRevenueHealthDashboard } from '@/lib/api/audit-api';

export default function ResultsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<any>(null);

  // Get current user
  useEffect(() => {
    async function getUser() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/onboarding/signup');
        return;
      }

      setUserId(user.id);
    }
    getUser();
  }, [router]);

  // Load dashboard data
  useEffect(() => {
    if (!userId) return;

    async function loadResults() {
      setLoading(true);
      const data = await getRevenueHealthDashboard(userId!);
      setDashboard(data);
      setLoading(false);
    }

    loadResults();
  }, [userId]);

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get score emoji
  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    return '🔴';
  };

  // Get score description
  const getScoreDescription = (score: number) => {
    if (score >= 90) return 'Excellent! Your links are in great shape.';
    if (score >= 70) return 'Good, but there is room for improvement.';
    return 'Needs attention - revenue is being lost.';
  };

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading results...</p>
        </div>
      </div>
    );
  }

  const score = dashboard.health_score || 0;
  const lossLow = Math.floor(dashboard.estimated_monthly_loss * 0.8);
  const lossHigh = Math.ceil(dashboard.estimated_monthly_loss * 1.2);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Your Revenue Health Report
          </h1>
          <p className="text-gray-600">
            Here's what we found
          </p>
        </div>

        {/* Health Score Hero */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8 text-center">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Your Revenue Health Score
          </p>

          <div className="flex items-center justify-center mb-6">
            <span className="text-8xl mr-4">{getScoreEmoji(score)}</span>
            <div className="text-left">
              <div className={`text-7xl font-bold ${getScoreColor(score)}`}>
                {score}
                <span className="text-4xl">/100</span>
              </div>
              {dashboard.score_trend && (
                <p className={`text-sm font-semibold mt-2 ${
                  dashboard.score_trend === 'up' ? 'text-green-600' :
                  dashboard.score_trend === 'down' ? 'text-red-600' :
                  'text-gray-500'
                }`}>
                  {dashboard.score_trend === 'up' && '↑ Improving'}
                  {dashboard.score_trend === 'down' && '↓ Declining'}
                  {dashboard.score_trend === 'stable' && '→ Stable'}
                  {dashboard.score_change !== 0 && ` (${dashboard.score_change > 0 ? '+' : ''}${dashboard.score_change} points)`}
                </p>
              )}
            </div>
          </div>

          <p className="text-xl text-gray-700 mb-8">
            {getScoreDescription(score)}
          </p>

          {/* Revenue Loss */}
          {dashboard.estimated_monthly_loss > 0 && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6">
              <p className="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
                Estimated Monthly Loss
              </p>
              <p className="text-4xl font-bold text-red-600 mb-2">
                €{lossLow}–€{lossHigh}
              </p>
              <p className="text-sm text-red-600">
                from broken and unoptimized links
              </p>
            </div>
          )}

          {dashboard.estimated_monthly_loss === 0 && score >= 90 && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
              <p className="text-2xl font-bold text-green-600 mb-2">
                🎉 All Links Are Healthy!
              </p>
              <p className="text-sm text-green-600">
                No revenue loss detected. Great job!
              </p>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Total Links</p>
            <p className="text-4xl font-bold text-gray-900 mb-1">{dashboard.links_total}</p>
            <p className="text-sm text-gray-600">{dashboard.links_healthy} healthy</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Critical Issues</p>
            <p className="text-4xl font-bold text-red-600 mb-1">{dashboard.issues_by_severity.critical}</p>
            <p className="text-sm text-gray-600">Require immediate action</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-sm font-medium text-gray-500 mb-2">Warnings</p>
            <p className="text-4xl font-bold text-yellow-600 mb-1">{dashboard.issues_by_severity.warning}</p>
            <p className="text-sm text-gray-600">Need attention soon</p>
          </div>
        </div>

        {/* Top 3 Issues */}
        {dashboard.top_issues.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              🚨 Critical Issues Detected
            </h2>

            <div className="space-y-4">
              {dashboard.top_issues.slice(0, 3).map((issue: any, index: number) => (
                <div
                  key={issue.id}
                  className="flex items-start p-4 bg-red-50 border-2 border-red-200 rounded-xl"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold mr-4">
                    {index + 1}
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-bold text-gray-900 mb-1">{issue.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                    {issue.revenue_impact_estimate && (
                      <p className="text-sm font-semibold text-red-600">
                        Lost revenue: ~€{issue.revenue_impact_estimate}/month
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call to Action */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl shadow-2xl p-8 text-center text-white mb-8">
          <h2 className="text-3xl font-bold mb-4">
            Ready to protect your revenue?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Get daily health checks and instant alerts when issues arise
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-8 py-4 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all text-lg"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => router.push('/settings')}
              className="px-8 py-4 bg-indigo-500 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-400 transition-all text-lg"
            >
              Set Up Alerts
            </button>
          </div>
        </div>

        {/* Social Proof */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Join 1,247 creators protecting €124K in monthly affiliate revenue
          </p>
          <div className="flex justify-center items-center space-x-6 text-sm text-gray-500">
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              24/7 monitoring
            </span>
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Instant alerts
            </span>
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Free forever
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
