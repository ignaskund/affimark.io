/**
 * Action Executor Service
 *
 * Executes recommended fixes for detected issues:
 * - Generates new affiliate links
 * - Finds alternative products
 * - Creates pending actions for user approval
 * - Tracks execution status and results
 */

import { createClient } from '@supabase/supabase-js';
import { LinkGenerator } from './link-generator';
import { AlternativeSuggester } from './alternative-suggester';
import type {
  IssueRecommendation,
  LinkAuditAction,
  AuditActionType,
  ExecutedBy
} from '../../../LINK_AUDIT_TYPES';

interface ActionExecutorOptions {
  supabaseUrl: string;
  supabaseKey: string;
  rainforestApiKey?: string;
  serpApiKey?: string;
  impactAccountSid?: string;
  impactAuthToken?: string;
  amazonAssociatesTag?: string;
}

interface ExecuteActionResult {
  success: boolean;
  action_id?: string;
  new_link?: string;
  old_link?: string;
  instructions?: string[];
  error?: string;
  estimated_revenue_gain?: number;
  implementation_difficulty?: string;
}

export class ActionExecutor {
  private supabase: ReturnType<typeof createClient>;
  private linkGenerator: LinkGenerator;
  private alternativeSuggester: AlternativeSuggester;
  private options: ActionExecutorOptions;

  constructor(options: ActionExecutorOptions) {
    this.options = options;
    this.supabase = createClient(options.supabaseUrl, options.supabaseKey);

    this.linkGenerator = new LinkGenerator({
      impactAccountSid: options.impactAccountSid,
      impactAuthToken: options.impactAuthToken,
      amazonAssociatesTag: options.amazonAssociatesTag
    });

    this.alternativeSuggester = new AlternativeSuggester({
      impactAccountSid: options.impactAccountSid,
      impactAuthToken: options.impactAuthToken,
      serpApiKey: options.serpApiKey,
      rainforestApiKey: options.rainforestApiKey
    });
  }

  /**
   * Execute a recommendation action
   */
  async executeRecommendation(
    recommendationId: string,
    userId: string,
    executedBy: ExecutedBy = 'user'
  ): Promise<ExecuteActionResult> {
    try {
      // Get recommendation details
      const { data: recommendation, error: recError } = await this.supabase
        .from('issue_recommendations')
        .select('*, link_health_issues!inner(*, link_health_status!inner(*))')
        .eq('id', recommendationId)
        .single();

      if (recError || !recommendation) {
        return { success: false, error: 'Recommendation not found' };
      }

      const issue = recommendation.link_health_issues;
      const linkHealth = issue.link_health_status;

      // Route to appropriate action handler
      switch (recommendation.action_type) {
        case 'replace_link':
          return await this.handleReplaceLink(recommendation, linkHealth, userId, executedBy);

        case 'switch_program':
          return await this.handleSwitchProgram(recommendation, linkHealth, userId, executedBy);

        case 'remove_link':
          return await this.handleRemoveLink(recommendation, linkHealth, userId, executedBy);

        case 'update_tag':
          return await this.handleUpdateTag(recommendation, linkHealth, userId, executedBy);

        case 'add_backup':
          return await this.handleAddBackup(recommendation, linkHealth, userId, executedBy);

        default:
          return { success: false, error: 'Unknown action type' };
      }

    } catch (error) {
      console.error('Error executing recommendation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed'
      };
    }
  }

  /**
   * Handle replace_link action
   * Finds alternative product and generates new affiliate link
   */
  private async handleReplaceLink(
    recommendation: any,
    linkHealth: any,
    userId: string,
    executedBy: ExecutedBy
  ): Promise<ExecuteActionResult> {
    try {
      const oldLink = linkHealth.link_url;

      // Find alternatives
      const alternatives = await this.alternativeSuggester.findAlternatives(
        linkHealth.destination_url || oldLink
      );

      if (!alternatives.recommendation) {
        return {
          success: false,
          error: 'No suitable alternative found',
          instructions: this.generateManualInstructions('replace_link', linkHealth, null)
        };
      }

      const alternative = alternatives.recommendation;

      // Generate new affiliate link if we have the network integration
      let newLink = alternative.product_url;

      if (alternative.network === 'Impact.com' && alternative.campaign_id && this.options.impactAccountSid) {
        try {
          const generatedLink = await this.linkGenerator.generateImpactLink(
            alternative.campaign_id,
            alternative.product_url
          );
          newLink = generatedLink.tracking_link;
        } catch (error) {
          console.error('Failed to generate Impact.com link:', error);
        }
      } else if (alternative.network === 'Amazon Associates' && this.options.amazonAssociatesTag) {
        newLink = await this.linkGenerator.generateAmazonLink(
          alternative.product_url,
          this.options.amazonAssociatesTag
        );
      }

      // Create pending action
      const actionId = await this.createPendingAction(
        userId,
        recommendation.issue_id,
        recommendation.id,
        'replaced_link',
        {
          old_link: oldLink,
          new_link: newLink,
          alternative: {
            network: alternative.network,
            merchant_name: alternative.merchant_name,
            commission_rate: alternative.commission_rate,
            estimated_revenue_gain: alternative.estimated_revenue_gain
          }
        },
        executedBy
      );

      return {
        success: true,
        action_id: actionId,
        old_link: oldLink,
        new_link: newLink,
        estimated_revenue_gain: alternative.estimated_revenue_gain,
        implementation_difficulty: recommendation.implementation_difficulty,
        instructions: this.generateManualInstructions('replace_link', linkHealth, {
          old_link: oldLink,
          new_link: newLink,
          merchant: alternative.merchant_name
        })
      };

    } catch (error) {
      console.error('Error in handleReplaceLink:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to replace link'
      };
    }
  }

