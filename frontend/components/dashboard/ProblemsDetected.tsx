'use client';

import { AlertCircle, ExternalLink, AlertTriangle, Info, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';

interface Issue {
  id: string;
  issue_type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  revenue_impact_estimate: number;
  confidence_score: number;
  created_at: string;
}

interface ProblemsDetectedProps {
  issues: Issue[];
  userId: string;
}

export default function ProblemsDetected({ issues }: ProblemsDetectedProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="text-red-600" size={20} />;
      case 'warning':
        return <AlertTriangle className="text-yellow-600" size={20} />;
      default:
        return <Info className="text-blue-600" size={20} />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return styles[severity as keyof typeof styles] || styles.info;
  };

  const formatIssueType = (type: string) => {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleCopyLink = (issueId: string) => {
    navigator.clipboard.writeText(window.location.origin + '/link-guard?issue=' + issueId);
    setCopiedId(issueId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (issues.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <Check className="text-green-600" size={32} />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">All Clear!</h3>
        <p className="text-gray-600">No problems detected. Your links are healthy.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Problems Detected</h2>
          <Link
            href="/link-guard"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            View All
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {issues.slice(0, 5).map((issue) => (
          <div key={issue.id} className="p-6 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1">{getSeverityIcon(issue.severity)}</div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{issue.title}</h3>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getSeverityBadge(
                          issue.severity
                        )}`}
                      >
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Type: {formatIssueType(issue.issue_type)}</span>
                      {issue.revenue_impact_estimate > 0 && (
                        <span className="text-red-600 font-medium">
                          Est. loss: ${issue.revenue_impact_estimate.toFixed(0)}/mo
                        </span>
                      )}
                      {issue.confidence_score && (
                        <span>Confidence: {Math.round(issue.confidence_score)}%</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/link-guard?issue=${issue.id}`}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                    >
                      Fix Now
                    </Link>
                    <button
                      onClick={() => handleCopyLink(issue.id)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      {copiedId === issue.id ? (
                        <>
                          <Check size={14} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          Share
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {issues.length > 5 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <Link
            href="/link-guard"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1"
          >
            View {issues.length - 5} more issues
            <ExternalLink size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}
