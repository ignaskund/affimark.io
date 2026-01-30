/**
 * Amazon Direct Scraper
 * 
 * Scrapes Amazon product pages directly without relying on third-party APIs.
 * Uses anti-detection measures and rate limiting to avoid blocks.
 * 
 * Features:
 * - Extract product data (title, price, images, ratings, availability)
 * - Handle various Amazon page layouts
 * - CAPTCHA/bot detection with graceful fallback
 * - Rate limiting to avoid IP bans
 */

import {
    generateBrowserHeaders,
    extractAsinFromUrl,
    buildAmazonUrl,
    detectBotBlock,
    parsePrice,
    cleanText,
    RateLimiter,
    addRandomDelay,
} from '../utils/scraper-utils';

export interface ScrapedProduct {
    asin: string;
    title: string;
    price: number | null;
    currency: string;
    imageUrl: string | null;
    additionalImages: string[];
    rating: number | null;
    reviewCount: number | null;
    availability: 'in_stock' | 'out_of_stock' | 'unknown';
    brand: string | null;
    description: string | null;
    features: string[];
    productUrl: string;
    scrapedAt: string;
}

export interface ScrapeResult {
    success: boolean;
    product?: ScrapedProduct;
    error?: string;
    blocked?: boolean;
}

export class AmazonDirectScraper {
    private rateLimiter: RateLimiter;
    private domain: string;

    constructor(options?: { requestsPerSecond?: number; domain?: string }) {
        this.rateLimiter = new RateLimiter(options?.requestsPerSecond || 0.5); // Conservative: 1 request per 2 seconds
        this.domain = options?.domain || 'amazon.com';
    }

