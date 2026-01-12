/**
 * Health Scorer
 *
 * Calculates Revenue Health Score (0-100) based on:
 * - Percentage of healthy links
 * - Critical issues (-10 points each)
 * - Broken links (-5 points each)
 * - Stock-out links
 * - Commission rates
 *
 * Provides trend analysis and revenue impact estimates.
 */

import type {
  LinkHealthStatus,
  LinkHealthIssue,
  IssueSeverity
} from '../../../LINK_AUDIT_TYPES';

interface HealthScoreBreakdown {
  overall_score: number; // 0-100
  healthy_links_score: number; // 50% weight
  critical_issues_penalty: number; // 30% weight (negative)
  broken_links_penalty: number; // 20% weight (negative)

  // Stats
  total_links: number;
  healthy_links: number;
  broken_links: number;
  stock_out_links: number;
  untagged_links: number;

  // Issue counts
  critical_issues: number;
  warning_issues: number;
  info_issues: number;

  // Trend
  trend: 'improving' | 'stable' | 'declining';
  score_change: number; // +/- points from previous score

  // Revenue impact
  estimated_monthly_loss: number; // USD
}

interface HealthHistoryPoint {
  score: number;
  timestamp: string;
}

export class HealthScorer {
  /**
   * Calculate comprehensive health score
   */
  calculate(
    links: LinkHealthStatus[],
    issues: LinkHealthIssue[],
    previousScore?: number
  ): HealthScoreBreakdown {
    if (links.length === 0) {
      return {
        overall_score: 100,
        healthy_links_score: 50,
        critical_issues_penalty: 0,
        broken_links_penalty: 0,
        total_links: 0,
        healthy_links: 0,
        broken_links: 0,
        stock_out_links: 0,
        untagged_links: 0,
        critical_issues: 0,
        warning_issues: 0,
        info_issues: 0,
        trend: 'stable',
        score_change: 0,
        estimated_monthly_loss: 0
      };
    }

    // Count link health states
    const totalLinks = links.length;
    const healthyLinks = links.filter(l =>
      !l.is_broken &&
      !l.is_stock_out &&
      l.health_score >= 80
    ).length;
    const brokenLinks = links.filter(l => l.is_broken).length;
    const stockOutLinks = links.filter(l => l.is_stock_out).length;
    const untaggedLinks = links.filter(l => l.health_score < 80 && !l.is_broken && !l.is_stock_out).length;

    // Count issues by severity
    const openIssues = issues.filter(i => i.status === 'open');
    const criticalIssues = openIssues.filter(i => i.severity === 'critical').length;
    const warningIssues = openIssues.filter(i => i.severity === 'warning').length;
    const infoIssues = openIssues.filter(i => i.severity === 'info').length;

    // Calculate score components

    // 1. Healthy links percentage (50% weight)
    const healthyPercentage = healthyLinks / totalLinks;
    const healthyLinksScore = healthyPercentage * 50;

    // 2. Critical issues penalty (30% weight, -10 points each)
    const criticalIssuesPenalty = Math.min(30, criticalIssues * 10);

    // 3. Broken links penalty (20% weight, -5 points each)
    const brokenLinksPenalty = Math.min(20, brokenLinks * 5);

    // Calculate overall score
    const overallScore = Math.max(
      0,
      Math.min(
        100,
        healthyLinksScore + (30 - criticalIssuesPenalty) + (20 - brokenLinksPenalty)
      )
    );

    // Determine trend
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    let scoreChange = 0;

    if (previousScore !== undefined) {
      scoreChange = overallScore - previousScore;
      if (scoreChange > 5) trend = 'improving';
      else if (scoreChange < -5) trend = 'declining';
    }

    // Estimate monthly revenue loss
    const estimatedMonthlyLoss = this.estimateRevenueLoss(links, issues);

    return {
      overall_score: Math.round(overallScore * 100) / 100,
      healthy_links_score: Math.round(healthyLinksScore * 100) / 100,
      critical_issues_penalty: criticalIssuesPenalty,
      broken_links_penalty: brokenLinksPenalty,
      total_links: totalLinks,
      healthy_links: healthyLinks,
      broken_links: brokenLinks,
      stock_out_links: stockOutLinks,
      untagged_links: untaggedLinks,
      critical_issues: criticalIssues,
      warning_issues: warningIssues,
      info_issues: infoIssues,
      trend,
      score_change: Math.round(scoreChange * 100) / 100,
      estimated_monthly_loss: Math.round(estimatedMonthlyLoss * 100) / 100
    };
  }

  /**
   * Estimate monthly revenue loss from issues
   */
  private estimateRevenueLoss(
    links: LinkHealthStatus[],
    issues: LinkHealthIssue[]
  ): number {
    let totalLoss = 0;

    // Add up revenue_impact_estimate from all open issues
    const openIssues = issues.filter(i => i.status === 'open');
    for (const issue of openIssues) {
      if (issue.revenue_impact_estimate) {
        totalLoss += issue.revenue_impact_estimate;
      }
    }

    // If no estimates available, use heuristics
    if (totalLoss === 0) {
      const brokenLinks = links.filter(l => l.is_broken).length;
      const stockOutLinks = links.filter(l => l.is_stock_out).length;

      // Estimate $50/month per broken link, $30/month per stock-out
      totalLoss = (brokenLinks * 50) + (stockOutLinks * 30);
    }

    return totalLoss;
  }

