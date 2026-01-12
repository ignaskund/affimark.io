/**
 * Issue Detector
 *
 * Analyzes link health data and creates LinkHealthIssue records.
 * Classifies severity (critical/warning/info) and generates evidence.
 * Creates recommendations for fixing each issue.
 */

import type {
  LinkHealthStatus,
  LinkHealthIssue,
  IssueRecommendation,
  IssueType,
  IssueSeverity,
  ActionType,
  ImplementationDifficulty
} from '../../../LINK_AUDIT_TYPES';

export class IssueDetector {
  /**
   * Detect all issues from link health status
   */
  detectIssues(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): {
    issues: LinkHealthIssue[];
    recommendations: IssueRecommendation[];
  } {
    const issues: LinkHealthIssue[] = [];
    const recommendations: IssueRecommendation[] = [];

    // 1. Broken link
    if (linkHealth.is_broken) {
      const issue = this.createBrokenLinkIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    // 2. Stock out
    if (linkHealth.is_stock_out) {
      const issue = this.createStockOutIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    // 3. Destination drift
    if (linkHealth.has_drift) {
      const issue = this.createDriftIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    // 4. Excessive redirects
    if (linkHealth.redirect_count > 5) {
      const issue = this.createRedirectDriftIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    // 5. Low commission (if detected)
    if (linkHealth.has_low_commission) {
      const issue = this.createLowCommissionIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    // 6. Slow link (affects user experience)
    if (linkHealth.response_time_ms && linkHealth.response_time_ms > 5000) {
      const issue = this.createSlowLinkIssue(userId, linkHealth, auditRunId);
      issues.push(issue);
      recommendations.push(...this.generateRecommendations(issue, linkHealth));
    }

    return { issues, recommendations };
  }

  /**
   * Create broken link issue
   */
  private createBrokenLinkIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    const statusCode = linkHealth.status_code || 0;
    let description = 'This link is broken and returns an error.';

    if (statusCode === 404) {
      description = 'Link returns 404 Not Found. The page may have been removed or the URL is incorrect.';
    } else if (statusCode === 403) {
      description = 'Link returns 403 Forbidden. Access to this page is restricted.';
    } else if (statusCode >= 500) {
      description = 'Link returns server error. The destination website may be experiencing technical issues.';
    } else if (statusCode === 0) {
      description = 'Link failed to load (timeout or connection error).';
    }

    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'broken_link',
      severity: 'critical',
      revenue_impact_estimate: 50, // $50/month estimate
      confidence_score: 100,
      title: 'Broken Link',
      description,
      evidence: {
        status_code: statusCode,
        link_url: linkHealth.link_url,
        redirect_chain: linkHealth.redirect_chain
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create stock-out issue
   */
  private createStockOutIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'stock_out',
      severity: 'critical',
      revenue_impact_estimate: 30,
      confidence_score: 85,
      title: 'Product Out of Stock',
      description: 'This product is currently unavailable. Users clicking this link will not be able to purchase.',
      evidence: {
        stock_status: linkHealth.stock_status,
        stock_checked_at: linkHealth.stock_checked_at,
        destination_url: linkHealth.destination_url
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create destination drift issue
   */
  private createDriftIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'destination_drift',
      severity: 'warning',
      revenue_impact_estimate: 15,
      confidence_score: 80,
      title: 'Destination Page Changed',
      description: 'The destination page content has changed significantly. This may indicate the link is redirecting to a different product.',
      evidence: {
        current_fingerprint: linkHealth.destination_fingerprint,
        destination_url: linkHealth.destination_url
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create excessive redirects issue
   */
  private createRedirectDriftIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'redirect_drift',
      severity: 'info',
      revenue_impact_estimate: 5,
      confidence_score: 100,
      title: 'Excessive Redirects',
      description: `This link has ${linkHealth.redirect_count} redirect hops, which may slow down the user experience and affect conversion rates.`,
      evidence: {
        redirect_count: linkHealth.redirect_count,
        redirect_chain: linkHealth.redirect_chain,
        total_time_ms: linkHealth.response_time_ms
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create low commission issue
   */
  private createLowCommissionIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'low_commission',
      severity: 'warning',
      revenue_impact_estimate: 20,
      confidence_score: 70,
      title: 'Low Commission Rate',
      description: 'This affiliate program has a low commission rate. There may be better alternatives available.',
      evidence: {
        destination_url: linkHealth.destination_url
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Create slow link issue
   */
  private createSlowLinkIssue(
    userId: string,
    linkHealth: LinkHealthStatus,
    auditRunId: string
  ): LinkHealthIssue {
    return {
      id: crypto.randomUUID(),
      user_id: userId,
      audit_run_id: auditRunId,
      link_health_id: linkHealth.id,
      issue_type: 'link_decay',
      severity: 'info',
      revenue_impact_estimate: 8,
      confidence_score: 90,
      title: 'Slow Link Response',
      description: `This link takes ${linkHealth.response_time_ms}ms to load, which may frustrate users and reduce conversions.`,
      evidence: {
        response_time_ms: linkHealth.response_time_ms,
        redirect_chain: linkHealth.redirect_chain
      },
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Generate recommendations for an issue
   */
  private generateRecommendations(
    issue: LinkHealthIssue,
    linkHealth: LinkHealthStatus
  ): IssueRecommendation[] {
    const recommendations: IssueRecommendation[] = [];

    switch (issue.issue_type) {
      case 'broken_link':
        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'remove_link',
          priority: 100,
          title: 'Remove Broken Link',
          description: 'Remove this link from your link-in-bio page to avoid poor user experience.',
          estimated_revenue_gain: 0,
          implementation_difficulty: 'easy',
          created_at: new Date().toISOString()
        });

        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'replace_link',
          priority: 90,
          title: 'Find Alternative Product',
          description: 'Search for an alternative product in the same category and replace this link.',
          estimated_revenue_gain: 50,
          implementation_difficulty: 'medium',
          created_at: new Date().toISOString()
        });
        break;

      case 'stock_out':
        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'replace_link',
          priority: 95,
          title: 'Find In-Stock Alternative',
          description: 'Search for the same or similar product from a different merchant that has it in stock.',
          estimated_revenue_gain: 30,
          implementation_difficulty: 'medium',
          created_at: new Date().toISOString()
        });

        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'add_backup',
          priority: 80,
          title: 'Add Backup Link',
          description: 'Keep this link but add a backup product link below it in case stock returns.',
          estimated_revenue_gain: 15,
          implementation_difficulty: 'easy',
          created_at: new Date().toISOString()
        });
        break;

      case 'destination_drift':
        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'replace_link',
          priority: 70,
          title: 'Verify Destination',
          description: 'Check if the link is still pointing to the correct product and update if needed.',
          estimated_revenue_gain: 15,
          implementation_difficulty: 'easy',
          created_at: new Date().toISOString()
        });
        break;

      case 'redirect_drift':
        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'replace_link',
          priority: 50,
          title: 'Shorten Redirect Chain',
          description: 'Use a direct link to the final destination to improve load times.',
          estimated_revenue_gain: 5,
          implementation_difficulty: 'medium',
          created_at: new Date().toISOString()
        });
        break;

      case 'low_commission':
        recommendations.push({
          id: crypto.randomUUID(),
          issue_id: issue.id,
          action_type: 'switch_program',
          priority: 75,
          title: 'Switch to Higher Commission Program',
          description: 'Search for the same product in affiliate networks with better commission rates.',
          estimated_revenue_gain: 20,
          implementation_difficulty: 'medium',
          action_payload: {
            current_url: linkHealth.destination_url
          },
          created_at: new Date().toISOString()
        });
        break;
    }

    return recommendations;
  }

  /**
   * Classify issue severity based on revenue impact
   */
  classifySeverity(revenueImpact: number): IssueSeverity {
    if (revenueImpact >= 30) return 'critical';
    if (revenueImpact >= 10) return 'warning';
    return 'info';
  }

  /**
   * Calculate confidence score for an issue
   */
  calculateConfidence(evidence: Record<string, any>): number {
    // Simple heuristic - can be improved with ML
    let confidence = 50;

    if (evidence.status_code) confidence += 50; // Direct HTTP error
    if (evidence.stock_status === 'out_of_stock') confidence += 35;
    if (evidence.redirect_count) confidence += 20;

    return Math.min(100, confidence);
  }
}
