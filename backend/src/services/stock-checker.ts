/**
 * Stock Availability Checker
 *
 * Checks if products are in stock across multiple merchants:
 * - Amazon (via Rainforest API)
 * - Google Shopping results (via SerpApi)
 * - Direct merchant scraping as fallback
 *
 * Returns stock status with confidence scores.
 */

import type { StockCheckResult, StockStatus } from '../../../LINK_AUDIT_TYPES';

interface StockCheckerOptions {
  rainforestApiKey?: string;
  serpApiKey?: string;
  timeout?: number;
}

interface AmazonProductData {
  product?: {
    buybox_winner?: {
      availability?: {
        raw?: string;
        type?: string;
      };
      price?: {
        value?: number;
        currency?: string;
      };
    };
  };
}

export class StockChecker {
  private readonly rainforestApiKey?: string;
  private readonly serpApiKey?: string;
  private readonly timeout: number;

  constructor(options: StockCheckerOptions = {}) {
    this.rainforestApiKey = options.rainforestApiKey;
    this.serpApiKey = options.serpApiKey;
    this.timeout = options.timeout || 10000;
  }

  /**
   * Check stock availability for a product URL
   */
  async checkStock(productUrl: string): Promise<StockCheckResult> {
    try {
      const url = new URL(productUrl);
      const hostname = url.hostname.toLowerCase();

      // Route to appropriate checker based on merchant
      if (hostname.includes('amazon.')) {
        return await this.checkAmazonStock(productUrl);
      } else if (hostname.includes('walmart.') || hostname.includes('target.') || hostname.includes('bestbuy.')) {
        return await this.checkGoogleShoppingStock(productUrl);
      } else {
        return await this.checkGenericStock(productUrl);
      }

    } catch (error) {
      return {
        product_url: productUrl,
        stock_status: 'unknown',
        last_checked: new Date().toISOString(),
        confidence: 0
      };
    }
  }

  /**
   * Check Amazon product stock via Rainforest API
   */
  private async checkAmazonStock(productUrl: string): Promise<StockCheckResult> {
    if (!this.rainforestApiKey) {
      return {
        product_url: productUrl,
        stock_status: 'unknown',
        last_checked: new Date().toISOString(),
        confidence: 0
      };
    }

    try {
      const asin = this.extractAmazonASIN(productUrl);
      if (!asin) {
        throw new Error('Could not extract ASIN from Amazon URL');
      }

      const params = new URLSearchParams({
        api_key: this.rainforestApiKey,
        type: 'product',
        asin,
        amazon_domain: this.extractAmazonDomain(productUrl)
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`https://api.rainforestapi.com/request?${params}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Rainforest API error: ${response.status}`);
      }

      const data: AmazonProductData = await response.json();
      const buybox = data.product?.buybox_winner;

      if (!buybox) {
        return {
          product_url: productUrl,
          stock_status: 'out_of_stock',
          last_checked: new Date().toISOString(),
          confidence: 80
        };
      }

      const availability = buybox.availability?.raw?.toLowerCase() || '';
      const availabilityType = buybox.availability?.type?.toLowerCase() || '';

      let stockStatus: StockStatus = 'unknown';
      let confidence = 90;

      if (availability.includes('out of stock') || availability.includes('unavailable') || availabilityType === 'out_of_stock') {
        stockStatus = 'out_of_stock';
      } else if (availability.includes('only') && availability.includes('left')) {
        stockStatus = 'low_stock';
      } else if (availability.includes('in stock') || availabilityType === 'in_stock') {
        stockStatus = 'in_stock';
      } else {
        confidence = 50;
      }

      return {
        product_url: productUrl,
        stock_status: stockStatus,
        price: buybox.price?.value,
        currency: buybox.price?.currency,
        last_checked: new Date().toISOString(),
        confidence
      };

    } catch (error) {
      return {
        product_url: productUrl,
        stock_status: 'unknown',
        last_checked: new Date().toISOString(),
        confidence: 0
      };
    }
  }