  /**
   * Handle switch_program action
   * Switches to a better affiliate program for the same product
   */
  private async handleSwitchProgram(
    recommendation: any,
    linkHealth: any,
    userId: string,
    executedBy: ExecutedBy
  ): Promise<ExecuteActionResult> {
    try {
      const oldLink = linkHealth.link_url;
      const destinationUrl = linkHealth.destination_url || oldLink;

      // Find better programs
      const alternatives = await this.alternativeSuggester.findAlternatives(destinationUrl);

      if (!alternatives.recommendation) {
        return {
          success: false,
          error: 'No better program found',
          instructions: this.generateManualInstructions('switch_program', linkHealth, null)
        };
      }

      const betterProgram = alternatives.recommendation;

      // Generate new link with better commission
      let newLink = destinationUrl;

      if (betterProgram.network === 'Impact.com' && betterProgram.campaign_id && this.options.impactAccountSid) {
        const generatedLink = await this.linkGenerator.generateImpactLink(
          betterProgram.campaign_id,
          destinationUrl
        );
        newLink = generatedLink.tracking_link;
      }

      const actionId = await this.createPendingAction(
        userId,
        recommendation.issue_id,
        recommendation.id,
        'switched_program',
        {
          old_link: oldLink,
          new_link: newLink,
          old_network: linkHealth.affiliate_network,
          new_network: betterProgram.network,
          commission_improvement: betterProgram.commission_rate
        },
        executedBy
      );

      return {
        success: true,
        action_id: actionId,
        old_link: oldLink,
        new_link: newLink,
        estimated_revenue_gain: betterProgram.estimated_revenue_gain,
        implementation_difficulty: recommendation.implementation_difficulty,
        instructions: this.generateManualInstructions('switch_program', linkHealth, {
          old_link: oldLink,
          new_link: newLink,
          old_network: linkHealth.affiliate_network,
          new_network: betterProgram.network
        })
      };

    } catch (error) {
      console.error('Error in handleSwitchProgram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to switch program'
      };
    }
  }

  /**
   * Handle remove_link action
   */
  private async handleRemoveLink(
    recommendation: any,
    linkHealth: any,
    userId: string,
    executedBy: ExecutedBy
  ): Promise<ExecuteActionResult> {
    try {
      const actionId = await this.createPendingAction(
        userId,
        recommendation.issue_id,
        recommendation.id,
        'removed_link',
        {
          removed_link: linkHealth.link_url,
          reason: 'Broken or non-functional link'
        },
        executedBy
      );

      return {
        success: true,
        action_id: actionId,
        old_link: linkHealth.link_url,
        implementation_difficulty: recommendation.implementation_difficulty,
        instructions: this.generateManualInstructions('remove_link', linkHealth, {
          link_to_remove: linkHealth.link_url
        })
      };

    } catch (error) {
      console.error('Error in handleRemoveLink:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove link'
      };
    }
  }

  /**
   * Handle update_tag action
   */
  private async handleUpdateTag(
    recommendation: any,
    linkHealth: any,
    userId: string,
    executedBy: ExecutedBy
  ): Promise<ExecuteActionResult> {
    try {
      // Extract product URL and generate new tagged link
      const destinationUrl = linkHealth.destination_url || linkHealth.link_url;
      let newLink = destinationUrl;

      // If it's Amazon and we have an associates tag
      if (destinationUrl.includes('amazon.') && this.options.amazonAssociatesTag) {
        newLink = await this.linkGenerator.generateAmazonLink(
          destinationUrl,
          this.options.amazonAssociatesTag
        );
      }

      const actionId = await this.createPendingAction(
        userId,
        recommendation.issue_id,
        recommendation.id,
        'generated_link',
        {
          old_link: linkHealth.link_url,
          new_link: newLink,
          tag_added: true
        },
        executedBy
      );

      return {
        success: true,
        action_id: actionId,
        old_link: linkHealth.link_url,
        new_link: newLink,
        implementation_difficulty: recommendation.implementation_difficulty,
        instructions: this.generateManualInstructions('update_tag', linkHealth, {
          old_link: linkHealth.link_url,
          new_link: newLink
        })
      };

    } catch (error) {
      console.error('Error in handleUpdateTag:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update tag'
      };
    }
  }

