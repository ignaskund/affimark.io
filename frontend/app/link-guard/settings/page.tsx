'use client';

/**
 * Link Guard Settings Page
 * Configure automation preferences and audit settings
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function LinkGuardSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Settings state
  const [autoAuditEnabled, setAutoAuditEnabled] = useState(true);
  const [auditFrequency, setAuditFrequency] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState<'all' | 'critical' | 'critical_and_warning'>('critical');
  const [weeklySummaryEnabled, setWeeklySummaryEnabled] = useState(true);
  const [autoFixEnabled, setAutoFixEnabled] = useState(false);
  const [autoFixTypes, setAutoFixTypes] = useState<string[]>([]);
  const [minHealthScore, setMinHealthScore] = useState(70);
  const [revenueImpactThreshold, setRevenueImpactThreshold] = useState(100);

  // Get current user
  useEffect(() => {
    async function getUser() {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        await loadSettings(user.id);
      } else {
        router.push('/sign-in');
      }
    }
    getUser();
  }, [router]);

  const loadSettings = async (uid: string) => {
    try {
      const supabase = createBrowserClient();
      const { data, error } = await supabase
        .from('link_audit_preferences')
        .select('*')
        .eq('user_id', uid)
        .single();

      if (data && !error) {
        setAutoAuditEnabled(data.auto_audit_enabled ?? true);
        setAuditFrequency(data.audit_frequency || 'daily');
        setEmailAlertsEnabled(data.email_alerts_enabled ?? true);
        setAlertThreshold(data.alert_threshold || 'critical');
        setWeeklySummaryEnabled(data.weekly_summary_enabled ?? true);
        setAutoFixEnabled(data.auto_fix_enabled ?? false);
        setAutoFixTypes(data.auto_fix_types || []);
        setMinHealthScore(data.min_health_score_alert || 70);
        setRevenueImpactThreshold(data.revenue_impact_threshold || 100);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const supabase = createBrowserClient();

      const { error } = await supabase
        .from('link_audit_preferences')
        .upsert({
          user_id: userId,
          auto_audit_enabled: autoAuditEnabled,
          audit_frequency: auditFrequency,
          email_alerts_enabled: emailAlertsEnabled,
          alert_threshold: alertThreshold,
          weekly_summary_enabled: weeklySummaryEnabled,
          auto_fix_enabled: autoFixEnabled,
          auto_fix_types: autoFixTypes,
          min_health_score_alert: minHealthScore,
          revenue_impact_threshold: revenueImpactThreshold,
          updated_at: new Date().toISOString()
        });

      if (error) {
        alert('Failed to save settings: ' + error.message);
      } else {
        alert('Settings saved successfully!');
      }
    } catch (error) {
      alert('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleAutoFixType = (type: string) => {
    if (autoFixTypes.includes(type)) {
      setAutoFixTypes(autoFixTypes.filter(t => t !== type));
    } else {
      setAutoFixTypes([...autoFixTypes, type]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/link-guard-dashboard')}
            className="text-indigo-600 hover:text-indigo-700 mb-4 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Link Guard Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure automation, alerts, and audit preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Audit Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Audit Settings</h2>

            {/* Auto Audit */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Automatic Audits</h3>
                <p className="text-sm text-gray-600">
                  Automatically run health checks on your links
                </p>
              </div>
              <button
                onClick={() => setAutoAuditEnabled(!autoAuditEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoAuditEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoAuditEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Audit Frequency */}
            {autoAuditEnabled && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Audit Frequency
                </label>
                <select
                  value={auditFrequency}
                  onChange={(e) => setAuditFrequency(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="hourly">Every Hour</option>
                  <option value="daily">Daily (Recommended)</option>
                  <option value="weekly">Weekly</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Daily audits run at 6 AM UTC. More frequent audits use more API credits.
                </p>
              </div>
            )}
          </div>

          {/* Alert Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Alert Settings</h2>

            {/* Email Alerts */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Email Alerts</h3>
                <p className="text-sm text-gray-600">
                  Get notified when critical issues are detected
                </p>
              </div>
              <button
                onClick={() => setEmailAlertsEnabled(!emailAlertsEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailAlertsEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailAlertsEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Alert Threshold */}
            {emailAlertsEnabled && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Alert Priority
                </label>
                <select
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="critical">Critical Issues Only</option>
                  <option value="critical_and_warning">Critical & Warning Issues</option>
                  <option value="all">All Issues</option>
                </select>
              </div>
            )}

            {/* Weekly Summary */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Weekly Summary</h3>
                <p className="text-sm text-gray-600">
                  Receive a weekly report of your link health
                </p>
              </div>
              <button
                onClick={() => setWeeklySummaryEnabled(!weeklySummaryEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  weeklySummaryEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    weeklySummaryEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Health Score Threshold */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Alert if Health Score Drops Below: {minHealthScore}
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={minHealthScore}
                onChange={(e) => setMinHealthScore(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Revenue Impact Threshold */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Alert if Estimated Loss Exceeds: €{revenueImpactThreshold}/month
              </label>
              <input
                type="range"
                min="0"
                max="500"
                step="10"
                value={revenueImpactThreshold}
                onChange={(e) => setRevenueImpactThreshold(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>€0</span>
                <span>€250</span>
                <span>€500</span>
              </div>
            </div>
          </div>

          {/* Auto-Fix Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Auto-Fix Settings</h2>
            <p className="text-sm text-gray-600 mb-4">
              ⚠️ <strong>Beta Feature:</strong> Automated fixes require your approval before being applied.
            </p>

            {/* Enable Auto-Fix */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">Enable Auto-Fix</h3>
                <p className="text-sm text-gray-600">
                  Automatically generate fixes for detected issues
                </p>
              </div>
              <button
                onClick={() => setAutoFixEnabled(!autoFixEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  autoFixEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    autoFixEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Auto-Fix Types */}
            {autoFixEnabled && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  Select Issue Types to Auto-Fix:
                </label>
                <div className="space-y-3">
                  {[
                    { id: 'broken_links', label: 'Broken Links', description: 'Replace broken links with working alternatives' },
                    { id: 'stock_updates', label: 'Out of Stock Products', description: 'Switch to in-stock alternatives' },
                    { id: 'low_commission', label: 'Low Commission Links', description: 'Upgrade to higher-paying programs' },
                    { id: 'destination_drift', label: 'Destination Drift', description: 'Update links pointing to wrong products' },
                  ].map((type) => (
                    <label
                      key={type.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={autoFixTypes.includes(type.id)}
                        onChange={() => toggleAutoFixType(type.id)}
                        className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{type.label}</p>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  💡 All fixes will be sent to your Approval Queue before being applied
                </p>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => router.push('/link-guard-dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 shadow-lg"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
