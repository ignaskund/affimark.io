/**
 * Link Generator
 *
 * Generates properly tagged affiliate links using:
 * - Impact.com API for tracking links
 * - Amazon Associates link builder
 * - Custom UTM parameter injection
 *
 * Ensures all generated links have proper affiliate tags for revenue tracking.
 */

import { ImpactAPIService } from './impact-api';

interface LinkGeneratorOptions {
  impactAccountSid?: string;
  impactAuthToken?: string;
  amazonAssociatesTag?: string;
}

interface GeneratedLink {
  original_url: string;
  tagged_url: string;
  network: string;
  affiliate_id: string;
  utm_parameters?: Record<string, string>;
  expires_at?: string;
}

export class LinkGenerator {
  private readonly impactApi?: ImpactAPIService;
  private readonly amazonTag?: string;

  constructor(options: LinkGeneratorOptions) {
    if (options.impactAccountSid && options.impactAuthToken) {
      this.impactApi = new ImpactAPIService(
        options.impactAccountSid,
        options.impactAuthToken
      );
    }
    this.amazonTag = options.amazonAssociatesTag;
  }

  /**
   * Generate affiliate link with proper tags
   */
  async generate(
    destinationUrl: string,
    network?: string,
    campaignId?: number,
    customParams?: Record<string, string>
  ): Promise<GeneratedLink> {
    const url = new URL(destinationUrl);
    const hostname = url.hostname.toLowerCase();

    // Route to appropriate network
    if (hostname.includes('amazon.') || network === 'amazon') {
      return this.generateAmazonLink(destinationUrl, customParams);
    } else if (this.impactApi && (network === 'impact' || campaignId)) {
      return await this.generateImpactLink(destinationUrl, campaignId!, customParams);
    } else {
      return this.generateCustomLink(destinationUrl, customParams);
    }
  }

  /**
   * Generate Amazon Associates link
   */
  private generateAmazonLink(
    destinationUrl: string,
    customParams?: Record<string, string>
  ): GeneratedLink {
    const url = new URL(destinationUrl);

    // Add Amazon Associates tag
    if (this.amazonTag) {
      url.searchParams.set('tag', this.amazonTag);
    }

    // Add custom tracking parameters
    if (customParams) {
      Object.entries(customParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    // Clean up Amazon URL (remove unnecessary params)
    const paramsToKeep = ['tag', 'ascsubtag', 'th', 'psc'];
    const newParams = new URLSearchParams();

    paramsToKeep.forEach(param => {
      const value = url.searchParams.get(param);
      if (value) newParams.set(param, value);
    });

    // Reconstruct clean URL
    const cleanUrl = new URL(url.origin + url.pathname);
    cleanUrl.search = newParams.toString();

    return {
      original_url: destinationUrl,
      tagged_url: cleanUrl.toString(),
      network: 'amazon',
      affiliate_id: this.amazonTag || '',
      utm_parameters: customParams
    };
  }

  /**
   * Generate Impact.com tracking link
   */
  private async generateImpactLink(
    destinationUrl: string,
    campaignId: number,
    customParams?: Record<string, string>
  ): Promise<GeneratedLink> {
    if (!this.impactApi) {
      throw new Error('Impact.com API not configured');
    }

    try {
      // Generate tracking link via Impact.com API
      const trackingLink = await this.impactApi.generateTrackingLink({
        campaign_id: campaignId,
        destination_url: destinationUrl,
        click_reference: customParams?.click_reference
      });

      return {
        original_url: destinationUrl,
        tagged_url: trackingLink.url,
        network: 'impact',
        affiliate_id: campaignId.toString(),
        utm_parameters: customParams
      };

    } catch (error) {
      // Fallback to custom link if Impact.com fails
      console.error('Impact.com link generation failed:', error);
      return this.generateCustomLink(destinationUrl, customParams);
    }
  }

  /**
   * Generate custom affiliate link with UTM parameters
   */
  private generateCustomLink(
    destinationUrl: string,
    customParams?: Record<string, string>
  ): GeneratedLink {
    const url = new URL(destinationUrl);

    // Add UTM parameters for tracking
    const defaultParams = {
      utm_source: 'affimark',
      utm_medium: 'affiliate',
      utm_campaign: 'link_guard_generated'
    };

    const allParams = { ...defaultParams, ...customParams };

    Object.entries(allParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    return {
      original_url: destinationUrl,
      tagged_url: url.toString(),
      network: 'custom',
      affiliate_id: allParams.utm_source || 'affimark',
      utm_parameters: allParams
    };
  }

  /**
   * Re-tag an existing link (replace old tags with new ones)
   */
  async retagLink(
    originalUrl: string,
    network: string,
    campaignId?: number
  ): Promise<GeneratedLink> {
    // Remove existing affiliate parameters
    const url = new URL(originalUrl);
    const paramsToRemove = [
      'tag', 'ascsubtag', // Amazon
      'irclickid', 'irgwc', // Impact
      'sid', 'cjsku', // CJ
      'afftrack', 'tracking', // ShareASale
      'clickref', 'p', // Awin/Partnerize
      'hop', 'tid', // ClickBank
      'utm_source', 'utm_medium', 'utm_campaign' // UTM
    ];

    paramsToRemove.forEach(param => url.searchParams.delete(param));

    // Generate new tagged link
    return await this.generate(url.toString(), network, campaignId);
  }

  /**
   * Validate affiliate link has proper tags
   */
  validateLink(url: string, network: string): {
    is_valid: boolean;
    has_affiliate_tag: boolean;
    missing_params?: string[];
  } {
    const urlObj = new URL(url);

    if (network === 'amazon') {
      const hasTag = urlObj.searchParams.has('tag');
      return {
        is_valid: hasTag,
        has_affiliate_tag: hasTag,
        missing_params: hasTag ? [] : ['tag']
      };
    } else if (network === 'impact') {
      const hasIrclickid = urlObj.searchParams.has('irclickid');
      const hasIrgwc = urlObj.searchParams.has('irgwc');
      const hasTag = hasIrclickid || hasIrgwc || urlObj.hostname.includes('prf.hn');
      return {
        is_valid: hasTag,
        has_affiliate_tag: hasTag,
        missing_params: hasTag ? [] : ['irclickid or irgwc']
      };
    }

    // For custom/unknown networks, check for UTM params
    const hasUtm = urlObj.searchParams.has('utm_source') || urlObj.searchParams.has('utm_medium');
    return {
      is_valid: hasUtm,
      has_affiliate_tag: hasUtm,
      missing_params: hasUtm ? [] : ['utm_source', 'utm_medium']
    };
  }

  /**
   * Batch generate multiple links
   */
  async generateBatch(
    links: Array<{
      url: string;
      network?: string;
      campaign_id?: number;
      custom_params?: Record<string, string>;
    }>
  ): Promise<GeneratedLink[]> {
    const results = await Promise.allSettled(
      links.map(link =>
        this.generate(link.url, link.network, link.campaign_id, link.custom_params)
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Return fallback on error
        return this.generateCustomLink(links[index].url, links[index].custom_params);
      }
    });
  }
}
