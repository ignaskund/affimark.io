/**
 * Alert Generator
 *
 * Monitors health scores and issues to create alerts.
 * Generates:
 * - Revenue health drop alerts
 * - Critical issue alerts
 * - Multiple failures alerts
 * - Weekly summary digests
 *
 * Respects user alert preferences (threshold, frequency, channels).
 */

import type {
  LinkHealthAlert,
  LinkHealthIssue,
  LinkAuditPreferences,
  AlertType,
  IssueSeverity,
  AlertChannel
} from '../../../LINK_AUDIT_TYPES';

interface AlertGeneratorOptions {
  supabaseUrl: string;
  supabaseKey: string;
}

interface AlertContext {
  userId: string;
  auditRunId?: string;
  currentScore: number;
  previousScore?: number;
  issues: LinkHealthIssue[];
  preferences: LinkAuditPreferences;
}

export class AlertGenerator {
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;

  constructor(options: AlertGeneratorOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseKey = options.supabaseKey;
  }

  /**
   * Generate alerts based on audit results
   */
  async generateAlerts(context: AlertContext): Promise<LinkHealthAlert[]> {
    const alerts: LinkHealthAlert[] = [];

    // 1. Check for revenue health drop
    if (this.shouldAlertHealthDrop(context)) {
      alerts.push(this.createHealthDropAlert(context));
    }

    // 2. Check for critical issues
    if (this.shouldAlertCriticalIssues(context)) {
      alerts.push(this.createCriticalIssuesAlert(context));
    }

    // 3. Check for multiple failures
    if (this.shouldAlertMultipleFailures(context)) {
      alerts.push(this.createMultipleFailuresAlert(context));
    }

    return alerts;
  }

