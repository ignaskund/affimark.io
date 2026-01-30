/**
 * Storefront Scraper Service
 * Deep scrapes creator storefronts to extract product details
 * 
 * Supports: Amazon Storefronts, LTK, ShopMy, ShopStyle
 */

import {
    generateBrowserHeaders,
    addRandomDelay,
    RateLimiter,
} from '../utils/scraper-utils';

export interface StorefrontProduct {
    title: string;
    url: string;
    imageUrl?: string;
    price?: string;
    brand?: string;
}

export interface StorefrontScrapeResult {
    success: boolean;
    platform: string;
    storefrontUrl: string;
    products: StorefrontProduct[];
    error?: string;
}

const rateLimiter = new RateLimiter(0.5); // 0.5 requests per second

/**
 * Scrape products from any storefront URL
 */
export async function scrapeStorefront(
    url: string,
    maxProducts: number = 5
): Promise<StorefrontScrapeResult> {
    const lowerUrl = url.toLowerCase();

    // Determine platform and route to appropriate scraper
    if (lowerUrl.includes('shopltk.com') || lowerUrl.includes('liketk.it') || lowerUrl.includes('ltk.app')) {
        return scrapeLTKStorefront(url, maxProducts);
    }

    if (lowerUrl.includes('amazon.com') || lowerUrl.includes('urlgeni.us/amazon')) {
        return scrapeAmazonStorefront(url, maxProducts);
    }

    if (lowerUrl.includes('shopmy.us')) {
        return scrapeShopMyStorefront(url, maxProducts);
    }

    if (lowerUrl.includes('shopstyle.it') || lowerUrl.includes('rstyle.me')) {
        return scrapeShopStyleStorefront(url, maxProducts);
    }

    // Default: try generic scraping
    return scrapeGenericStorefront(url, maxProducts);
}

/**
 * Scrape LTK Storefront
 * LTK uses Nuxt.js/Vue and embeds product data in server-rendered HTML
 * 
 * Key patterns in raw HTML:
 * 1. Product titles in: <h2 class="product-card__title...">Title</h2>
 * 2. Prices as: $XX.XX text  
 * 3. URLs as: rstyle.me/+XXX (HTML encoded with &amp;)
 * 4. productDetails JS object with structured data
 */
