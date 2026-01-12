/**
 * Link Crawler Service
 * 
 * Crawls link-in-bio pages (Linktree, Beacons, Stan Store, etc.)
 * to extract all affiliate links for auditing.
 */

interface CrawlResult {
  success: boolean;
  links_found: ExtractedLink[];
  page_title?: string;
  error?: string;
}

interface ExtractedLink {
  url: string;
  text?: string;
  position: number;
  link_type: 'external' | 'internal' | 'affiliate';
}

export class LinkCrawler {
  private readonly userAgent = 'AffiMark-LinkAudit/1.0';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Crawl a page and extract all links
   */
  async crawl(pageUrl: string): Promise<CrawlResult> {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        return {
          success: false,
          links_found: [],
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const html = await response.text();
      const links = this.extractLinks(html, pageUrl);
      const pageTitle = this.extractTitle(html);

      return {
        success: true,
        links_found: links,
        page_title: pageTitle
      };

    } catch (error) {
      return {
        success: false,
        links_found: [],
        error: error instanceof Error ? error.message : 'Crawl failed'
      };
    }
  }

  /**
   * Extract links from HTML content
   */
  private extractLinks(html: string, baseUrl: string): ExtractedLink[] {
    const links: ExtractedLink[] = [];
    
    // Match anchor tags with href attributes
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)/gi;
    let match;
    let position = 0;

    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].trim();

      // Skip internal anchors, javascript, and mailto links
      if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
        continue;
      }

      // Resolve relative URLs
      let absoluteUrl = href;
      try {
        absoluteUrl = new URL(href, baseUrl).toString();
      } catch {
        continue;
      }

      // Determine link type
      const linkType = this.classifyLink(absoluteUrl, baseUrl);

      links.push({
        url: absoluteUrl,
        text: text || undefined,
        position: position++,
        link_type: linkType
      });
    }

    return links;
  }

  /**
   * Classify a link as external, internal, or affiliate
   */
  private classifyLink(url: string, baseUrl: string): 'external' | 'internal' | 'affiliate' {
    try {
      const linkHost = new URL(url).hostname;
      const baseHost = new URL(baseUrl).hostname;

      // Internal link
      if (linkHost === baseHost) {
        return 'internal';
      }

      // Known affiliate patterns
      const affiliatePatterns = [
        /amazon\.[a-z]+.*[?&]tag=/i,
        /amzn\.to/i,
        /shareasale\.com/i,
        /go\.impact\.com/i,
        /pntra\.com/i,
        /pjtra\.com/i,
        /pjatr\.com/i,
        /sjv\.io/i,
        /rstyle\.me/i,
        /shopstyle\./i,
        /howl\.me/i,
        /skimresources\.com/i,
        /awin1\.com/i,
        /anrdoezrs\.net/i,
        /tkqlhce\.com/i,
        /jdoqocy\.com/i,
        /kqzyfj\.com/i,
        /dpbolvw\.net/i,
        /afcpatrk\.com/i,
        /commissionjunction\./i,
        /rakuten/i,
      ];

      for (const pattern of affiliatePatterns) {
        if (pattern.test(url)) {
          return 'affiliate';
        }
      }

      return 'external';

    } catch {
      return 'external';
    }
  }

  /**
   * Extract page title from HTML
   */
  private extractTitle(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : undefined;
  }
}