  /**
   * Analyze health trend over time
   */
  analyzeTrend(history: HealthHistoryPoint[]): {
    direction: 'improving' | 'stable' | 'declining';
    velocity: number; // points per week
    forecast_30_days: number;
  } {
    if (history.length < 2) {
      return {
        direction: 'stable',
        velocity: 0,
        forecast_30_days: history[0]?.score || 100
      };
    }

    // Sort by timestamp (oldest first)
    const sorted = [...history].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate average change per day
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const daysDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const scoreDiff = last.score - first.score;

    if (daysDiff === 0) {
      return {
        direction: 'stable',
        velocity: 0,
        forecast_30_days: last.score
      };
    }

    const changePerDay = scoreDiff / daysDiff;
    const velocityPerWeek = changePerDay * 7;

    // Determine direction
    let direction: 'improving' | 'stable' | 'declining' = 'stable';
    if (velocityPerWeek > 2) direction = 'improving';
    else if (velocityPerWeek < -2) direction = 'declining';

    // Forecast 30 days out
    const forecast30Days = Math.max(0, Math.min(100, last.score + (changePerDay * 30)));

    return {
      direction,
      velocity: Math.round(velocityPerWeek * 100) / 100,
      forecast_30_days: Math.round(forecast30Days * 100) / 100
    };
  }

  /**
   * Get top issues by revenue impact
   */
  getTopIssues(issues: LinkHealthIssue[], limit: number = 5): LinkHealthIssue[] {
    return issues
      .filter(i => i.status === 'open')
      .sort((a, b) => {
        const impactA = a.revenue_impact_estimate || 0;
        const impactB = b.revenue_impact_estimate || 0;
        if (impactA !== impactB) return impactB - impactA;

        // If same impact, sort by severity
        const severityOrder = { critical: 3, warning: 2, info: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      })
      .slice(0, limit);
  }

  /**
   * Calculate health score for a single link
   */
  calculateLinkScore(link: LinkHealthStatus): number {
    let score = 100;

    // Broken link = 0
    if (link.is_broken) {
      return 0;
    }

    // Stock out = 20
    if (link.is_stock_out) {
      score = Math.min(score, 20);
    }

    // Excessive redirects
    if (link.redirect_count > 5) {
      score -= 20;
    } else if (link.redirect_count > 3) {
      score -= 10;
    }

    // Slow response time
    if (link.response_time_ms && link.response_time_ms > 5000) {
      score -= 15;
    } else if (link.response_time_ms && link.response_time_ms > 3000) {
      score -= 5;
    }

    // Destination drift
    if (link.has_drift) {
      score -= 15;
    }

    // Low commission (if detected)
    if (link.has_low_commission) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get health score color/badge
   */
  getScoreBadge(score: number): {
    color: 'green' | 'yellow' | 'red';
    label: string;
    emoji: string;
  } {
    if (score >= 80) {
      return {
        color: 'green',
        label: 'Healthy',
        emoji: '✅'
      };
    } else if (score >= 50) {
      return {
        color: 'yellow',
        label: 'Needs Attention',
        emoji: '⚠️'
      };
    } else {
      return {
        color: 'red',
        label: 'Critical',
        emoji: '🚨'
      };
    }
  }

  /**
   * Generate health score summary message
   */
  generateSummary(breakdown: HealthScoreBreakdown): string {
    const badge = this.getScoreBadge(breakdown.overall_score);
    const trend = breakdown.trend === 'improving' ? '📈' : breakdown.trend === 'declining' ? '📉' : '➡️';

    let message = `${badge.emoji} Revenue Health Score: ${breakdown.overall_score}/100 (${badge.label}) ${trend}\n\n`;

    message += `Links: ${breakdown.healthy_links}/${breakdown.total_links} healthy`;

    if (breakdown.broken_links > 0) {
      message += `, ${breakdown.broken_links} broken`;
    }
    if (breakdown.stock_out_links > 0) {
      message += `, ${breakdown.stock_out_links} out of stock`;
    }

    message += `\n\nIssues: ${breakdown.critical_issues} critical, ${breakdown.warning_issues} warnings`;

    if (breakdown.estimated_monthly_loss > 0) {
      message += `\n\nEstimated monthly revenue loss: $${breakdown.estimated_monthly_loss.toFixed(2)}`;
    }

    if (breakdown.score_change !== 0) {
      const changeSign = breakdown.score_change > 0 ? '+' : '';
      message += `\n\nChange from last audit: ${changeSign}${breakdown.score_change} points`;
    }

    return message;
  }
}