  /**
   * Handle add_backup action
   */
  private async handleAddBackup(
    recommendation: any,
    linkHealth: any,
    userId: string,
    executedBy: ExecutedBy
  ): Promise<ExecuteActionResult> {
    try {
      // Find alternative products
      const alternatives = await this.alternativeSuggester.findAlternatives(
        linkHealth.destination_url || linkHealth.link_url
      );

      const backupLinks = alternatives.alternatives.slice(0, 2).map(alt => ({
        merchant: alt.merchant_name,
        network: alt.network,
        url: alt.product_url,
        commission: alt.commission_rate
      }));

      const actionId = await this.createPendingAction(
        userId,
        recommendation.issue_id,
        recommendation.id,
        'generated_link',
        {
          primary_link: linkHealth.link_url,
          backup_links: backupLinks
        },
        executedBy
      );

      return {
        success: true,
        action_id: actionId,
        old_link: linkHealth.link_url,
        implementation_difficulty: recommendation.implementation_difficulty,
        instructions: this.generateManualInstructions('add_backup', linkHealth, {
          primary_link: linkHealth.link_url,
          backup_links: backupLinks
        })
      };

    } catch (error) {
      console.error('Error in handleAddBackup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add backup'
      };
    }
  }

  /**
   * Create pending action in database
   */
  private async createPendingAction(
    userId: string,
    issueId: string,
    recommendationId: string,
    actionType: AuditActionType,
    actionData: Record<string, any>,
    executedBy: ExecutedBy
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('link_audit_actions')
      .insert({
        user_id: userId,
        issue_id: issueId,
        recommendation_id: recommendationId,
        action_type: actionType,
        status: 'pending',
        action_data: actionData,
        executed_by: executedBy,
        executed_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create action: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Generate step-by-step manual instructions for the user
   */
  private generateManualInstructions(
    actionType: string,
    linkHealth: any,
    actionData: any
  ): string[] {
    const instructions: string[] = [];

    switch (actionType) {
      case 'replace_link':
        instructions.push(
          '1. Open your link-in-bio platform dashboard (Linktree, Beacons, etc.)',
          `2. Find the link: ${actionData?.old_link || linkHealth.link_url}`,
          `3. Replace it with: ${actionData?.new_link}`,
          `4. Update the link title if needed (recommend: "${actionData?.merchant || 'Product'}")`,
          '5. Save your changes',
          '6. Test the new link to ensure it works correctly'
        );
        break;

      case 'switch_program':
        instructions.push(
          '1. Open your link-in-bio platform dashboard',
          `2. Find the link: ${actionData?.old_link || linkHealth.link_url}`,
          `3. Replace with new ${actionData?.new_network} link: ${actionData?.new_link}`,
          `4. Note: New commission rate is higher (was ${actionData?.old_network})`,
          '5. Save your changes'
        );
        break;

      case 'remove_link':
        instructions.push(
          '1. Open your link-in-bio platform dashboard',
          `2. Find and remove the link: ${actionData?.link_to_remove || linkHealth.link_url}`,
          '3. Consider adding a working alternative product instead',
          '4. Save your changes'
        );
        break;

      case 'update_tag':
        instructions.push(
          '1. Open your link-in-bio platform dashboard',
          `2. Find the link: ${actionData?.old_link || linkHealth.link_url}`,
          `3. Replace with properly tagged link: ${actionData?.new_link}`,
          '4. This ensures you earn commissions on clicks',
          '5. Save your changes'
        );
        break;

      case 'add_backup':
        instructions.push(
          '1. Open your link-in-bio platform dashboard',
          `2. Keep your primary link: ${actionData?.primary_link}`,
          '3. Add backup links below it:'
        );

        actionData?.backup_links?.forEach((backup: any, index: number) => {
          instructions.push(`   ${index + 1}. ${backup.merchant} - ${backup.url}`);
        });

        instructions.push(
          '4. Label them clearly as alternatives',
          '5. Save your changes'
        );
        break;
    }

    return instructions;
  }

  /**
   * Complete a pending action (mark as completed)
   */
  async completeAction(
    actionId: string,
    resultMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('link_audit_actions')
        .update({
          status: 'completed',
          result_message: resultMessage || 'Action completed successfully',
          completed_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) {
        throw new Error(`Failed to complete action: ${error.message}`);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete action'
      };
    }
  }

  /**
   * Fail an action (mark as failed)
   */
  async failAction(
    actionId: string,
    errorMessage: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('link_audit_actions')
        .update({
          status: 'failed',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) {
        throw new Error(`Failed to mark action as failed: ${error.message}`);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update action'
      };
    }
  }

  /**
   * Get pending actions for a user
   */
  async getPendingActions(userId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('link_audit_actions')
        .select('*, issue_recommendations(*), link_health_issues!inner(*, link_health_status(*))')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('executed_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending actions:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('Error in getPendingActions:', error);
      return [];
    }
  }
}
