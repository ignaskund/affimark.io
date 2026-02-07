/**
 * Redirect Chain Resolver
 *
 * Follows redirect chains for affiliate links to:
 * - Detect broken links (404, 500, timeout)
 * - Track every redirect hop with timing
 * - Detect redirect loops
 * - Measure total redirect time (affects user experience)
 */

import type { RedirectChainResult, RedirectHop } from '../../../LINK_AUDIT_TYPES';

interface ResolverOptions {
  maxHops?: number;
  timeout?: number;
  userAgent?: string;
}

export class RedirectResolver {
  private readonly maxHops: number;
  private readonly timeout: number;
  private readonly userAgent: string;

  constructor(options: ResolverOptions = {}) {
    this.maxHops = options.maxHops || 10;
    this.timeout = options.timeout || 15000; // 15 seconds
    this.userAgent = options.userAgent || 'Affimark-LinkGuard/1.0 (Link Health Monitor)';
  }

  /**
   * Follow redirect chain and return complete hop-by-hop data
   */
  async resolve(startUrl: string): Promise<RedirectChainResult> {
    const startTime = Date.now();
    const hops: RedirectHop[] = [];
    const visitedUrls = new Set<string>();

    let currentUrl = startUrl;
    let isBroken = false;
    let errorMessage: string | undefined;

    try {
      for (let i = 0; i < this.maxHops; i++) {
        // Detect redirect loop
        if (visitedUrls.has(currentUrl)) {
          isBroken = true;
          errorMessage = `Redirect loop detected at hop ${i + 1}: ${currentUrl}`;
          break;
        }

        visitedUrls.add(currentUrl);

        // Fetch with manual redirect handling
        const hopStartTime = Date.now();
        const response = await this.fetchNoRedirect(currentUrl);
        const hopEndTime = Date.now();

        const hop: RedirectHop = {
          url: currentUrl,
          status_code: response.status,
          timestamp: new Date().toISOString()
        };

        hops.push(hop);

        // Check for broken link
        if (response.status >= 400) {
          isBroken = true;
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          break;
        }

        // Check if this is a redirect
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('Location');

          if (!location) {
            isBroken = true;
            errorMessage = `Redirect response (${response.status}) missing Location header`;
            break;
          }

          // Resolve relative URLs
          try {
            currentUrl = new URL(location, currentUrl).toString();
          } catch {
            isBroken = true;
            errorMessage = `Invalid redirect URL: ${location}`;
            break;
          }
        } else {
          // Final destination reached (2xx response)
          break;
        }
      }

      // Check if we exceeded max hops
      if (hops.length >= this.maxHops && hops[hops.length - 1].status_code >= 300) {
        isBroken = true;
        errorMessage = `Exceeded maximum redirect hops (${this.maxHops})`;
      }

      const totalTime = Date.now() - startTime;
      const finalUrl = hops[hops.length - 1]?.url || startUrl;

      return {
        final_url: finalUrl,
        hops,
        total_time_ms: totalTime,
        is_broken: isBroken,
        error: errorMessage
      };

    } catch (error) {
      return {
        final_url: currentUrl,
        hops,
        total_time_ms: Date.now() - startTime,
        is_broken: true,
        error: error instanceof Error ? error.message : 'Unknown error during redirect resolution'
      };
    }
  }

  /**
   * Fetch URL without following redirects automatically
   */
  private async fetchNoRedirect(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'HEAD', // HEAD is faster and sufficient for redirect checking
        headers: {
          'User-Agent': this.userAgent,
          'Accept': '*/*'
        },
        redirect: 'manual', // Don't follow redirects automatically
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;

    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * Quick check if a link is broken (just final status, no hop details)
   */
  async isBroken(url: string): Promise<boolean> {
    try {
      const result = await this.resolve(url);
      return result.is_broken;
    } catch {
      return true;
    }
  }

  /**
   * Analyze redirect chain health
   */
  analyzeChainHealth(result: RedirectChainResult): {
    health_score: number;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    let healthScore = 100;

    // Check if broken
    if (result.is_broken) {
      issues.push(`Broken link: ${result.error}`);
      healthScore = 0;
      return { health_score: healthScore, issues, warnings };
    }

    // Check redirect count
    const redirectCount = result.hops.length - 1;
    if (redirectCount > 5) {
      warnings.push(`Excessive redirects (${redirectCount} hops)`);
      healthScore -= 20;
    } else if (redirectCount > 3) {
      warnings.push(`Multiple redirects (${redirectCount} hops)`);
      healthScore -= 10;
    }

    // Check total time
    if (result.total_time_ms > 5000) {
      warnings.push(`Slow redirect chain (${result.total_time_ms}ms)`);
      healthScore -= 15;
    } else if (result.total_time_ms > 3000) {
      warnings.push(`Moderately slow redirects (${result.total_time_ms}ms)`);
      healthScore -= 5;
    }

    // Check for HTTP (not HTTPS) in chain
    const hasInsecureHop = result.hops.some(hop => hop.url.startsWith('http://'));
    if (hasInsecureHop) {
      warnings.push('Chain includes insecure HTTP redirect');
      healthScore -= 10;
    }

    // Check for temporary redirects (302) vs permanent (301)
    const hasTempRedirect = result.hops.some(hop => hop.status_code === 302);
    if (hasTempRedirect) {
      warnings.push('Chain uses temporary redirects (302) - may be unstable');
      healthScore -= 5;
    }

    return {
      health_score: Math.max(0, healthScore),
      issues,
      warnings
    };
  }
}