async function scrapeLTKStorefront(url: string, maxProducts: number): Promise<StorefrontScrapeResult> {
    await rateLimiter.waitForSlot();

    try {
        const response = await fetch(url, {
            headers: generateBrowserHeaders(),
        });

        if (!response.ok) {
            return { success: false, platform: 'ltk', storefrontUrl: url, products: [], error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const products: StorefrontProduct[] = [];
        const seenTitles = new Set<string>();

        console.log(`LTK: Fetched HTML (${html.length} chars) from ${url}`);

        // ========================================
        // METHOD 1 (PRIMARY): Extract productDetails from inline JavaScript
        // LTK embeds product data like: productDetails:{"hash":{id:...,name:"Product Name",price:XX}}
        // ========================================

        // Simple pattern - limit match length to avoid performance issues
        const productDetailsPattern = /name:"([^"]{5,200})"/g;
        let match;

        while ((match = productDetailsPattern.exec(html)) !== null && products.length < maxProducts * 2) { // Get more initially
            let title = match[1]
                .replace(/\\n/g, ' ')  // Replace escaped newlines
                .replace(/\s+/g, ' ')  // Collapse whitespace
                .trim();

            // Clean up truncated titles (ending with ...)
            if (title.endsWith('...')) {
                title = title.slice(0, -3).trim();
            }

            // Skip if we've seen this title (dedup)
            if (seenTitles.has(title.toLowerCase())) continue;
            seenTitles.add(title.toLowerCase());

            // Skip navigation/non-product content
            const titleLower = title.toLowerCase();
            if (titleLower.includes('ltk shop') ||
                titleLower.includes("'s ltk") ||
                titleLower.includes('terms') ||
                titleLower.includes('privacy') ||
                titleLower.includes('sign in') ||
                titleLower.includes('profile')) {
                continue;
            }

            products.push({
                title: title.substring(0, 150),
                url: '', // Will be filled with rstyle URL below
            });

            console.log(`LTK: Found product from JS: "${title.slice(0, 40)}..."`);
        }

        console.log(`LTK: productDetails extraction found ${products.length} products`);

        // ========================================
        // METHOD 2: Extract from product-card__title HTML elements
        // Pattern: <h2 class="product-card__title...">Title</h2>
        // ========================================
        if (products.length < maxProducts) {
            const productCardPattern = /<h2[^>]*class="[^"]*product-card__title[^"]*"[^>]*>([^<]+)<\/h2>/gi;

            while ((match = productCardPattern.exec(html)) !== null && products.length < maxProducts) {
                const title = match[1].trim();

                if (seenTitles.has(title.toLowerCase())) continue;
                seenTitles.add(title.toLowerCase());

                const titleLower = title.toLowerCase();
                if (titleLower.includes('ltk shop') ||
                    titleLower.includes('terms') ||
                    title.length < 3) {
                    continue;
                }

                products.push({
                    title: title.substring(0, 150),
                    url: '',
                });

                console.log(`LTK: Found product from HTML: "${title.slice(0, 40)}..."`);
            }

            console.log(`LTK: After HTML extraction, total ${products.length} products`);
        }

        // ========================================
        // METHOD 3: Extract rstyle.me URLs and assign to products
        // URLs appear as: rstyle.me/+XXX?... (HTML encoded)
        // ========================================
        const rstyleUrls: string[] = [];
        const rstylePattern = /https?:\/\/(?:www\.)?rstyle\.me\/\+[A-Za-z0-9_-]+[^"'\s]*/gi;
        const seenUrls = new Set<string>();

        while ((match = rstylePattern.exec(html)) !== null) {
            // Decode HTML entities
            let cleanUrl = match[0]
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"');

            // Get base URL without query params for dedup
            const baseUrl = cleanUrl.split('?')[0];
            if (seenUrls.has(baseUrl)) continue;
            seenUrls.add(baseUrl);

            rstyleUrls.push(cleanUrl);
        }

        console.log(`LTK: Found ${rstyleUrls.length} unique rstyle.me URLs`);

        // Assign URLs to products (in order)
        for (let i = 0; i < products.length && i < rstyleUrls.length; i++) {
            products[i].url = rstyleUrls[i];
        }

        // ========================================
        // METHOD 4: Extract standalone prices and associate
        // Pattern: $XX.XX
        // ========================================
        const prices: string[] = [];
        const pricePattern = /\$([0-9]+\.[0-9]{2})/g;

        while ((match = pricePattern.exec(html)) !== null && prices.length < maxProducts * 2) {
            prices.push(`$${match[1]}`);
        }

        // Assign prices to products (heuristic: prices often appear in order)
        for (let i = 0; i < products.length && i < prices.length; i++) {
            if (!products[i].price) {
                products[i].price = prices[i];
            }
        }

        // ========================================
        // METHOD 5: If no products found but we have URLs, create products from URLs
        // and enrich via redirect following
        // ========================================
        if (products.length === 0 && rstyleUrls.length > 0) {
            console.log('LTK: No titles found, falling back to URL-based extraction...');

            for (const productUrl of rstyleUrls.slice(0, maxProducts)) {
                try {
                    await rateLimiter.waitForSlot();
                    await addRandomDelay(200, 500);

                    const enriched = await followLTKRedirect(productUrl);
                    if (enriched) {
                        products.push(enriched);
                        console.log(`LTK: Enriched "${enriched.title.slice(0, 40)}..."`);
                    }
                } catch (e) {
                    console.log(`LTK: Failed to enrich ${productUrl}:`, e);
                }
            }
        }

        // Filter out products without URLs
        const validProducts = products.filter(p => p.url && p.url.length > 0);

        // Final result
        if (validProducts.length === 0) {
            console.error('LTK: ⚠️ NO PRODUCTS EXTRACTED!');
            console.error('LTK: HTML preview (first 500 chars):', html.substring(0, 500));
            return { success: false, platform: 'ltk', storefrontUrl: url, products: [], error: 'No products found on page' };
        }

        console.log(`LTK: Successfully extracted ${validProducts.length} products`);
        return { success: true, platform: 'ltk', storefrontUrl: url, products: validProducts.slice(0, maxProducts) };

    } catch (error: any) {
        console.error('LTK: Scrape error:', error);
        return { success: false, platform: 'ltk', storefrontUrl: url, products: [], error: error.message };
    }
}

/**
 * Follow an LTK redirect link to get the actual product title from the retailer
 * This is what the old scraper did successfully
 */
async function followLTKRedirect(url: string): Promise<StorefrontProduct | null> {
    try {
        console.log(`LTK: Following redirect: ${url}`);

        const response = await fetch(url, {
            headers: generateBrowserHeaders(),
            redirect: 'follow', // Follow redirects automatically
            signal: AbortSignal.timeout(5000), // 5 second timeout (LTK redirects can be slow)
        });

        if (!response.ok) {
            console.log(`LTK: HTTP ${response.status} for ${url}`);
            return null;
        }

        const finalUrl = response.url; // Get the final destination URL
        console.log(`LTK: Redirect landed on: ${finalUrl.substring(0, 80)}...`);

        const html = await response.text();
        console.log(`LTK: Fetched ${html.length} chars from destination`);

        // Check if we got blocked or redirected to an error page
        if (html.includes('captcha') || html.includes('robot') || html.includes('blocked')) {
            console.log(`LTK: Destination page appears to be a CAPTCHA/block page`);
            return null;
        }

        // Extract title from the destination page
        let title: string | undefined;

        // Strategy 1: <title> tag
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) {
            title = titleMatch[1]
                .replace(/\s*[\|\-:]\s*(Amazon|eBay|Walmart|Target).*$/i, '') // Remove store name suffix
                .trim();
        }

        // Strategy 2: og:title meta tag
        if (!title || title.length < 5) {
            const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
            if (ogTitleMatch) {
                title = ogTitleMatch[1].trim();
            }
        }

        // Strategy 3: Product name in JSON-LD
        if (!title || title.length < 5) {
            const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/i);
            if (jsonLdMatch) {
                try {
                    const data = JSON.parse(jsonLdMatch[1]);
                    if (data.name) {
                        title = data.name;
                    } else if (Array.isArray(data) && data[0]?.name) {
                        title = data[0].name;
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }

        // Strategy 4: h1 tag
        if (!title || title.length < 5) {
            const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
            if (h1Match) {
                title = h1Match[1].replace(/<[^>]+>/g, '').trim();
            }
        }

        // Extract image from og:image
        let imageUrl: string | undefined;
        const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        if (ogImageMatch) {
            imageUrl = ogImageMatch[1];
        }

        // Extract price if available
        let price: string | undefined;
        const pricePatterns = [
            /<meta[^>]*property="product:price:amount"[^>]*content="([^"]+)"/i,
            /<span[^>]*class="[^"]*price[^"]*"[^>]*>\$?([0-9,.]+)<\/span>/i,
            /\$([0-9]+\.[0-9]{2})/,
        ];

        for (const pattern of pricePatterns) {
            const match = html.match(pattern);
            if (match) {
                price = match[1];
                break;
            }
        }

        // Detect retailer from URL
        let brand: string | undefined;
        const brandMatch = finalUrl.match(/(?:https?:\/\/)?(?:www\.)?([^.\/]+)\./);
        if (brandMatch) {
            brand = brandMatch[1].charAt(0).toUpperCase() + brandMatch[1].slice(1);
        }

        if (!title || title.length < 5) {
            console.log(`LTK: No valid title found for ${url}`);
            return null;
        }

        return {
            title,
            url: finalUrl, // Use the final destination URL
            imageUrl,
            price,
            brand,
        };

    } catch (error: any) {
        console.log(`LTK: Error following redirect for ${url}:`, error.message);
        return null;
    }
}

