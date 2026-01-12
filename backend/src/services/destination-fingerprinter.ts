/**
 * Destination Fingerprinter Service
 * 
 * Creates and compares fingerprints of destination pages to detect
 * when page content has significantly changed (destination drift).
 */

interface FingerprintResult {
  fingerprint: string;
  has_changed: boolean;
  change_percentage?: number;
  page_title?: string;
  primary_image?: string;
}

export class DestinationFingerprinter {
  private readonly timeout = 10000;

  /**
   * Create fingerprint of a destination URL and compare with previous
   */
  async fingerprint(url: string, previousFingerprint?: string): Promise<FingerprintResult> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AffiMark-Fingerprinter/1.0',
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(this.timeout),
        redirect: 'follow',
      });

      if (!response.ok) {
        return {
          fingerprint: '',
          has_changed: false
        };
      }

      const html = await response.text();
      
      // Extract key elements for fingerprinting
      const title = this.extractTitle(html);
      const primaryImage = this.extractPrimaryImage(html, url);
      const contentHash = this.hashContent(html);
      
      // Create fingerprint from key elements
      const fingerprint = this.createFingerprint(title, primaryImage, contentHash);

      // Compare with previous fingerprint if provided
      let hasChanged = false;
      let changePercentage = 0;

      if (previousFingerprint) {
        const comparison = this.compareFingerprints(fingerprint, previousFingerprint);
        hasChanged = comparison.similarity < 0.8; // 80% similarity threshold
        changePercentage = Math.round((1 - comparison.similarity) * 100);
      }

      return {
        fingerprint,
        has_changed: hasChanged,
        change_percentage: changePercentage,
        page_title: title,
        primary_image: primaryImage
      };

    } catch (error) {
      console.error('Error fingerprinting destination:', error);
      return {
        fingerprint: '',
        has_changed: false
      };
    }
  }

  /**
   * Extract page title
   */
  private extractTitle(html: string): string | undefined {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return titleMatch ? titleMatch[1].trim() : undefined;
  }

  /**
   * Extract primary image (og:image or first large image)
   */
  private extractPrimaryImage(html: string, baseUrl: string): string | undefined {
    // Try og:image first
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) {
      return this.resolveUrl(ogMatch[1], baseUrl);
    }

    // Try first img src
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) {
      return this.resolveUrl(imgMatch[1], baseUrl);
    }

    return undefined;
  }

  /**
   * Resolve relative URL to absolute
   */
  private resolveUrl(url: string, baseUrl: string): string {
    try {
      return new URL(url, baseUrl).toString();
    } catch {
      return url;
    }
  }

  /**
   * Create a simple hash of the page content
   */
  private hashContent(html: string): string {
    // Remove scripts, styles, and normalize whitespace
    const normalized = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < Math.min(normalized.length, 10000); i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return hash.toString(16);
  }

  /**
   * Create fingerprint from extracted elements
   */
  private createFingerprint(title?: string, image?: string, contentHash?: string): string {
    const parts = [
      title || '',
      image || '',
      contentHash || ''
    ];
    return Buffer.from(parts.join('|')).toString('base64');
  }

  /**
   * Compare two fingerprints and return similarity score
   */
  private compareFingerprints(fp1: string, fp2: string): { similarity: number } {
    try {
      const decoded1 = Buffer.from(fp1, 'base64').toString();
      const decoded2 = Buffer.from(fp2, 'base64').toString();

      const parts1 = decoded1.split('|');
      const parts2 = decoded2.split('|');

      let matches = 0;
      const total = Math.max(parts1.length, parts2.length);

      for (let i = 0; i < total; i++) {
        if (parts1[i] === parts2[i]) {
          matches++;
        }
      }

      return { similarity: matches / total };

    } catch {
      // If we can't decode, treat as completely different
      return { similarity: 0 };
    }
  }
}

