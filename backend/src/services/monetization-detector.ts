/**
 * Monetization Detector Service
 * 
 * Detects whether a link has proper affiliate monetization:
 * - Checks for affiliate tags/tracking parameters
 * - Identifies the affiliate network
 * - Estimates commission rates
 */

interface MonetizationDetectorOptions {
  impactAccountSid?: string;
  impactAuthToken?: string;
}

interface MonetizationResult {
  has_affiliate_tag: boolean;
  affiliate_network?: string;
  affiliate_tag?: string;
  commission_rate?: string;
  is_optimal: boolean;
  optimization_suggestion?: string;
}

export class MonetizationDetector {
  private options: MonetizationDetectorOptions;

  constructor(options: MonetizationDetectorOptions) {
    this.options = options;
  }

  /**
   * Detect monetization status of a URL
   */
  async detect(url: string): Promise<MonetizationResult> {
    try {
      const parsedUrl = new URL(url);
      
      // Check for Amazon affiliate tags
      const amazonResult = this.detectAmazon(parsedUrl);
      if (amazonResult.has_affiliate_tag) {
        return amazonResult;
      }

      // Check for Impact.com links
      const impactResult = this.detectImpact(parsedUrl);
      if (impactResult.has_affiliate_tag) {
        return impactResult;
      }

      // Check for ShareASale
      const shareasaleResult = this.detectShareASale(parsedUrl);
      if (shareasaleResult.has_affiliate_tag) {
        return shareasaleResult;
      }

      // Check for CJ (Commission Junction)
      const cjResult = this.detectCJ(parsedUrl);
      if (cjResult.has_affiliate_tag) {
        return cjResult;
      }

      // Check for Awin
      const awinResult = this.detectAwin(parsedUrl);
      if (awinResult.has_affiliate_tag) {
        return awinResult;
      }

      // Check for Rakuten
      const rakutenResult = this.detectRakuten(parsedUrl);
      if (rakutenResult.has_affiliate_tag) {
        return rakutenResult;
      }

      // No affiliate monetization detected
      return {
        has_affiliate_tag: false,
        is_optimal: false,
        optimization_suggestion: 'Consider adding affiliate tracking to this link'
      };

    } catch (error) {
      console.error('Error detecting monetization:', error);
      return {
        has_affiliate_tag: false,
        is_optimal: false
      };
    }
  }

  /**
   * Detect Amazon Associates tags
   */
  private detectAmazon(url: URL): MonetizationResult {
    const hostname = url.hostname;
    
    if (!hostname.includes('amazon.') && !hostname.includes('amzn.')) {
      return { has_affiliate_tag: false, is_optimal: false };
    }

    const tag = url.searchParams.get('tag');
    
    if (tag) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'Amazon Associates',
        affiliate_tag: tag,
        is_optimal: true
      };
    }

    return {
      has_affiliate_tag: false,
      affiliate_network: 'Amazon Associates',
      is_optimal: false,
      optimization_suggestion: 'Add your Amazon Associates tag to this link'
    };
  }

  /**
   * Detect Impact.com tracking
   */
  private detectImpact(url: URL): MonetizationResult {
    const hostname = url.hostname;
    
    const impactDomains = ['go.impact.com', 'goto.impact.com', 'pntra.com', 'pjtra.com', 'pjatr.com', 'sjv.io'];
    
    if (impactDomains.some(d => hostname.includes(d))) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'Impact.com',
        is_optimal: true
      };
    }

    return { has_affiliate_tag: false, is_optimal: false };
  }

  /**
   * Detect ShareASale tracking
   */
  private detectShareASale(url: URL): MonetizationResult {
    if (url.hostname.includes('shareasale.com')) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'ShareASale',
        is_optimal: true
      };
    }
    return { has_affiliate_tag: false, is_optimal: false };
  }

  /**
   * Detect Commission Junction (CJ) tracking
   */
  private detectCJ(url: URL): MonetizationResult {
    const cjDomains = ['anrdoezrs.net', 'tkqlhce.com', 'jdoqocy.com', 'kqzyfj.com', 'dpbolvw.net', 'afcpatrk.com'];
    
    if (cjDomains.some(d => url.hostname.includes(d))) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'CJ Affiliate',
        is_optimal: true
      };
    }
    return { has_affiliate_tag: false, is_optimal: false };
  }

  /**
   * Detect Awin tracking
   */
  private detectAwin(url: URL): MonetizationResult {
    if (url.hostname.includes('awin1.com')) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'Awin',
        is_optimal: true
      };
    }
    return { has_affiliate_tag: false, is_optimal: false };
  }

  /**
   * Detect Rakuten tracking
   */
  private detectRakuten(url: URL): MonetizationResult {
    if (url.hostname.includes('rakuten') || url.hostname.includes('linksynergy.com')) {
      return {
        has_affiliate_tag: true,
        affiliate_network: 'Rakuten',
        is_optimal: true
      };
    }
    return { has_affiliate_tag: false, is_optimal: false };
  }
}

