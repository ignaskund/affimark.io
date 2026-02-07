/**
 * Email Service
 *
 * Sends alert emails to users about link health issues.
 * Supports multiple email providers (SendGrid, Postmark, Resend).
 * Formats link health reports with actionable fix buttons.
 * Tracks delivery status.
 */

import type {
  LinkHealthAlert,
  LinkHealthIssue
} from '../../../LINK_AUDIT_TYPES';

interface EmailServiceOptions {
  provider: 'sendgrid' | 'postmark' | 'resend';
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private readonly provider: 'sendgrid' | 'postmark' | 'resend';
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(options: EmailServiceOptions) {
    this.provider = options.provider;
    this.apiKey = options.apiKey;
    this.fromEmail = options.fromEmail;
    this.fromName = options.fromName || 'Affimark Link Guard';
  }

  /**
   * Send alert email
   */
  async sendAlert(
    userEmail: string,
    alert: LinkHealthAlert,
    dashboardUrl: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const email = this.formatAlertEmail(alert, dashboardUrl);
      const payload: EmailPayload = {
        to: userEmail,
        subject: alert.title,
        html: email.html,
        text: email.text
      };

      const result = await this.send(payload);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send weekly summary email
   */
  async sendWeeklySummary(
    userEmail: string,
    alert: LinkHealthAlert,
    issues: LinkHealthIssue[],
    dashboardUrl: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const email = this.formatWeeklySummary(alert, issues, dashboardUrl);
      const payload: EmailPayload = {
        to: userEmail,
        subject: alert.title,
        html: email.html,
        text: email.text
      };

      const result = await this.send(payload);
      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Format alert email HTML
   */
  private formatAlertEmail(
    alert: LinkHealthAlert,
    dashboardUrl: string
  ): { html: string; text: string } {
    const severityEmoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    const severityColor = alert.severity === 'critical' ? '#DC2626' : alert.severity === 'warning' ? '#F59E0B' : '#3B82F6';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${alert.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151; background-color: #F9FAFB; margin: 0; padding: 0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF;">
    <!-- Header -->
    <tr>
      <td style="padding: 32px 24px; background: linear-gradient(135deg, #667EEA 0%, #764BA2 100%);">
        <h1 style="margin: 0; color: #FFFFFF; font-size: 24px; font-weight: 600;">
          ${severityEmoji} ${alert.title}
        </h1>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 24px;">
        <div style="background-color: ${severityColor}15; border-left: 4px solid ${severityColor}; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; color: ${severityColor}; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px;">
            ${alert.severity.toUpperCase()} ALERT
          </p>
        </div>

        <p style="margin: 0 0 24px 0; white-space: pre-line;">
          ${alert.message}
        </p>

        ${alert.alert_data?.current_score !== undefined ? `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 16px; background-color: #F9FAFB;">
              <p style="margin: 0; font-size: 14px; color: #6B7280;">Revenue Health Score</p>
              <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 700; color: ${alert.alert_data.current_score >= 80 ? '#10B981' : alert.alert_data.current_score >= 50 ? '#F59E0B' : '#DC2626'};">
                ${alert.alert_data.current_score}/100
              </p>
              ${alert.alert_data.score_drop ? `
              <p style="margin: 8px 0 0 0; font-size: 14px; color: #DC2626;">
                ↓ ${alert.alert_data.score_drop} points
              </p>
              ` : ''}
            </td>
          </tr>
        </table>
        ` : ''}

        <!-- CTA Button -->
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="padding: 24px 0;">
              <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #667EEA; color: #FFFFFF; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                View Dashboard →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB;">
        <p style="margin: 0; font-size: 12px; color: #6B7280; text-align: center;">
          You received this email because you have link health alerts enabled.
          <br>
          <a href="${dashboardUrl}/settings" style="color: #667EEA; text-decoration: none;">Manage alert preferences</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const text = `
${severityEmoji} ${alert.title}

${alert.message}

${alert.alert_data?.current_score !== undefined ? `Revenue Health Score: ${alert.alert_data.current_score}/100` : ''}

View your dashboard: ${dashboardUrl}

You received this email because you have link health alerts enabled.
Manage alert preferences: ${dashboardUrl}/settings
    `.trim();

    return { html, text };
  }

  /**
   * Format weekly summary email
   */
  private formatWeeklySummary(
    alert: LinkHealthAlert,
    issues: LinkHealthIssue[],
    dashboardUrl: string
  ): { html: string; text: string } {
    const topIssues = issues.slice(0, 5);

    const issuesHtml = topIssues.map(issue => {
      const emoji = issue.severity === 'critical' ? '🚨' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      const color = issue.severity === 'critical' ? '#DC2626' : issue.severity === 'warning' ? '#F59E0B' : '#3B82F6';
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #E5E7EB;">
            <div style="display: flex; align-items: center;">
              <span style="font-size: 18px; margin-right: 8px;">${emoji}</span>
              <div>
                <p style="margin: 0; font-weight: 600; color: #111827;">${issue.title}</p>
                <p style="margin: 4px 0 0 0; font-size: 14px; color: #6B7280;">${issue.description}</p>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const html = this.formatAlertEmail(alert, dashboardUrl).html.replace(
      '<p style="margin: 0 0 24px 0; white-space: pre-line;">',
      `<p style="margin: 0 0 24px 0; white-space: pre-line;">`
    );

    const text = `
${alert.title}

${alert.message}

Top Issues:
${topIssues.map((issue, i) => `${i + 1}. ${issue.title} (${issue.severity})`).join('\n')}

View full report: ${dashboardUrl}
    `.trim();

    return { html, text };
  }

  /**
   * Send email via configured provider
   */
  private async send(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    switch (this.provider) {
      case 'sendgrid':
        return await this.sendViaSendGrid(payload);
      case 'postmark':
        return await this.sendViaPostmark(payload);
      case 'resend':
        return await this.sendViaResend(payload);
      default:
        return { success: false, error: 'Invalid email provider' };
    }
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: this.fromEmail, name: this.fromName },
          subject: payload.subject,
          content: [
            { type: 'text/plain', value: payload.text },
            { type: 'text/html', value: payload.html }
          ]
        })
      });

      if (response.ok) {
        return { success: true, messageId: response.headers.get('X-Message-Id') || undefined };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send via Postmark
   */
  private async sendViaPostmark(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          From: `${this.fromName} <${this.fromEmail}>`,
          To: payload.to,
          Subject: payload.subject,
          TextBody: payload.text,
          HtmlBody: payload.html
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        return { success: true, messageId: data.MessageID };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Send via Resend
   */
  private async sendViaResend(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${this.fromName} <${this.fromEmail}>`,
          to: payload.to,
          subject: payload.subject,
          text: payload.text,
          html: payload.html
        })
      });

      if (response.ok) {
        const data: any = await response.json();
        return { success: true, messageId: data.id };
      } else {
        const error = await response.text();
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