/**
 * Scrape Amazon Storefront or Influencer Page
 */
async function scrapeAmazonStorefront(url: string, maxProducts: number): Promise<StorefrontScrapeResult> {
    await rateLimiter.waitForSlot();

    // Handle urlgeni.us redirects
    let targetUrl = url;
    if (url.includes('urlgeni.us')) {
        try {
            const redirectResponse = await fetch(url, {
                redirect: 'manual',
                headers: generateBrowserHeaders(),
            });
            const location = redirectResponse.headers.get('location');
            if (location) targetUrl = location;
        } catch (e) {
            // Use original URL
        }
    }

    try {
        const response = await fetch(targetUrl, {
            headers: generateBrowserHeaders(),
        });

        if (!response.ok) {
            return { success: false, platform: 'amazon', storefrontUrl: url, products: [], error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const products: StorefrontProduct[] = [];

        // Extract products from Amazon page
        // Look for product grid items
        const productPatterns = [
            // Storefront product cards
            /<div[^>]*class="[^"]*(?:product|item)[^"]*"[^>]*>.*?<a[^>]*href="([^"]*\/dp\/[A-Z0-9]{10}[^"]*)"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/gis,
            // List items with ASIN
            /<a[^>]*href="([^"]*\/dp\/([A-Z0-9]{10})[^"]*)"[^>]*>(?:.*?<img[^>]*src="([^"]+)"[^>]*>)?.*?<span[^>]*class="[^"]*(?:title|name)[^"]*"[^>]*>([^<]+)<\/span>/gis,
            // Simple product links
            /<a[^>]*href="(https?:\/\/[^"]*amazon[^"]*\/dp\/[A-Z0-9]{10}[^"]*)"[^>]*title="([^"]+)"/gi,
        ];

        for (const pattern of productPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && products.length < maxProducts) {
                const title = (match[4] || match[3] || match[2] || 'Amazon Product').replace(/<[^>]+>/g, '').trim();
                if (title.length < 3) continue;

                products.push({
                    title,
                    url: match[1].startsWith('http') ? match[1] : `https://www.amazon.com${match[1]}`,
                    imageUrl: match[3]?.startsWith('http') ? match[3] : undefined,
                });
            }
            if (products.length >= maxProducts) break;
        }

        // Fallback: extract any ASIN links
        if (products.length === 0) {
            const asinPattern = /href="([^"]*\/dp\/([A-Z0-9]{10})[^"]*)"/gi;
            const seenAsins = new Set<string>();
            let match;

            while ((match = asinPattern.exec(html)) !== null && products.length < maxProducts) {
                const asin = match[2];
                if (seenAsins.has(asin)) continue;
                seenAsins.add(asin);

                products.push({
                    title: `Amazon Product ${asin}`,
                    url: `https://www.amazon.com/dp/${asin}`,
                });
            }
        }

        return { success: true, platform: 'amazon', storefrontUrl: url, products };

    } catch (error: any) {
        return { success: false, platform: 'amazon', storefrontUrl: url, products: [], error: error.message };
    }
}

