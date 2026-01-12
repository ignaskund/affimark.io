'use client';

/**
 * Health Score Card Component
 *
 * Displays the Revenue Health Score (0-100) with:
 * - Large circular score indicator
 * - Color-coded by score (red < 50, yellow 50-80, green > 80)
 * - Trend arrow (up/down/stable)
 * - Last audited timestamp
 */

interface HealthScoreCardProps {
  score: number; // 0-100
  trend?: 'up' | 'down' | 'stable';
  scoreChange?: number;
  lastAuditedAt?: string;
  className?: string;
}

export function HealthScoreCard({
  score,
  trend = 'stable',
  scoreChange = 0,
  lastAuditedAt,
  className = ''
}: HealthScoreCardProps) {
  // Determine color based on score
  const getScoreColor = () => {
    if (score >= 80) return { bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', stroke: 'stroke-green-600' };
    if (score >= 50) return { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-600/20', stroke: 'stroke-yellow-600' };
    return { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/20', stroke: 'stroke-red-600' };
  };

  const colors = getScoreColor();

  // Determine badge label
  const getBadgeLabel = () => {
    if (score >= 80) return { text: 'Healthy', emoji: '✅' };
    if (score >= 50) return { text: 'Needs Attention', emoji: '⚠️' };
    return { text: 'Critical', emoji: '🚨' };
  };

  const badge = getBadgeLabel();

  // Trend emoji
  const trendEmoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '➡️';

  // Calculate circle stroke dash array for progress
  const circumference = 2 * Math.PI * 90; // radius = 90
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={`rounded-lg border ${colors.bg} p-6 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-gray-700">Revenue Health Score</h3>
          <p className="text-xs text-gray-500 mt-1">
            {lastAuditedAt ? `Last audited ${formatTimestamp(lastAuditedAt)}` : 'Never audited'}
          </p>
        </div>
        <span className="text-2xl">{badge.emoji}</span>
      </div>

      <div className="flex items-center justify-between">
        {/* Circular Score Indicator */}
        <div className="relative">
          <svg className="transform -rotate-90" width="140" height="140">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="12"
            />
            {/* Progress circle */}
            <circle
              cx="70"
              cy="70"
              r="60"
              fill="none"
              className={colors.stroke}
              strokeWidth="12"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold ${colors.text}`}>{Math.round(score)}</span>
            <span className="text-sm text-gray-500">/100</span>
          </div>
        </div>

        {/* Status Details */}
        <div className="flex flex-col items-end space-y-2">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
            {badge.text}
          </div>

          {scoreChange !== 0 && (
            <div className="flex items-center space-x-1 text-sm">
              <span className="text-2xl">{trendEmoji}</span>
              <span className={scoreChange > 0 ? 'text-green-600' : 'text-red-600'}>
                {scoreChange > 0 ? '+' : ''}{scoreChange.toFixed(1)} pts
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}
