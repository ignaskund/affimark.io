'use client';

/**
 * Onboarding Step 4: Health Check Execution
 * Shows live progress as audit runs
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { runAudit, getAuditStatus } from '@/lib/api/audit-api';

export default function HealthCheckPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<'initializing' | 'running' | 'completed' | 'error'>('initializing');
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [auditRunId, setAuditRunId] = useState<string | null>(null);
  const [error, setError] = useState('');

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

  // Start audit when user ID is available
  useEffect(() => {
    if (!userId) return;

    async function startAudit() {
      setStatus('running');
      setCurrentStep('Crawling link page...');
      setProgress(10);

      try {
        // Run audit
        const result = await runAudit(userId!, 'full', true);

        if (!result.success) {
          setError(result.error || 'Failed to start audit');
          setStatus('error');
          return;
        }

        setAuditRunId(result.audit_run_id!);
        setProgress(30);
        setCurrentStep('Extracting links...');

        // Poll for audit completion
        pollAuditStatus(result.audit_run_id!);
      } catch (error) {
        console.error('Error starting audit:', error);
        setError('An unexpected error occurred');
        setStatus('error');
      }
    }

    startAudit();
  }, [userId]);

  // Poll audit status
  const pollAuditStatus = async (runId: string) => {
    const maxAttempts = 60; // 2 minutes max (2 second intervals)
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        setError('Audit is taking longer than expected. Please refresh the page.');
        setStatus('error');
        return;
      }

      try {
        const statusResult = await getAuditStatus(runId);

        if (!statusResult.success) {
          setError('Failed to check audit status');
          setStatus('error');
          return;
        }

        const auditRun = statusResult.audit_run;

        if (!auditRun) {
          setTimeout(checkStatus, 2000);
          return;
        }

        // Update progress based on status
        const statusProgress: Record<string, number> = {
          'pending': 20,
          'crawling': 40,
          'analyzing': 60,
          'completed': 100,
          'failed': 0,
        };

        const newProgress = statusProgress[auditRun.status] || progress;
        setProgress(newProgress);

        // Update current step
        const stepMessages: Record<string, string> = {
          'pending': 'Initializing audit...',
          'crawling': `Crawling link page... (${auditRun.links_found || 0} links found)`,
          'analyzing': `Analyzing link health... (${auditRun.links_checked || 0}/${auditRun.links_found || 0} checked)`,
          'completed': 'Analysis complete!',
          'failed': 'Audit failed',
        };

        setCurrentStep(stepMessages[auditRun.status] || 'Processing...');

        // Check if completed
        if (auditRun.status === 'completed') {
          setStatus('completed');
          setProgress(100);

          // Store audit run ID for results page
          localStorage.setItem('completed_audit_run_id', runId);

          // Redirect to results after a short delay
          setTimeout(() => {
            router.push('/onboarding/results');
          }, 1500);
          return;
        }

        if (auditRun.status === 'failed') {
          setError(auditRun.error_message || 'Audit failed');
          setStatus('error');
          return;
        }

        // Continue polling
        setTimeout(checkStatus, 2000);
      } catch (error) {
        console.error('Error checking status:', error);
        setTimeout(checkStatus, 2000);
      }
    };

    checkStatus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Scanning your links...
          </h1>
          <p className="text-gray-600">
            This usually takes 30-90 seconds
          </p>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {status !== 'error' ? (
            <div className="space-y-8">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">{currentStep}</span>
                  <span className="text-sm font-semibold text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 h-3 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                <ProgressStep
                  icon="🌐"
                  title="Crawling link page"
                  completed={progress > 20}
                  active={progress >= 10 && progress <= 40}
                />
                <ProgressStep
                  icon="🔗"
                  title="Extracting links"
                  completed={progress > 40}
                  active={progress > 30 && progress <= 60}
                />
                <ProgressStep
                  icon="❤️"
                  title="Checking link health"
                  completed={progress > 60}
                  active={progress > 50 && progress <= 80}
                />
                <ProgressStep
                  icon="📊"
                  title="Calculating health score"
                  completed={progress > 80}
                  active={progress > 70 && progress <= 100}
                />
                <ProgressStep
                  icon="✨"
                  title="Generating insights"
                  completed={progress === 100}
                  active={progress > 90}
                />
              </div>

              {/* Loading Animation */}
              {status === 'running' && (
                <div className="flex justify-center pt-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}

              {/* Completion */}
              {status === 'completed' && (
                <div className="text-center pt-4">
                  <div className="text-6xl mb-4">🎉</div>
                  <p className="text-lg font-semibold text-gray-900">
                    Health check complete!
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Redirecting to results...
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* Error State */
            <div className="text-center py-8">
              <div className="text-6xl mb-4">⚠️</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h3>
              <p className="text-gray-600 mb-6">{error}</p>
              <button
                onClick={() => router.push('/onboarding/link-setup')}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            We're analyzing your links for broken URLs, stock availability, missing affiliate tags, and more
          </p>
        </div>
      </div>
    </div>
  );
}

// Progress Step Component
function ProgressStep({
  icon,
  title,
  completed,
  active,
}: {
  icon: string;
  title: string;
  completed: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`
        flex items-center p-4 rounded-lg border-2 transition-all
        ${completed
          ? 'border-green-300 bg-green-50'
          : active
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-gray-200 bg-gray-50'
        }
      `}
    >
      <span className="text-2xl mr-4">{icon}</span>
      <span
        className={`
          font-medium
          ${completed ? 'text-green-700' : active ? 'text-indigo-700' : 'text-gray-500'}
        `}
      >
        {title}
      </span>
      {completed && (
        <svg
          className="w-6 h-6 ml-auto text-green-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {active && !completed && (
        <svg
          className="animate-spin w-6 h-6 ml-auto text-indigo-600"
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
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
    </div>
  );
}