    /**
     * Scrape a product by ASIN
     */
    async scrapeProduct(asin: string): Promise<ScrapeResult> {
        try {
            await this.rateLimiter.waitForSlot();
            await addRandomDelay(300, 800); // Extra randomization

            const url = buildAmazonUrl(asin, this.domain);
            const headers = generateBrowserHeaders();

            console.log(`[AmazonDirectScraper] Fetching ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers,
                redirect: 'follow',
            });

            if (!response.ok) {
                console.error(`[AmazonDirectScraper] HTTP error: ${response.status}`);
                return {
                    success: false,
                    error: `HTTP ${response.status}: ${response.statusText}`,
                };
            }

            const html = await response.text();

            // Check for bot detection
            if (detectBotBlock(html)) {
                console.warn('[AmazonDirectScraper] Bot block detected');
                return {
                    success: false,
                    error: 'Bot detection triggered - CAPTCHA required',
                    blocked: true,
                };
            }

            // Parse the product data
            const product = this.parseProductPage(html, asin, url);

            if (!product.title) {
                return {
                    success: false,
                    error: 'Could not extract product data - page structure may have changed',
                };
            }

            return {
                success: true,
                product,
            };

        } catch (error) {
            console.error('[AmazonDirectScraper] Scrape error:', error);
            return {
                success: false,
                error: (error as Error).message,
            };
        }
    }

    /**
     * Scrape a product from URL (extracts ASIN first)
     */
    async scrapeFromUrl(url: string): Promise<ScrapeResult> {
        const asin = extractAsinFromUrl(url);
        if (!asin) {
            return {
                success: false,
                error: 'Could not extract ASIN from URL',
            };
        }
        return this.scrapeProduct(asin);
    }

    /**
     * Parse product data from HTML
     */
    private parseProductPage(html: string, asin: string, url: string): ScrapedProduct {
        const product: ScrapedProduct = {
            asin,
            title: '',
            price: null,
            currency: 'USD',
            imageUrl: null,
            additionalImages: [],
            rating: null,
            reviewCount: null,
            availability: 'unknown',
            brand: null,
            description: null,
            features: [],
            productUrl: url,
            scrapedAt: new Date().toISOString(),
        };

        // Extract title - multiple patterns for different page layouts
        product.title = this.extractTitle(html);

        // Extract price
        const priceData = this.extractPrice(html);
        if (priceData) {
            product.price = priceData.value;
            product.currency = priceData.currency;
        }

        // Extract main image
        product.imageUrl = this.extractMainImage(html);

        // Extract additional images
        product.additionalImages = this.extractAdditionalImages(html);

        // Extract rating
        product.rating = this.extractRating(html);

        // Extract review count
        product.reviewCount = this.extractReviewCount(html);

        // Extract availability
        product.availability = this.extractAvailability(html);

        // Extract brand
        product.brand = this.extractBrand(html);

        // Extract description
        product.description = this.extractDescription(html);

        // Extract feature bullets
        product.features = this.extractFeatures(html);

        return product;
    }

    /**
     * Extract product title
     */
    private extractTitle(html: string): string {
        // Pattern 1: Product title span
        const titlePatterns = [
            /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i,
            /<h1[^>]*id="title"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/is,
            /<span[^>]*class="[^"]*a-size-large[^"]*product-title[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<h1[^>]*class="[^"]*product-title[^"]*"[^>]*>([^<]+)<\/h1>/i,
        ];

        for (const pattern of titlePatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return cleanText(match[1]);
            }
        }

        return '';
    }

    /**
     * Extract price
     */
    private extractPrice(html: string): { value: number; currency: string } | null {
        // Pattern 1: Common price span with class
        const pricePatterns = [
            /<span[^>]*class="[^"]*a-price-whole[^"]*"[^>]*>([^<]+)<\/span>[^<]*<span[^>]*class="[^"]*a-price-fraction[^"]*"[^>]*>([^<]+)<\/span>/i,
            /<span[^>]*id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/i,
            /<span[^>]*id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/i,
            /<span[^>]*class="[^"]*apexPriceToPay[^"]*"[^>]*>.*?<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/is,
            /<span[^>]*class="[^"]*a-price[^"]*"[^>]*>.*?<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/is,
            /<span[^>]*data-a-color="price"[^>]*>.*?<span[^>]*class="[^"]*a-offscreen[^"]*"[^>]*>([^<]+)<\/span>/is,
        ];

        // Try combined whole + fraction pattern first
        const combinedMatch = html.match(pricePatterns[0]);
        if (combinedMatch && combinedMatch[1] && combinedMatch[2]) {
            const whole = combinedMatch[1].replace(/[^0-9]/g, '');
            const fraction = combinedMatch[2].replace(/[^0-9]/g, '');
            const price = parseFloat(`${whole}.${fraction}`);
            if (!isNaN(price)) {
                return { value: price, currency: 'USD' };
            }
        }

        // Try other patterns
        for (let i = 1; i < pricePatterns.length; i++) {
            const match = html.match(pricePatterns[i]);
            if (match && match[1]) {
                const parsed = parsePrice(match[1]);
                if (parsed) return parsed;
            }
        }

        return null;
    }

    /**
     * Extract main product image
     */
    private extractMainImage(html: string): string | null {
        const imagePatterns = [
            /<img[^>]*id="landingImage"[^>]*(?:data-old-hires|src)="([^"]+)"/i,
            /<img[^>]*id="imgBlkFront"[^>]*src="([^"]+)"/i,
            /<img[^>]*class="[^"]*a-dynamic-image[^"]*"[^>]*(?:data-old-hires|src)="([^"]+)"/i,
            /"hiRes":"([^"]+)"/,
            /"large":"([^"]+)"/,
        ];

        for (const pattern of imagePatterns) {
            const match = html.match(pattern);
            if (match && match[1] && !match[1].includes('data:image')) {
                return match[1];
            }
        }

        return null;
    }

    /**
     * Extract additional product images
     */
    private extractAdditionalImages(html: string): string[] {
        const images: string[] = [];

        // Look for image data in the page's JSON
        const hiResPattern = /"hiRes"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = hiResPattern.exec(html)) !== null) {
            if (match[1] && !match[1].includes('data:image') && !images.includes(match[1])) {
                images.push(match[1]);
            }
        }

        return images.slice(0, 10); // Limit to 10 images
    }

    /**
     * Extract rating
     */
    private extractRating(html: string): number | null {
        const ratingPatterns = [
            /<span[^>]*class="[^"]*a-icon-alt[^"]*"[^>]*>([0-9.]+)\s*out of\s*5/i,
            /<i[^>]*class="[^"]*a-star-[0-9-]+[^"]*"[^>]*>.*?<span[^>]*>([0-9.]+)\s*out of/is,
            /data-asin-average-rating="([0-9.]+)"/i,
        ];

        for (const pattern of ratingPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                const rating = parseFloat(match[1]);
                if (!isNaN(rating) && rating >= 0 && rating <= 5) {
                    return rating;
                }
            }
        }

        return null;
    }

    /**
     * Extract review count
     */
    private extractReviewCount(html: string): number | null {
        const reviewPatterns = [
            /<span[^>]*id="acrCustomerReviewText"[^>]*>([0-9,]+)\s*(?:global\s*)?ratings?/i,
            /data-asin-review-count="([0-9]+)"/i,
            />([0-9,]+)\s+ratings</i,
        ];

        for (const pattern of reviewPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                const count = parseInt(match[1].replace(/,/g, ''), 10);
                if (!isNaN(count)) {
                    return count;
                }
            }
        }

        return null;
    }

    /**
     * Extract availability status
     */
    private extractAvailability(html: string): 'in_stock' | 'out_of_stock' | 'unknown' {
        const lowerHtml = html.toLowerCase();

        // Check for out of stock indicators
        const outOfStockPatterns = [
            'currently unavailable',
            'out of stock',
            'not available',
            'we don\'t know when or if this item will be back in stock',
        ];

        for (const pattern of outOfStockPatterns) {
            if (lowerHtml.includes(pattern)) {
                return 'out_of_stock';
            }
        }

        // Check for in stock indicators
        const inStockPatterns = [
            'in stock',
            'add to cart',
            'buy now',
            'only \\d+ left in stock',
        ];

        for (const pattern of inStockPatterns) {
            if (pattern.includes('\\d')) {
                if (new RegExp(pattern, 'i').test(lowerHtml)) {
                    return 'in_stock';
                }
            } else if (lowerHtml.includes(pattern)) {
                return 'in_stock';
            }
        }

        return 'unknown';
    }

    /**
     * Extract brand
     */
    private extractBrand(html: string): string | null {
        const brandPatterns = [
            /<a[^>]*id="bylineInfo"[^>]*>.*?(?:Visit the|Brand:)\s*([^<]+)</is,
            /<tr[^>]*class="[^"]*po-brand[^"]*"[^>]*>.*?<span[^>]*class="[^"]*po-break-word[^"]*"[^>]*>([^<]+)</is,
            /data-brand="([^"]+)"/i,
        ];

        for (const pattern of brandPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return cleanText(match[1]).replace(/^(Visit the |Brand: )/i, '').replace(/ Store$/, '');
            }
        }

        return null;
    }

    /**
     * Extract product description
     */
    private extractDescription(html: string): string | null {
        const descPatterns = [
            /<div[^>]*id="productDescription"[^>]*>.*?<p[^>]*>([^<]+)</is,
            /<div[^>]*id="productDescription_feature_div"[^>]*>.*?<p[^>]*>([^<]+)</is,
        ];

        for (const pattern of descPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                return cleanText(match[1]);
            }
        }

        return null;
    }

    /**
     * Extract feature bullets
     */
    private extractFeatures(html: string): string[] {
        const features: string[] = [];

        // Look for feature bullets list
        const bulletPattern = /<li[^>]*class="[^"]*a-spacing-mini[^"]*"[^>]*>.*?<span[^>]*class="[^"]*a-list-item[^"]*"[^>]*>([^<]+)</gi;
        let match;
        while ((match = bulletPattern.exec(html)) !== null) {
            const feature = cleanText(match[1]);
            if (feature && feature.length > 10 && !features.includes(feature)) {
                features.push(feature);
            }
        }

        return features.slice(0, 10); // Limit to 10 features
    }
}
