'use client';

/**
 * Health Overview Component
 * Hero section with Revenue Health Score and quick stats
 */

interface HealthOverviewProps {
  healthScore: number;
  scoreTrend: 'up' | 'down' | 'stable';
  scoreChange: number;
  estimatedMonthlyLoss: number;
  linksTotal: number;
  linksHealthy: number;
  linksBroken: number;
  criticalIssues: number;
  className?: string;
}

export function HealthOverview({
  healthScore,
  scoreTrend,
  scoreChange,
  estimatedMonthlyLoss,
  linksTotal,
  linksHealthy,
  linksBroken,
  criticalIssues,
  className = '',
}: HealthOverviewProps) {
  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get score background
  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-[var(--color-success-soft)]';
    if (score >= 70) return 'bg-[var(--color-warning-soft)]';
    return 'bg-[var(--color-danger-soft)]';
  };

  // Get score emoji
  const getScoreEmoji = (score: number) => {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    return '🔴';
  };

  const scoreColor = getScoreColor(healthScore);
  const scoreBg = getScoreBg(healthScore);

  return (
    <div className={className}>
      {/* Hero Score Card */}
      <div className={`${scoreBg} rounded-2xl shadow-lg p-8 mb-6`}>
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Score */}
          <div className="flex items-center mb-6 md:mb-0">
            <span className="text-6xl mr-4">{getScoreEmoji(healthScore)}</span>
            <div>
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Revenue Health Score
              </p>
              <div className={`text-6xl font-bold ${scoreColor}`}>
                {healthScore}
                <span className="text-3xl">/100</span>
              </div>
              {scoreTrend !== 'stable' && (
                <p className={`text-sm font-semibold mt-2 ${scoreTrend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                  {scoreTrend === 'up' && '↑'}
                  {scoreTrend === 'down' && '↓'}
                  {scoreChange > 0 ? '+' : ''}{scoreChange} points
                  {scoreTrend === 'up' ? ' improvement' : ' decline'}
                </p>
              )}
            </div>
          </div>

          {/* Revenue Loss */}
          {estimatedMonthlyLoss > 0 && (
            <div className="text-center md:text-right">
              <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Estimated Monthly Loss
              </p>
              <p className="text-4xl font-bold text-red-600 mb-1">
                €{Math.floor(estimatedMonthlyLoss)}
              </p>
              <p className="text-sm text-gray-600">
                from current issues
              </p>
            </div>
          )}

          {estimatedMonthlyLoss === 0 && healthScore >= 90 && (
            <div className="text-center md:text-right">
              <p className="text-2xl font-bold text-green-600 mb-1">
                🎉 Perfect Health!
              </p>
              <p className="text-sm text-green-600">
                No revenue loss detected
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Links"
          value={linksTotal}
          sublabel={`${linksHealthy} healthy`}
          icon="🔗"
          color="blue"
        />
        <StatCard
          label="Healthy Links"
          value={linksHealthy}
          sublabel={`${Math.round((linksHealthy / linksTotal) * 100)}% of total`}
          icon="✅"
          color="green"
        />
        <StatCard
          label="Broken Links"
          value={linksBroken}
          sublabel={linksBroken > 0 ? 'Need fixing' : 'All working'}
          icon="❌"
          color={linksBroken > 0 ? 'red' : 'gray'}
        />
        <StatCard
          label="Critical Issues"
          value={criticalIssues}
          sublabel={criticalIssues > 0 ? 'Immediate action' : 'None detected'}
          icon="🚨"
          color={criticalIssues > 0 ? 'red' : 'gray'}
        />
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  sublabel,
  icon,
  color,
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: string;
  color: 'blue' | 'green' | 'red' | 'gray';
}) {
  const colorClasses = {
    blue: 'border-[var(--color-info)]/20 bg-[var(--color-info-soft)]',
    green: 'border-[var(--color-success)]/20 bg-[var(--color-success-soft)]',
    red: 'border-[var(--color-danger)]/20 bg-[var(--color-danger-soft)]',
    gray: 'border-[var(--color-border)] bg-[var(--color-surface-2)]',
  };

  return (
    <div className={`bg-white rounded-lg border-2 ${colorClasses[color]} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
      <p className="text-xs text-gray-500">{sublabel}</p>
    </div>
  );
}
