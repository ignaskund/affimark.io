/**
 * Link Audit Orchestrator
 *
 * Coordinates the complete link audit process:
 * 1. Fetch tracked link pages for a user
 * 2. Crawl each page to extract links
 * 3. Run all detectors (redirect, stock, monetization, fingerprint) in parallel
 * 4. Aggregate results into link_health_status records
 * 5. Detect issues and create link_health_issues records
 * 6. Calculate revenue health score
 * 7. Generate alerts if needed
 */

import { LinkCrawler } from './link-crawler';
import { RedirectResolver } from './redirect-resolver';
import { StockChecker } from './stock-checker';
import { MonetizationDetector } from './monetization-detector';
import { DestinationFingerprinter } from './destination-fingerprinter';
import type {
  LinkAuditRun,
  LinkHealthStatus,
  LinkHealthIssue,
  AuditType,
  IssueType,
  IssueSeverity
} from '../../../LINK_AUDIT_TYPES';

interface OrchestratorOptions {
  supabaseUrl: string;
  supabaseKey: string;
  rainforestApiKey?: string;
  serpApiKey?: string;
  impactAccountSid?: string;
  impactAuthToken?: string;
}

interface LinkToAudit {
  url: string;
  tracked_page_id: string;
  previous_health?: LinkHealthStatus;
}

export class LinkAuditOrchestrator {
  private readonly crawler: LinkCrawler;
  private readonly redirectResolver: RedirectResolver;
  private readonly stockChecker: StockChecker;
  private readonly monetizationDetector: MonetizationDetector;
  private readonly fingerprinter: DestinationFingerprinter;

  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;

  constructor(options: OrchestratorOptions) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseKey = options.supabaseKey;

