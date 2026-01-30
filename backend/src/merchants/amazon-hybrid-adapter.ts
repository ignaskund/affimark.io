/**
 * Amazon Hybrid Adapter
 * 
 * Combines custom direct scraping with optional API fallback.
 * Strategy:
 * 1. Try custom scraper first (free)
 * 2. If blocked or failed, fall back to third-party API (if configured)
 * 3. Cache successful results for 24h
 * 
 * This approach minimizes API costs while maintaining reliability.
 */

import { BaseAdapter } from './base-adapter';
import {
    ProductSearchParams,
    ProductSearchResult,
    ProductData,
    AffiliateLinkParams,
    MerchantEnv,
    MerchantError,
    MerchantErrorType
} from './types';
import { AmazonDirectScraper, ScrapedProduct, ScrapeResult } from '../services/amazon-direct-scraper';
import { extractAsinFromUrl, buildAmazonUrl } from '../utils/scraper-utils';

export class AmazonHybridAdapter extends BaseAdapter {
    private scraper: AmazonDirectScraper;
    private fallbackEnabled: boolean;

    constructor(env: MerchantEnv) {
        super(env);
        this.scraper = new AmazonDirectScraper({
            requestsPerSecond: 0.5, // Conservative rate
            domain: 'amazon.com',
        });
        // Enable fallback if a paid API key is configured
        this.fallbackEnabled = Boolean(env.RAINFOREST_API_KEY || env.SCRAPINGDOG_API_KEY);
    }

    getMerchantName(): string {
        return 'Amazon';
    }

    getMerchantKey(): string {
        return 'amazon';
    }

    /**
     * Search products - uses fallback API since search requires special handling
     */
    async search(params: ProductSearchParams): Promise<ProductSearchResult> {
        // For search, we still need to use a third-party API
        // Direct scraping of search results is more complex and prone to blocks
        if (this.fallbackEnabled && this.env.RAINFOREST_API_KEY) {
            return this.searchWithRainforest(params);
        }

        throw new MerchantError(
            'Product search requires API access. Please configure RAINFOREST_API_KEY or SCRAPINGDOG_API_KEY.',
            MerchantErrorType.API_ERROR
        );
    }