  /**
   * Generate weekly summary alert
   */
  generateWeeklySummary(
    userId: string,
    scoreHistory: Array<{ score: number; timestamp: string }>,
    issuesResolved: number,
    issuesCreated: number,
    topIssues: LinkHealthIssue[]
  ): LinkHealthAlert {
    const currentScore = scoreHistory[scoreHistory.length - 1]?.score || 0;
    const previousScore = scoreHistory[0]?.score || currentScore;
    const scoreChange = currentScore - previousScore;

    let message = `Weekly Link Health Report\n\n`;
    message += `Current Health Score: ${currentScore}/100`;

    if (scoreChange !== 0) {
      const changeSign = scoreChange > 0 ? '+' : '';
      const emoji = scoreChange > 0 ? '📈' : '📉';
      message += ` (${changeSign}${scoreChange} ${emoji})`;
    }

    message += `\n\n`;
    message += `Activity:\n`;
    message += `• ${issuesResolved} issues resolved\n`;
    message += `• ${issuesCreated} new issues detected\n`;

    if (topIssues.length > 0) {
      message += `\nTop Issues:\n`;
      topIssues.slice(0, 3).forEach((issue, index) => {
        message += `${index + 1}. ${issue.title} (${issue.severity})\n`;
      });
    }

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      alert_type: 'weekly_summary',
      severity: 'info',
      title: 'Weekly Link Health Summary',
      message,
      issue_ids: topIssues.map(i => i.id),
      channels: ['email', 'in_app'],
      email_sent: false,
      in_app_read: false,
      alert_data: {
        current_score: currentScore,
        previous_score: previousScore,
        score_change: scoreChange,
        issues_resolved: issuesResolved,
        issues_created: issuesCreated
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Check if should alert on health drop
   */
  private shouldAlertHealthDrop(context: AlertContext): boolean {
    if (!context.previousScore) return false;

    const scoreDrop = context.previousScore - context.currentScore;

    // Alert if score dropped by more than 10 points
    if (scoreDrop > 10) return true;

    // Alert if score fell below user's threshold
    if (context.currentScore < context.preferences.min_health_score_alert) {
      return true;
    }

    return false;
  }

  /**
   * Create health drop alert
   */
  private createHealthDropAlert(context: AlertContext): LinkHealthAlert {
    const scoreDrop = (context.previousScore || 0) - context.currentScore;

    return {
      id: crypto.randomUUID(),
      user_id: context.userId,
      audit_run_id: context.auditRunId,
      alert_type: 'revenue_health_drop',
      severity: scoreDrop > 20 ? 'critical' : 'warning',
      title: 'Revenue Health Score Dropped',
      message: `Your Revenue Health Score dropped from ${context.previousScore} to ${context.currentScore} (-${scoreDrop} points). This may indicate new issues with your links.`,
      issue_ids: context.issues.filter(i => i.severity === 'critical').map(i => i.id),
      channels: this.getChannels(context.preferences, 'critical'),
      email_sent: false,
      in_app_read: false,
      alert_data: {
        previous_score: context.previousScore,
        current_score: context.currentScore,
        score_drop: scoreDrop
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Check if should alert on critical issues
   */
  private shouldAlertCriticalIssues(context: AlertContext): boolean {
    const threshold = context.preferences.alert_threshold;

    if (threshold === 'all') {
      return context.issues.length > 0;
    } else if (threshold === 'critical_and_warning') {
      return context.issues.some(i => i.severity === 'critical' || i.severity === 'warning');
    } else if (threshold === 'critical') {
      return context.issues.some(i => i.severity === 'critical');
    }

    return false;
  }

  /**
   * Create critical issues alert
   */
  private createCriticalIssuesAlert(context: AlertContext): LinkHealthAlert {
    const criticalIssues = context.issues.filter(i => i.severity === 'critical');
    const warningIssues = context.issues.filter(i => i.severity === 'warning');

    let message = '';

    if (criticalIssues.length > 0) {
      message += `🚨 ${criticalIssues.length} critical issue(s) detected:\n`;
      criticalIssues.slice(0, 3).forEach(issue => {
        message += `• ${issue.title}\n`;
      });
    }

    if (warningIssues.length > 0 && context.preferences.alert_threshold !== 'critical') {
      message += `\n⚠️ ${warningIssues.length} warning(s):\n`;
      warningIssues.slice(0, 2).forEach(issue => {
        message += `• ${issue.title}\n`;
      });
    }

    return {
      id: crypto.randomUUID(),
      user_id: context.userId,
      audit_run_id: context.auditRunId,
      alert_type: 'critical_issue',
      severity: criticalIssues.length > 0 ? 'critical' : 'warning',
      title: `${criticalIssues.length + warningIssues.length} New Issue(s) Detected`,
      message,
      issue_ids: [...criticalIssues, ...warningIssues].map(i => i.id),
      channels: this.getChannels(context.preferences, criticalIssues.length > 0 ? 'critical' : 'warning'),
      email_sent: false,
      in_app_read: false,
      alert_data: {
        critical_count: criticalIssues.length,
        warning_count: warningIssues.length
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Check if should alert on multiple failures
   */
  private shouldAlertMultipleFailures(context: AlertContext): boolean {
    const brokenLinks = context.issues.filter(i => i.issue_type === 'broken_link');
    return brokenLinks.length >= 3; // Alert if 3 or more links are broken
  }

  /**
   * Create multiple failures alert
   */
  private createMultipleFailuresAlert(context: AlertContext): LinkHealthAlert {
    const brokenLinks = context.issues.filter(i => i.issue_type === 'broken_link');

    return {
      id: crypto.randomUUID(),
      user_id: context.userId,
      audit_run_id: context.auditRunId,
      alert_type: 'multiple_failures',
      severity: 'critical',
      title: 'Multiple Broken Links Detected',
      message: `${brokenLinks.length} of your links are currently broken. This may significantly impact your revenue.`,
      issue_ids: brokenLinks.map(i => i.id),
      channels: this.getChannels(context.preferences, 'critical'),
      email_sent: false,
      in_app_read: false,
      alert_data: {
        broken_count: brokenLinks.length
      },
      created_at: new Date().toISOString()
    };
  }

  /**
   * Get alert channels based on preferences and severity
   */
  private getChannels(
    preferences: LinkAuditPreferences,
    severity: 'critical' | 'warning' | 'info'
  ): AlertChannel[] {
    const channels: AlertChannel[] = ['in_app']; // Always show in-app

    if (preferences.email_alerts_enabled) {
      if (severity === 'critical') {
        channels.push('email');
      } else if (severity === 'warning' && preferences.alert_threshold !== 'critical') {
        channels.push('email');
      }
    }

    return channels;
  }

  /**
   * Check if user should receive alerts based on frequency
   */
  async shouldSendAlert(
    userId: string,
    alertType: AlertType
  ): Promise<boolean> {
    // TODO: Implement with Supabase - check last alert sent time
    // For weekly summary, check if it's been 7 days
    // For immediate alerts, check if not already sent in last hour
    return true;
  }

  /**
   * Save alert to database
   */
  async saveAlert(alert: LinkHealthAlert): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Saving alert: ${alert.title}`);
  }

  /**
   * Mark alert as sent
   */
  async markAlertSent(
    alertId: string,
    channel: AlertChannel
  ): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Marking alert ${alertId} as sent via ${channel}`);
  }
}