/**
 * Scrape ShopMy Storefront
 */
async function scrapeShopMyStorefront(url: string, maxProducts: number): Promise<StorefrontScrapeResult> {
    await rateLimiter.waitForSlot();

    try {
        const response = await fetch(url, {
            headers: generateBrowserHeaders(),
        });

        if (!response.ok) {
            return { success: false, platform: 'shopmy', storefrontUrl: url, products: [], error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const products: StorefrontProduct[] = [];

        // ShopMy uses similar patterns to other storefronts
        const productPatterns = [
            /<a[^>]*href="([^"]+)"[^>]*>.*?<img[^>]*src="([^"]+)"[^>]*alt="([^"]+)"/gis,
            /data-product-url="([^"]+)"[^>]*data-product-name="([^"]+)"[^>]*data-product-image="([^"]+)"/gi,
        ];

        for (const pattern of productPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null && products.length < maxProducts) {
                products.push({
                    title: (match[3] || match[2] || 'ShopMy Product').replace(/<[^>]+>/g, '').trim(),
                    url: match[1],
                    imageUrl: match[2]?.startsWith('http') ? match[2] : undefined,
                });
            }
            if (products.length >= maxProducts) break;
        }

        // Fallback to generic
        if (products.length === 0) {
            return scrapeGenericStorefront(url, maxProducts);
        }

        return { success: true, platform: 'shopmy', storefrontUrl: url, products };

    } catch (error: any) {
        return { success: false, platform: 'shopmy', storefrontUrl: url, products: [], error: error.message };
    }
}

