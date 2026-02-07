/**
 * Daily Link Audit Worker
 *
 * Runs at 6:00 AM UTC daily (configured in wrangler.toml)
 * - Fetches all users with active tracked_link_pages
 * - Runs full audit for each user
 * - Sends alerts if issues detected
 */

import { createClient } from '@supabase/supabase-js';
import { LinkAuditOrchestrator } from '../services/link-audit-orchestrator';
import { AlertGenerator } from '../services/alert-generator';
import { EmailService } from '../services/email-service';
import type { Env } from '../index';

export async function handleDailyAudit(env: Env): Promise<void> {
  console.log('[Daily Audit] Starting at', new Date().toISOString());

  try {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get all users with active tracked link pages
    const { data: pages, error } = await supabase
      .from('tracked_link_pages')
      .select('user_id, audit_enabled, audit_frequency')
      .eq('is_active', true)
      .eq('audit_enabled', true);

    if (error) {
      console.error('[Daily Audit] Error fetching tracked pages:', error);
      return;
    }

    if (!pages || pages.length === 0) {
      console.log('[Daily Audit] No active tracked pages found');
      return;
    }

    // Get unique users
    const userIds = [...new Set(pages.map(p => p.user_id))];
    console.log(`[Daily Audit] Found ${userIds.length} users to audit`);

    // Initialize orchestrator
    const orchestrator = new LinkAuditOrchestrator({
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_KEY,
      rainforestApiKey: env.RAINFOREST_API_KEY,
      serpApiKey: env.SERPAPI_KEY,
      impactAccountSid: env.IMPACT_ACCOUNT_SID,
      impactAuthToken: env.IMPACT_AUTH_TOKEN
    });

    // Initialize alert generator
    const alertGenerator = new AlertGenerator({
      supabaseUrl: env.SUPABASE_URL,
      supabaseKey: env.SUPABASE_SERVICE_KEY
    });

    // Initialize email service (if configured)
    let emailService: EmailService | undefined;
    if (env.SENDGRID_API_KEY && env.EMAIL_FROM_ADDRESS) {
      emailService = new EmailService({
        provider: 'sendgrid',
        apiKey: env.SENDGRID_API_KEY,
        fromEmail: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME || 'Affimark Link Guard'
      });
    } else if (env.POSTMARK_API_KEY && env.EMAIL_FROM_ADDRESS) {
      emailService = new EmailService({
        provider: 'postmark',
        apiKey: env.POSTMARK_API_KEY,
        fromEmail: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME || 'Affimark Link Guard'
      });
    } else if (env.RESEND_API_KEY && env.EMAIL_FROM_ADDRESS) {
      emailService = new EmailService({
        provider: 'resend',
        apiKey: env.RESEND_API_KEY,
        fromEmail: env.EMAIL_FROM_ADDRESS,
        fromName: env.EMAIL_FROM_NAME || 'Affimark Link Guard'
      });
    }

    // Run audits for each user
    for (const userId of userIds) {
      try {
        console.log(`[Daily Audit] Running audit for user ${userId}`);

        // Run full audit
        const { auditRunId, success } = await orchestrator.runAudit(userId, 'full');

        if (!success) {
          console.error(`[Daily Audit] Audit failed for user ${userId}`);
          continue;
        }

        console.log(`[Daily Audit] Audit complete for user ${userId}, run ID: ${auditRunId}`);

        // Get audit results
        const { data: auditRun } = await supabase
          .from('link_audit_runs')
          .select('*')
          .eq('id', auditRunId)
          .single();

        if (!auditRun) continue;

        // Get user preferences
        const { data: preferences } = await supabase
          .from('link_audit_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();

        // Get previous health score
        const { data: previousHistory } = await supabase
          .from('revenue_health_history')
          .select('health_score')
          .eq('user_id', userId)
          .order('recorded_at', { ascending: false })
          .limit(2);

        const previousScore = previousHistory && previousHistory.length > 1
          ? previousHistory[1].health_score
          : undefined;

        // Get issues
        const { data: issues } = await supabase
          .from('link_health_issues')
          .select('*')
          .eq('audit_run_id', auditRunId)
          .eq('status', 'open');

        // Generate alerts
        const alerts = await alertGenerator.generateAlerts({
          userId,
          auditRunId,
          currentScore: auditRun.revenue_health_score || 0,
          previousScore,
          issues: issues || [],
          preferences: preferences || {
            user_id: userId,
            auto_audit_enabled: true,
            audit_frequency: 'daily',
            email_alerts_enabled: true,
            alert_threshold: 'critical',
            weekly_summary_enabled: true,
            auto_fix_enabled: false,
            min_health_score_alert: 70,
            revenue_impact_threshold: 100,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });

        // Save and send alerts
        for (const alert of alerts) {
          // Save alert to database
          const { error: alertError } = await supabase
            .from('link_health_alerts')
            .insert(alert);

          if (alertError) {
            console.error(`[Daily Audit] Error saving alert:`, alertError);
            continue;
          }

          // Send email if configured and user enabled
          if (emailService && preferences?.email_alerts_enabled && alert.channels.includes('email')) {
            // Get user email
            const { data: profile } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', userId)
              .single();

            if (profile?.email) {
              const dashboardUrl = `https://affimark.io/link-guard`;
              const result = await emailService.sendAlert(
                profile.email,
                alert,
                dashboardUrl
              );

              if (result.success) {
                // Mark email as sent
                await supabase
                  .from('link_health_alerts')
                  .update({ email_sent: true, sent_at: new Date().toISOString() })
                  .eq('id', alert.id);

                console.log(`[Daily Audit] Alert email sent to ${profile.email}`);
              } else {
                console.error(`[Daily Audit] Failed to send email:`, result.error);
              }
            }
          }
        }

        console.log(`[Daily Audit] Generated ${alerts.length} alerts for user ${userId}`);

      } catch (error) {
        console.error(`[Daily Audit] Error auditing user ${userId}:`, error);
        // Continue with next user
      }
    }

    console.log('[Daily Audit] Completed successfully');

  } catch (error) {
    console.error('[Daily Audit] Fatal error:', error);
    throw error;
  }
}