  /**
   * Check stock via Google Shopping (SerpApi)
   */
  private async checkGoogleShoppingStock(productUrl: string): Promise<StockCheckResult> {
    if (!this.serpApiKey) {
      return await this.checkGenericStock(productUrl);
    }

    try {
      // Extract product name from URL path
      const url = new URL(productUrl);
      const pathParts = url.pathname.split('/').filter(p => p);
      const productQuery = pathParts[pathParts.length - 1]?.replace(/-/g, ' ') || '';

      const params = new URLSearchParams({
        api_key: this.serpApiKey,
        engine: 'google_shopping',
        q: productQuery,
        location: 'United States'
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`https://serpapi.com/search?${params}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`SerpApi error: ${response.status}`);
      }

      const data: any = await response.json();
      const results = data.shopping_results || [];

      // Look for matching product
      const matchingProduct = results.find((result: any) => {
        const resultLink = result.link?.toLowerCase() || '';
        return resultLink.includes(url.hostname);
      });

      if (matchingProduct) {
        const delivery = matchingProduct.delivery?.toLowerCase() || '';
        const title = matchingProduct.title?.toLowerCase() || '';

        let stockStatus: StockStatus = 'in_stock';
        let confidence = 70;

        if (delivery.includes('out of stock') || title.includes('out of stock')) {
          stockStatus = 'out_of_stock';
          confidence = 85;
        } else if (delivery.includes('limited') || delivery.includes('low stock')) {
          stockStatus = 'low_stock';
          confidence = 80;
        }

        return {
          product_url: productUrl,
          stock_status: stockStatus,
          price: matchingProduct.extracted_price,
          currency: 'USD',
          last_checked: new Date().toISOString(),
          confidence
        };
      }

      return {
        product_url: productUrl,
        stock_status: 'unknown',
        last_checked: new Date().toISOString(),
        confidence: 30
      };

    } catch (error) {
      return await this.checkGenericStock(productUrl);
    }
  }

  /**
   * Generic stock check via page scraping (fallback)
   */
  private async checkGenericStock(productUrl: string): Promise<StockCheckResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Affimark-LinkGuard/1.0)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const lowerHtml = html.toLowerCase();

      let stockStatus: StockStatus = 'unknown';
      let confidence = 40;

      // Look for common stock indicators
      if (lowerHtml.includes('out of stock') || lowerHtml.includes('sold out') || lowerHtml.includes('unavailable')) {
        stockStatus = 'out_of_stock';
        confidence = 70;
      } else if (lowerHtml.includes('low stock') || lowerHtml.includes('only') && lowerHtml.includes('left')) {
        stockStatus = 'low_stock';
        confidence = 65;
      } else if (lowerHtml.includes('in stock') || lowerHtml.includes('add to cart') || lowerHtml.includes('buy now')) {
        stockStatus = 'in_stock';
        confidence = 60;
      }

      return {
        product_url: productUrl,
        stock_status: stockStatus,
        last_checked: new Date().toISOString(),
        confidence
      };

    } catch (error) {
      return {
        product_url: productUrl,
        stock_status: 'unknown',
        last_checked: new Date().toISOString(),
        confidence: 0
      };
    }
  }

  /**
   * Extract Amazon ASIN from URL
   */
  private extractAmazonASIN(url: string): string | null {
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/,
      /\/gp\/product\/([A-Z0-9]{10})/,
      /\/product\/([A-Z0-9]{10})/,
      /\/(B[A-Z0-9]{9})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Extract Amazon domain from URL
   */
  private extractAmazonDomain(url: string): string {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    if (hostname.includes('amazon.co.uk')) return 'amazon.co.uk';
    if (hostname.includes('amazon.ca')) return 'amazon.ca';
    if (hostname.includes('amazon.de')) return 'amazon.de';
    if (hostname.includes('amazon.fr')) return 'amazon.fr';
    if (hostname.includes('amazon.es')) return 'amazon.es';
    if (hostname.includes('amazon.it')) return 'amazon.it';
    if (hostname.includes('amazon.co.jp')) return 'amazon.co.jp';

    return 'amazon.com';
  }

  /**
   * Batch check multiple products
   */
  async checkMultiple(productUrls: string[]): Promise<StockCheckResult[]> {
    const results = await Promise.allSettled(
      productUrls.map(url => this.checkStock(url))
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          product_url: productUrls[index],
          stock_status: 'unknown' as StockStatus,
          last_checked: new Date().toISOString(),
          confidence: 0
        };
      }
    });
  }
}