/**
 * Scrape ShopStyle/rstyle.me Storefront
 */
async function scrapeShopStyleStorefront(url: string, maxProducts: number): Promise<StorefrontScrapeResult> {
    await rateLimiter.waitForSlot();

    try {
        const response = await fetch(url, {
            headers: generateBrowserHeaders(),
        });

        if (!response.ok) {
            return { success: false, platform: 'shopstyle', storefrontUrl: url, products: [], error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const products: StorefrontProduct[] = [];

        // ShopStyle product patterns
        const productPattern = /<a[^>]*href="([^"]*rstyle[^"]*|[^"]*shopstyle[^"]*)"[^>]*>(?:.*?<img[^>]*src="([^"]+)"[^>]*>)?.*?<span[^>]*>([^<]+)<\/span>/gis;
        let match;

        while ((match = productPattern.exec(html)) !== null && products.length < maxProducts) {
            products.push({
                title: match[3]?.replace(/<[^>]+>/g, '').trim() || 'ShopStyle Product',
                url: match[1],
                imageUrl: match[2],
            });
        }

        return { success: true, platform: 'shopstyle', storefrontUrl: url, products };

    } catch (error: any) {
        return { success: false, platform: 'shopstyle', storefrontUrl: url, products: [], error: error.message };
    }
}

/**
 * Generic storefront scraper for unknown platforms
 */
async function scrapeGenericStorefront(url: string, maxProducts: number): Promise<StorefrontScrapeResult> {
    await rateLimiter.waitForSlot();

    try {
        const response = await fetch(url, {
            headers: generateBrowserHeaders(),
        });

        if (!response.ok) {
            return { success: false, platform: 'generic', storefrontUrl: url, products: [], error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const products: StorefrontProduct[] = [];

        // Look for product-like links with images
        const productPattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>(?:.*?<img[^>]*src="([^"]+)"[^>]*>)?.*?(?:<h[23456][^>]*>([^<]+)<\/h|<span[^>]*class="[^"]*(?:title|name|product)[^"]*"[^>]*>([^<]+)<\/span>)/gis;
        let match;

        while ((match = productPattern.exec(html)) !== null && products.length < maxProducts) {
            const title = (match[4] || match[3] || '').replace(/<[^>]+>/g, '').trim();
            if (title.length < 3) continue;

            products.push({
                title,
                url: match[1],
                imageUrl: match[2],
            });
        }

        return { success: true, platform: 'generic', storefrontUrl: url, products };

    } catch (error: any) {
        return { success: false, platform: 'generic', storefrontUrl: url, products: [], error: error.message };
    }
}

/**
 * Scrape multiple storefronts in parallel with rate limiting
 */
export async function scrapeMultipleStorefronts(
    storefrontUrls: string[],
    productsPerStorefront: number = 5
): Promise<Map<string, StorefrontScrapeResult>> {
    const results = new Map<string, StorefrontScrapeResult>();

    // Process sequentially to respect rate limits
    for (const url of storefrontUrls) {
        await addRandomDelay(500, 1500);
        const result = await scrapeStorefront(url, productsPerStorefront);
        results.set(url, result);
    }

    return results;
}
