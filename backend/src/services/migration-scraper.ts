/**
 * Migration Scraper Service
 *
 * Scrapes links from popular link-in-bio platforms:
 * - Linktree
 * - Beacons
 * - Stan Store
 * - Carrd
 * - Custom pages
 *
 * Extracts links and suggests SmartWrapper migration strategy
 */

export interface ScrapedLink {
  title: string;
  url: string;
  position: number;
  isAffiliate: boolean;
  detectedNetwork?: string; // 'amazon', 'shopify', etc.
  affiliateTag?: string;
}

export interface MigrationSuggestion {
  platform: string;
  totalLinks: number;
  affiliateLinks: number;
  links: ScrapedLink[];
  suggestions: string[];
}

export class MigrationScraper {
  /**
   * Scrape links from a link-in-bio page
   */
  async scrapePage(url: string): Promise<MigrationSuggestion> {
    try {
      // Fetch page HTML
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; AffiMarkBot/1.0; +https://affimark.com/bot)',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page: HTTP ${response.status}`);
      }

      const html = await response.text();
      const platform = this.detectPlatform(html, url);

      let links: ScrapedLink[] = [];

      // Platform-specific scraping
      switch (platform) {
        case 'linktree':
          links = this.scrapeLinktree(html);
          break;
        case 'beacons':
          links = this.scrapeBeacons(html);
          break;
        case 'stan':
          links = this.scrapeStan(html);
          break;
        case 'carrd':
          links = this.scrapeCarrd(html);
          break;
        default:
          links = this.scrapeGeneric(html);
      }

      // Classify affiliate links
      links = links.map((link) => ({
        ...link,
        isAffiliate: this.isAffiliateLink(link.url),
        detectedNetwork: this.detectNetwork(link.url),
        affiliateTag: this.extractAffiliateTag(link.url),
      }));

      const affiliateLinks = links.filter((l) => l.isAffiliate).length;

      // Generate migration suggestions
      const suggestions = this.generateSuggestions(links, platform);

      return {
        platform,
        totalLinks: links.length,
        affiliateLinks,
        links,
        suggestions,
      };
    } catch (error: any) {
      throw new Error(`Migration scraper error: ${error.message}`);
    }
  }

  /**
   * Detect link-in-bio platform from HTML and URL
   */
  private detectPlatform(html: string, url: string): string {
    const lowerHtml = html.toLowerCase();

    if (url.includes('linktr.ee') || lowerHtml.includes('linktree')) {
      return 'linktree';
    }

    if (url.includes('beacons.ai') || lowerHtml.includes('beacons')) {
      return 'beacons';
    }

    if (url.includes('stan.store') || lowerHtml.includes('stan store')) {
      return 'stan';
    }

    if (lowerHtml.includes('carrd.co') || lowerHtml.includes('carrd')) {
      return 'carrd';
    }

    return 'generic';
  }

  /**
   * Scrape Linktree page
   */
  private scrapeLinktree(html: string): ScrapedLink[] {
    const links: ScrapedLink[] = [];
    let position = 0;

    // Linktree uses <a> tags with specific data attributes
    // Pattern: <a href="url" data-testid="LinkButton" ...>Title</a>
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*data-testid=["']LinkButton["'][^>]*>([^<]+)<\/a>/gi;

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      links.push({
        title,
        url: this.resolveUrl(url),
        position: ++position,
        isAffiliate: false, // Will be set later
      });
    }

    return links;
  }

  /**
   * Scrape Beacons page
   */
  private scrapeBeacons(html: string): ScrapedLink[] {
    const links: ScrapedLink[] = [];
    let position = 0;

    // Beacons uses button/link elements
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*class=[^>]*link[^>]*>([^<]+)<\/a>/gi;

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      if (url && !url.startsWith('#') && !url.startsWith('javascript:')) {
        links.push({
          title,
          url: this.resolveUrl(url),
          position: ++position,
          isAffiliate: false,
        });
      }
    }

    return links;
  }

  /**
   * Scrape Stan Store page
   */
  private scrapeStan(html: string): ScrapedLink[] {
    const links: ScrapedLink[] = [];
    let position = 0;

    // Stan uses product cards
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*class=[^>]*product[^>]*>([^<]+)<\/a>/gi;

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim();

      links.push({
        title,
        url: this.resolveUrl(url),
        position: ++position,
        isAffiliate: false,
      });
    }

    return links;
  }

  /**
   * Scrape Carrd page
   */
  private scrapeCarrd(html: string): ScrapedLink[] {
    return this.scrapeGeneric(html);
  }

  /**
   * Generic link scraper (fallback)
   */
  private scrapeGeneric(html: string): ScrapedLink[] {
    const links: ScrapedLink[] = [];
    let position = 0;

    // Find all <a> tags with href
    const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;

    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      const url = match[1];
      const title = match[2].trim() || 'Untitled Link';

      // Skip internal links, anchors, and social media profile links
      if (
        url &&
        !url.startsWith('#') &&
        !url.startsWith('javascript:') &&
        !url.startsWith('mailto:') &&
        !url.includes('instagram.com/') &&
        !url.includes('twitter.com/') &&
        !url.includes('tiktok.com/@') &&
        !url.includes('youtube.com/@')
      ) {
        links.push({
          title,
          url: this.resolveUrl(url),
          position: ++position,
          isAffiliate: false,
        });
      }
    }

    return links;
  }

  /**
   * Check if URL is an affiliate link
   */
  private isAffiliateLink(url: string): boolean {
    const affiliatePatterns = [
      /tag=/i,
      /ref=/i,
      /affiliate/i,
      /aff_id=/i,
      /affiliate_id=/i,
      /aid=/i,
      /partner=/i,
      /amzn\.to/i, // Amazon short links
      /shopmy\.us/i, // ShopMy
      /liketoknow\.it/i, // LTK
      /rstyle\.me/i, // RewardStyle
    ];

    return affiliatePatterns.some((pattern) => pattern.test(url));
  }

  /**
   * Detect affiliate network from URL
   */
  private detectNetwork(url: string): string | undefined {
    if (url.includes('amazon.com') || url.includes('amzn.to')) {
      return 'Amazon Associates';
    }
    if (url.includes('shopify.com')) {
      return 'Shopify';
    }
    if (url.includes('target.com')) {
      return 'Target Partners';
    }
    if (url.includes('walmart.com')) {
      return 'Walmart Affiliates';
    }
    if (url.includes('shopmy.us')) {
      return 'ShopMy';
    }
    if (url.includes('liketoknow.it') || url.includes('rstyle.me')) {
      return 'LTK';
    }
    return undefined;
  }

  /**
   * Extract affiliate tag from URL
   */
  private extractAffiliateTag(url: string): string | undefined {
    const patterns = [
      /tag=([^&]+)/i,
      /ref=([^&]+)/i,
      /aff_id=([^&]+)/i,
      /affiliate_id=([^&]+)/i,
      /aid=([^&]+)/i,
      /partner=([^&]+)/i,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Resolve relative URLs to absolute
   */
  private resolveUrl(url: string): string {
    // If already absolute, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // For relative URLs, we can't resolve without base URL
    // Return as-is and let user fix manually
    return url;
  }

  /**
   * Generate migration suggestions
   */
  private generateSuggestions(links: ScrapedLink[], platform: string): string[] {
    const suggestions: string[] = [];
    const affiliateLinks = links.filter((l) => l.isAffiliate);

    if (affiliateLinks.length > 0) {
      suggestions.push(
        `Found ${affiliateLinks.length} affiliate links - perfect candidates for SmartWrapper protection`
      );
    }

    if (affiliateLinks.length > 5) {
      suggestions.push(
        `With ${affiliateLinks.length} affiliate links, you could save hours per month by automating health checks`
      );
    }

    const amazonLinks = links.filter((l) => l.detectedNetwork === 'Amazon Associates');
    if (amazonLinks.length > 0) {
      suggestions.push(
        `Detected ${amazonLinks.length} Amazon links - enable stock-out detection to never promote unavailable products`
      );
    }

    if (platform !== 'generic') {
      suggestions.push(
        `Replace your ${platform} links with SmartWrapper redirects to gain full control and auto-fix broken links`
      );
    }

    suggestions.push(
      'Use waterfall routing to add backup destinations for your highest-earning links'
    );

    return suggestions;
  }
}