    /**
     * Get product details - tries custom scraper first, falls back to API
     */
    async getProduct(externalId: string): Promise<ProductData> {
        const asin = externalId.toUpperCase();
        console.log(`[AmazonHybridAdapter] Getting product ${asin}`);

        // Step 1: Try custom scraper
        const scrapeResult = await this.scraper.scrapeProduct(asin);

        if (scrapeResult.success && scrapeResult.product) {
            console.log(`[AmazonHybridAdapter] Custom scraper succeeded for ${asin}`);
            return this.transformScrapedProduct(scrapeResult.product);
        }

        console.warn(`[AmazonHybridAdapter] Custom scraper failed: ${scrapeResult.error}`);

        // Step 2: Fall back to API if available and scraper was blocked
        if (this.fallbackEnabled && scrapeResult.blocked) {
            console.log(`[AmazonHybridAdapter] Falling back to API for ${asin}`);
            return this.getProductFromApi(asin);
        }

        // Step 3: If not blocked, retry once with a longer delay
        if (!scrapeResult.blocked) {
            console.log(`[AmazonHybridAdapter] Retrying scrape for ${asin}`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay

            const retryResult = await this.scraper.scrapeProduct(asin);
            if (retryResult.success && retryResult.product) {
                return this.transformScrapedProduct(retryResult.product);
            }

            // Final fallback to API
            if (this.fallbackEnabled) {
                return this.getProductFromApi(asin);
            }
        }

        throw new MerchantError(
            `Failed to fetch product ${asin}: ${scrapeResult.error}`,
            scrapeResult.blocked ? MerchantErrorType.RATE_LIMIT_ERROR : MerchantErrorType.API_ERROR
        );
    }

    /**
     * Generate affiliate link
     */
    async getAffiliateLink(params: AffiliateLinkParams): Promise<string> {
        const asin = extractAsinFromUrl(params.productUrl);
        if (!asin) {
            throw new MerchantError(
                'Could not extract ASIN from product URL',
                MerchantErrorType.INVALID_PARAMS
            );
        }

        // Build Amazon affiliate link
        const baseUrl = `https://www.amazon.com/dp/${asin}`;
        const queryParams: Record<string, string> = {
            tag: params.affiliateId,
        };

        if (params.subId) {
            queryParams.linkId = params.subId;
        }

        if (params.customParams) {
            Object.assign(queryParams, params.customParams);
        }

        const queryString = this.buildQueryString(queryParams);
        return `${baseUrl}?${queryString}`;
    }

    /**
     * Validate credentials - check if scraper is working
     */
    async validateCredentials(): Promise<boolean> {
        try {
            // Test with a known product (Amazon Basics)
            const testAsin = 'B07FZ8S74R';
            const result = await this.scraper.scrapeProduct(testAsin);
            return result.success;
        } catch (error) {
            console.error('[AmazonHybridAdapter] Validation failed:', error);
            return false;
        }
    }

    /**
     * Transform scraped product to ProductData format
     */
    private transformScrapedProduct(scraped: ScrapedProduct): ProductData {
        return {
            merchant_id: 'amazon', // Will be set properly by ProductDataService
            external_id: scraped.asin,
            product_name: scraped.title,
            description: scraped.description || '',
            price: scraped.price || 0,
            currency: scraped.currency,
            image_url: scraped.imageUrl || '',
            additional_images: scraped.additionalImages,
            product_url: scraped.productUrl,
            brand: scraped.brand || undefined,
            availability: scraped.availability,
            rating: scraped.rating || undefined,
            review_count: scraped.reviewCount || undefined,
            features: scraped.features,
            data_cache: scraped,
        };
    }

    /**
     * Fallback: Get product from Rainforest API
     */
    private async getProductFromApi(asin: string): Promise<ProductData> {
        if (!this.env.RAINFOREST_API_KEY) {
            throw new MerchantError(
                'No fallback API configured',
                MerchantErrorType.API_ERROR
            );
        }

        try {
            const params = new URLSearchParams({
                api_key: this.env.RAINFOREST_API_KEY,
                type: 'product',
                amazon_domain: 'amazon.com',
                asin: asin,
            });

            const response = await fetch(`https://api.rainforestapi.com/request?${params}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error(`Rainforest API error: ${response.status}`);
            }

            const data = await response.json() as any;

            if (!data.request_info?.success) {
                throw new Error('Rainforest API request failed');
            }

            const product = data.product;

            return {
                merchant_id: 'amazon',
                external_id: product.asin,
                product_name: product.title,
                description: product.description || '',
                price: product.buybox_winner?.price?.value || 0,
                currency: product.buybox_winner?.price?.currency || 'USD',
                image_url: product.main_image?.link || '',
                additional_images: product.images?.map((img: any) => img.link) || [],
                product_url: product.link,
                brand: product.brand,
                availability: this.mapAvailability(product.buybox_winner?.availability?.type),
                rating: product.rating,
                review_count: product.ratings_total,
                features: product.feature_bullets || [],
                data_cache: product,
            };

        } catch (error) {
            throw new MerchantError(
                `API fallback failed: ${(error as Error).message}`,
                MerchantErrorType.API_ERROR,
                error
            );
        }
    }

    /**
     * Fallback: Search with Rainforest API
     */
    private async searchWithRainforest(params: ProductSearchParams): Promise<ProductSearchResult> {
        if (!this.env.RAINFOREST_API_KEY) {
            throw new MerchantError(
                'Search requires RAINFOREST_API_KEY',
                MerchantErrorType.API_ERROR
            );
        }

        try {
            const queryParams = new URLSearchParams({
                api_key: this.env.RAINFOREST_API_KEY,
                type: 'search',
                amazon_domain: 'amazon.com',
                search_term: params.query,
                page: String(params.page || 1),
            });

            const response = await fetch(`https://api.rainforestapi.com/request?${queryParams}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error(`Rainforest API error: ${response.status}`);
            }

            const data = await response.json() as any;

            if (!data.request_info?.success) {
                throw new Error('Rainforest API request failed');
            }

            const products: ProductData[] = data.search_results.map((item: any) => ({
                merchant_id: 'amazon',
                external_id: item.asin,
                product_name: item.title,
                description: '',
                price: item.prices?.[0]?.value || 0,
                currency: item.prices?.[0]?.currency || 'USD',
                image_url: item.image,
                product_url: item.link,
                rating: item.rating,
                review_count: item.ratings_total,
                availability: 'unknown' as const,
                data_cache: item,
            }));

            const limit = params.limit || 20;
            const total = data.pagination?.total_results || products.length;

            return {
                products,
                total,
                page: params.page || 1,
                limit,
                has_more: (params.page || 1) * limit < total,
            };

        } catch (error) {
            throw new MerchantError(
                `Search failed: ${(error as Error).message}`,
                MerchantErrorType.API_ERROR,
                error
            );
        }
    }

    /**
     * Map availability string to enum
     */
    private mapAvailability(type?: string): 'in_stock' | 'out_of_stock' | 'unknown' {
        if (!type) return 'unknown';
        const lower = type.toLowerCase();
        if (lower === 'in_stock') return 'in_stock';
        if (lower.includes('out')) return 'out_of_stock';
        return 'unknown';
    }
}