    this.crawler = new LinkCrawler();
    this.redirectResolver = new RedirectResolver();
    this.stockChecker = new StockChecker({
      rainforestApiKey: options.rainforestApiKey,
      serpApiKey: options.serpApiKey
    });
    this.monetizationDetector = new MonetizationDetector({
      impactAccountSid: options.impactAccountSid,
      impactAuthToken: options.impactAuthToken
    });
    this.fingerprinter = new DestinationFingerprinter();
  }

  /**
   * Run a complete audit for a user
   */
  async runAudit(userId: string, auditType: AuditType = 'full'): Promise<{ auditRunId: string; success: boolean }> {
    const auditRunId = crypto.randomUUID();

    try {
      // Create audit run record
      await this.createAuditRun(auditRunId, userId, auditType);

      // Get tracked link pages for this user
      const trackedPages = await this.getTrackedPages(userId);

      if (trackedPages.length === 0) {
        await this.updateAuditRun(auditRunId, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          links_audited: 0,
          issues_found: 0
        });
        return { auditRunId, success: true };
      }

      const allLinks: LinkToAudit[] = [];

      // Crawl each tracked page
      for (const page of trackedPages) {
        const crawlResult = await this.crawler.crawl(page.page_url);

        if (crawlResult.success) {
          // Update tracked page
          await this.updateTrackedPage(page.id, {
            last_audited_at: new Date().toISOString(),
            last_crawl_status: 'success',
            links_found_count: crawlResult.links_found.length
          });

          // Add links to audit list
          for (const link of crawlResult.links_found) {
            allLinks.push({
              url: link.url,
              tracked_page_id: page.id,
              previous_health: await this.getPreviousHealth(userId, link.url)
            });
          }
        } else {
          await this.updateTrackedPage(page.id, {
            last_crawl_status: 'failed',
            last_crawl_error: crawlResult.error
          });
        }
      }

      // Audit all links in parallel (with batching to avoid overwhelming services)
      const batchSize = 10;
      const allHealthStatuses: LinkHealthStatus[] = [];
      const allIssues: LinkHealthIssue[] = [];

      for (let i = 0; i < allLinks.length; i += batchSize) {
        const batch = allLinks.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(link => this.auditSingleLink(userId, link, auditRunId))
        );

        for (const result of batchResults) {
          if (result) {
            allHealthStatuses.push(result.healthStatus);
            allIssues.push(...result.issues);
          }
        }
      }

      // Save all health statuses
      for (const healthStatus of allHealthStatuses) {
        await this.saveHealthStatus(healthStatus);
      }

      // Save all issues
      for (const issue of allIssues) {
        await this.saveIssue(issue);
      }

      // Calculate revenue health score
      const healthScore = await this.calculateHealthScore(userId);

      // Update audit run with final stats
      await this.updateAuditRun(auditRunId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
        links_audited: allLinks.length,
        issues_found: allIssues.length,
        revenue_health_score: healthScore,
        critical_issues: allIssues.filter(i => i.severity === 'critical').length,
        warning_issues: allIssues.filter(i => i.severity === 'warning').length,
        info_issues: allIssues.filter(i => i.severity === 'info').length
      });

      // Save health history
      await this.saveHealthHistory(userId, auditRunId, healthScore, allHealthStatuses, allIssues);

      return { auditRunId, success: true };

    } catch (error) {
      // Update audit run as failed
      await this.updateAuditRun(auditRunId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });

      return { auditRunId, success: false };
    }
  }

  /**
   * Audit a single link with all detectors
   */
  private async auditSingleLink(
    userId: string,
    link: LinkToAudit,
    auditRunId: string
  ): Promise<{ healthStatus: LinkHealthStatus; issues: LinkHealthIssue[] } | null> {
    try {
      // Run all detectors in parallel
      const [redirectResult, stockResult, monetizationResult, fingerprintResult] = await Promise.all([
        this.redirectResolver.resolve(link.url),
        this.stockChecker.checkStock(link.url),
        this.monetizationDetector.detect(link.url),
        this.fingerprinter.fingerprint(link.url, link.previous_health?.destination_fingerprint)
      ]);

      // Analyze redirect health
      const redirectHealth = this.redirectResolver.analyzeChainHealth(redirectResult);

      // Calculate overall link health score
      let linkHealthScore = 100;

      if (redirectResult.is_broken) {
        linkHealthScore = 0;
      } else {
        linkHealthScore = Math.min(
          linkHealthScore,
          redirectHealth.health_score,
          stockResult.stock_status === 'out_of_stock' ? 20 : 100,
          !monetizationResult.has_affiliate_tag ? 60 : 100,
          fingerprintResult.has_changed ? 70 : 100
        );
      }

      // Create health status record
      const healthStatus: LinkHealthStatus = {
        id: crypto.randomUUID(),
        user_id: userId,
        link_url: link.url,
        destination_url: redirectResult.final_url,
        health_score: linkHealthScore,
        is_broken: redirectResult.is_broken,
        is_stock_out: stockResult.stock_status === 'out_of_stock',
        has_low_commission: false, // TODO: Implement commission threshold checking
        has_drift: fingerprintResult.has_changed,
        redirect_count: redirectResult.hops.length - 1,
        redirect_chain: redirectResult.hops,
        last_check_at: new Date().toISOString(),
        response_time_ms: redirectResult.total_time_ms,
        status_code: redirectResult.hops[redirectResult.hops.length - 1]?.status_code,
        stock_status: stockResult.stock_status,
        stock_checked_at: stockResult.last_checked,
        destination_fingerprint: fingerprintResult.fingerprint,
        fingerprint_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // Detect issues
      const issues = this.detectIssues(userId, healthStatus, auditRunId, {
        redirect: redirectResult,
        stock: stockResult,
        monetization: monetizationResult,
        fingerprint: fingerprintResult
      });

      return { healthStatus, issues };

    } catch (error) {
      console.error(`Error auditing link ${link.url}:`, error);
      return null;
    }
  }

  /**
   * Detect issues from audit results
   */
  private detectIssues(
    userId: string,
    healthStatus: LinkHealthStatus,
    auditRunId: string,
    results: {
      redirect: any;
      stock: any;
      monetization: any;
      fingerprint: any;
    }
  ): LinkHealthIssue[] {
    const issues: LinkHealthIssue[] = [];

    // Broken link
    if (results.redirect.is_broken) {
      issues.push({
        id: crypto.randomUUID(),
        user_id: userId,
        audit_run_id: auditRunId,
        link_health_id: healthStatus.id,
        issue_type: 'broken_link',
        severity: 'critical',
        revenue_impact_estimate: 50, // Estimated monthly loss
        confidence_score: 100,
        title: 'Broken Link Detected',
        description: results.redirect.error,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Stock out
    if (results.stock.stock_status === 'out_of_stock') {
      issues.push({
        id: crypto.randomUUID(),
        user_id: userId,
        audit_run_id: auditRunId,
        link_health_id: healthStatus.id,
        issue_type: 'stock_out',
        severity: 'critical',
        revenue_impact_estimate: 30,
        confidence_score: results.stock.confidence,
        title: 'Product Out of Stock',
        description: 'This product is currently unavailable',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Missing affiliate tag
    if (!results.monetization.has_affiliate_tag) {
      issues.push({
        id: crypto.randomUUID(),
        user_id: userId,
        audit_run_id: auditRunId,
        link_health_id: healthStatus.id,
        issue_type: 'link_decay',
        severity: 'warning',
        revenue_impact_estimate: 20,
        confidence_score: 90,
        title: 'Missing Affiliate Tag',
        description: 'This link is not monetized with an affiliate tag',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Destination drift
    if (results.fingerprint.has_changed) {
      issues.push({
        id: crypto.randomUUID(),
        user_id: userId,
        audit_run_id: auditRunId,
        link_health_id: healthStatus.id,
        issue_type: 'destination_drift',
        severity: 'warning',
        revenue_impact_estimate: 15,
        confidence_score: 80,
        title: 'Destination Page Changed',
        description: 'The destination page content has changed significantly',
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    // Excessive redirects
    if (healthStatus.redirect_count > 5) {
      issues.push({
        id: crypto.randomUUID(),
        user_id: userId,
        audit_run_id: auditRunId,
        link_health_id: healthStatus.id,
        issue_type: 'redirect_drift',
        severity: 'info',
        revenue_impact_estimate: 5,
        confidence_score: 100,
        title: 'Excessive Redirects',
        description: `Link has ${healthStatus.redirect_count} redirect hops, which may affect user experience`,
        status: 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return issues;
  }

  // Supabase helper methods (simplified - would use actual Supabase client)

  private async createAuditRun(id: string, userId: string, auditType: AuditType): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Creating audit run ${id} for user ${userId}`);
  }

  private async updateAuditRun(id: string, updates: Partial<LinkAuditRun>): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Updating audit run ${id}`, updates);
  }

  private async getTrackedPages(userId: string): Promise<Array<{ id: string; page_url: string }>> {
    // TODO: Implement with Supabase client
    return [];
  }

  private async updateTrackedPage(id: string, updates: any): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Updating tracked page ${id}`, updates);
  }

  private async getPreviousHealth(userId: string, linkUrl: string): Promise<LinkHealthStatus | undefined> {
    // TODO: Implement with Supabase client
    return undefined;
  }

  private async saveHealthStatus(healthStatus: LinkHealthStatus): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Saving health status for ${healthStatus.link_url}`);
  }

  private async saveIssue(issue: LinkHealthIssue): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Saving issue: ${issue.title}`);
  }

  private async calculateHealthScore(userId: string): Promise<number> {
    // TODO: Use Supabase function calculate_revenue_health_score
    return 75;
  }

  private async saveHealthHistory(
    userId: string,
    auditRunId: string,
    healthScore: number,
    statuses: LinkHealthStatus[],
    issues: LinkHealthIssue[]
  ): Promise<void> {
    // TODO: Implement with Supabase client
    console.log(`Saving health history for user ${userId}`);
  }
}
