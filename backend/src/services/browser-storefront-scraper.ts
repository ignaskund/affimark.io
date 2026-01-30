/**
 * Browser-Based Storefront Scraper
 * Uses Cloudflare's Browser Rendering API (Puppeteer) for JS-rendered pages
 * 
 * This scraper can extract products from:
 * - LTK storefronts (shopltk.com)
 * - Amazon storefronts
 * - Other JS-rendered affiliate storefronts
 */

import puppeteer, { Browser } from '@cloudflare/puppeteer';

export interface BrowserProduct {
    title: string;
    url: string;
    imageUrl?: string;
    price?: string;
    brand?: string;
}

export interface BrowserScrapeResult {
    success: boolean;
    platform: string;
    storefrontUrl: string;
    products: BrowserProduct[];
    error?: string;
}

export interface BrowserDebugResult {
    url: string;
    title: string;
    elementCounts: Record<string, number>;
    sampleClasses: string[];
    sampleLinks: string[];
}

/**
 * Debug function to capture what the browser actually sees
 */
export async function debugScrape(
    browserBinding: any,
    url: string
): Promise<BrowserDebugResult> {
    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch(browserBinding);
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 5000));

        // Scroll to trigger lazy loading
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.scrollBy(0, 400));
            await new Promise(r => setTimeout(r, 500));
        }

        const debug = await page.evaluate(() => {
            const counts: Record<string, number> = {
                'a': document.querySelectorAll('a').length,
                'img': document.querySelectorAll('img').length,
                'article': document.querySelectorAll('article').length,
                '[class*="product"]': document.querySelectorAll('[class*="product"]').length,
                '[class*="Product"]': document.querySelectorAll('[class*="Product"]').length,
                '[class*="card"]': document.querySelectorAll('[class*="card"]').length,
                '[class*="Card"]': document.querySelectorAll('[class*="Card"]').length,
                '[class*="post"]': document.querySelectorAll('[class*="post"]').length,
                '[class*="Post"]': document.querySelectorAll('[class*="Post"]').length,
                '[class*="item"]': document.querySelectorAll('[class*="item"]').length,
                '[data-asin]': document.querySelectorAll('[data-asin]').length,
            };

            // Get sample class names from divs
            const allDivs = Array.from(document.querySelectorAll('div[class]')).slice(0, 50);
            const classNames = new Set<string>();
            for (const div of allDivs) {
                const classes = div.className.split(' ').filter(c => c.length > 5);
                classes.forEach(c => classNames.add(c));
            }

            // Get sample links
            const links = Array.from(document.querySelectorAll('a[href]'))
                .slice(0, 10)
                .map(a => (a as HTMLAnchorElement).href);

            return {
                title: document.title,
                counts,
                classes: Array.from(classNames).slice(0, 20),
                links,
            };
        });

        await browser.close();

        return {
            url,
            title: debug.title,
            elementCounts: debug.counts,
            sampleClasses: debug.classes,
            sampleLinks: debug.links,
        };

    } catch (error: any) {
        if (browser) await browser.close();
        return {
            url,
            title: 'ERROR: ' + error.message,
            elementCounts: {},
            sampleClasses: [],
            sampleLinks: [],
        };
    }
}

/**
 * Scrape a storefront using browser rendering
 */
export async function scrapeWithBrowser(
    browserBinding: any,
    url: string,
    maxProducts: number = 5
): Promise<BrowserScrapeResult> {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('shopltk.com') || lowerUrl.includes('liketk.it')) {
        return scrapeLTKWithBrowser(browserBinding, url, maxProducts);
    }

    if (lowerUrl.includes('amazon.com') || lowerUrl.includes('urlgeni.us/amazon')) {
        return scrapeAmazonWithBrowser(browserBinding, url, maxProducts);
    }

    // Default: try generic browser scraping
    return scrapeGenericWithBrowser(browserBinding, url, maxProducts);
}

/**
 * Scrape LTK storefront with browser
 */
async function scrapeLTKWithBrowser(
    browserBinding: any,
    url: string,
    maxProducts: number
): Promise<BrowserScrapeResult> {
    let browser: Browser | null = null;

    try {
        console.log('LTK: Starting browser scrape for', url);
        browser = await puppeteer.launch(browserBinding);
        const page = await browser.newPage();

        // Set desktop viewport
        await page.setViewport({ width: 1440, height: 900 });

        // Navigate to LTK page with longer timeout
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page to fully render - LTK uses Nuxt.js which needs time
        await new Promise(r => setTimeout(r, 5000));

        // Scroll down multiple times to trigger lazy loading
        for (let i = 0; i < 5; i++) {
            await page.evaluate(() => window.scrollBy(0, 400));
            await new Promise(r => setTimeout(r, 800));
        }

        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 1000));

        // Extract products using multiple strategies
        const products = await page.evaluate((maxProds: number) => {
            const results: Array<{
                title: string;
                url: string;
                imageUrl?: string;
                price?: string;
                brand?: string;
            }> = [];

            // Strategy 1: Look for common product grid patterns
            const selectors = [
                // LTK specific selectors
                '[class*="PostCard"]',
                '[class*="product"]',
                '[class*="Product"]',
                '[class*="shoppable"]',
                '[class*="shop-item"]',
                '[class*="ltk-card"]',
                // Grid items
                '[class*="grid"] > div > a',
                '[class*="grid"] article',
                // Common patterns
                'article a[href*="liketk.it"]',
                'a[href*="liketk.it"]',
                'a[href*="shopltk.com"]',
            ];

            const seenUrls = new Set<string>();

            for (const selector of selectors) {
                if (results.length >= maxProds) break;

                const elements = document.querySelectorAll(selector);

                for (const el of Array.from(elements)) {
                    if (results.length >= maxProds) break;

                    // Get the link - might be the element itself or a child
                    let link = el as HTMLAnchorElement;
                    if (!link.href) {
                        const childLink = el.querySelector('a[href]') as HTMLAnchorElement;
                        if (childLink) link = childLink;
                    }
                    if (!link?.href) continue;

                    const href = link.href.toLowerCase();

                    // Skip social media links
                    if (href.includes('twitter.com') || href.includes('x.com')) continue;
                    if (href.includes('facebook.com') || href.includes('fb.com')) continue;
                    if (href.includes('pinterest.com') || href.includes('pin.it')) continue;
                    if (href.includes('instagram.com')) continue;
                    if (href.includes('tiktok.com')) continue;
                    if (href.includes('youtube.com') || href.includes('youtu.be')) continue;
                    if (href.includes('snapchat.com')) continue;
                    if (href.includes('threads.net')) continue;

                    // Skip LTK internal navigation links
                    if (href.includes('login') || href.includes('signup') || href.includes('signin')) continue;
                    if (href.includes('categories') || href.includes('/explore')) continue;
                    if (href.includes('follow') || href.includes('share')) continue;
                    if (href.includes('/home') || href === 'https://www.shopltk.com/') continue;

                    // Skip if already seen
                    if (seenUrls.has(link.href)) continue;
                    seenUrls.add(link.href);

                    // Get image from element or parent (optional)
                    let img = el.querySelector('img') as HTMLImageElement;
                    if (!img && el.parentElement) {
                        img = el.parentElement.querySelector('img') as HTMLImageElement;
                    }
                    const imageUrl = img?.src || img?.getAttribute('data-src') || '';

                    // Note: Don't skip if no image - extract product data anyway

                    // Try to get title from various sources
                    const container = el.closest('article, [class*="card"], [class*="Card"], div');
                    const titleSources = [
                        el.querySelector('[class*="title"]'),
                        el.querySelector('[class*="name"]'),
                        el.querySelector('h1, h2, h3, h4, h5'),
                        el.querySelector('p'),
                        container?.querySelector('[class*="title"]'),
                        container?.querySelector('[class*="name"]'),
                    ];

                    let title = '';
                    for (const src of titleSources) {
                        if (src?.textContent?.trim()) {
                            title = src.textContent.trim();
                            break;
                        }
                    }

                    // Use alt text as fallback
                    if (!title && img?.alt) {
                        title = img.alt;
                    }

                    // Generate title from URL if still empty
                    if (!title) {
                        title = `Look ${results.length + 1}`;
                    }

                    // Get price if available
                    const priceEl = container?.querySelector('[class*="price"]');
                    const price = priceEl?.textContent?.trim() || '';

                    // Get brand if available
                    const brandEl = container?.querySelector('[class*="brand"], [class*="retailer"]');
                    const brand = brandEl?.textContent?.trim() || '';

                    // Skip items with generic/navigation titles
                    const titleLower = title.toLowerCase();
                    if (titleLower.includes('follow us') || titleLower === 'follow') continue;
                    if (titleLower.includes('learn more') || titleLower === 'learn') continue;
                    if (titleLower.includes('sign up') || titleLower.includes('sign in')) continue;
                    if (/^look\s*\d*$/i.test(title)) continue; // Skip "Look 1", "Look 2", etc.
                    if (title.length < 3) continue;

                    results.push({
                        title: title.substring(0, 150),
                        url: link.href,
                        imageUrl: imageUrl || undefined,
                        price: price || undefined,
                        brand: brand || undefined,
                    });
                }
            }

            // Strategy 2: If we still don't have products, find shoppable images with links
            if (results.length < maxProds) {
                // Look for images within clickable areas - these are likely products
                const productImages = document.querySelectorAll('a[href] img, [class*="shoppable"] img, [class*="item"] img');

                for (const img of Array.from(productImages)) {
                    if (results.length >= maxProds) break;

                    const imgEl = img as HTMLImageElement;
                    const parent = imgEl.closest('a') as HTMLAnchorElement;
                    if (!parent?.href) continue;

                    const href = parent.href.toLowerCase();

                    // Skip social media links
                    if (href.includes('twitter.com') || href.includes('x.com')) continue;
                    if (href.includes('facebook.com') || href.includes('fb.com')) continue;
                    if (href.includes('pinterest.com') || href.includes('pin.it')) continue;
                    if (href.includes('instagram.com')) continue;
                    if (href.includes('tiktok.com')) continue;
                    if (href.includes('youtube.com') || href.includes('youtu.be')) continue;
                    if (href.includes('snapchat.com')) continue;
                    if (href.includes('threads.net')) continue;

                    // Skip LTK internal navigation links
                    if (href.includes('login') || href.includes('signup') || href.includes('signin')) continue;
                    if (href.includes('categories') || href.includes('/explore')) continue;
                    if (href.includes('follow') || href.includes('share')) continue;
                    if (href.includes('/home') || href === 'https://www.shopltk.com/') continue;
                    if (parent.href === window.location.href) continue;

                    // Skip if it's just an LTK profile link (not a product)
                    if (href.match(/shopltk\.com\/explore\/[^/]+\/?$/) && !href.includes('#')) continue;

                    if (seenUrls.has(parent.href)) continue;
                    seenUrls.add(parent.href);

                    // Get title from alt text, or create descriptive title from context
                    let title = imgEl.alt?.trim() || '';

                    // If no alt, try to find text near the image
                    if (!title) {
                        const container = imgEl.closest('[class*="card"], [class*="item"], div');
                        const textEl = container?.querySelector('span, p, [class*="title"]');
                        title = textEl?.textContent?.trim() || '';
                    }

                    // If still no title, create one from the URL or index
                    if (!title) {
                        // Try to extract retailer from URL
                        const urlMatch = parent.href.match(/(?:amazon|nordstrom|target|walmart|shopbop|revolve|sephora|ulta)\./i);
                        if (urlMatch) {
                            title = `${urlMatch[0].replace('.', '')} Product ${results.length + 1}`;
                        } else {
                            title = `Shop Look ${results.length + 1}`;
                        }
                    }

                    // Use the image src - LTK images are usually hosted on their CDN
                    const imageUrl = imgEl.src || '';
                    if (!imageUrl || imageUrl.includes('avatar') || imageUrl.includes('icon')) continue;

                    // Skip items with generic/navigation titles
                    const titleLower = title.toLowerCase();
                    if (titleLower.includes('follow us') || titleLower === 'follow') continue;
                    if (titleLower.includes('learn more') || titleLower === 'learn') continue;
                    if (titleLower.includes('sign up') || titleLower.includes('sign in')) continue;
                    if (/^(shop\s)?look\s*\d*$/i.test(title)) continue; // Skip "Look 1", "Shop Look 1", etc.
                    if (title.length < 3) continue;

                    results.push({
                        title: title.substring(0, 150),
                        url: parent.href,
                        imageUrl: imageUrl,
                    });
                }
            }

            console.log('LTK: Found', results.length, 'products');
            return results;
        }, maxProducts);

        await browser.close();
        console.log('LTK: Scraped', products.length, 'products from', url);

        return {
            success: products.length > 0,
            platform: 'ltk',
            storefrontUrl: url,
            products,
        };

    } catch (error: any) {
        if (browser) await browser.close();
        console.error('LTK browser scrape error:', error);
        return {
            success: false,
            platform: 'ltk',
            storefrontUrl: url,
            products: [],
            error: error.message,
        };
    }
}

/**
 * Scrape Amazon storefront with browser
 */
async function scrapeAmazonWithBrowser(
    browserBinding: any,
    url: string,
    maxProducts: number
): Promise<BrowserScrapeResult> {
    let browser: Browser | null = null;

    // Handle urlgeni.us redirects
    let targetUrl = url;
    if (url.includes('urlgeni.us')) {
        try {
            const response = await fetch(url, { redirect: 'manual' });
            const location = response.headers.get('location');
            if (location) targetUrl = location;
            console.log('Amazon: Resolved urlgeni.us to', location);
        } catch {
            // Use original URL
        }
    }

    try {
        console.log('Amazon: Starting browser scrape for', targetUrl);
        browser = await puppeteer.launch(browserBinding);
        const page = await browser.newPage();

        await page.setViewport({ width: 1440, height: 900 });

        // Navigate to Amazon page with longer timeout
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for page to load
        await new Promise(r => setTimeout(r, 4000));

        // Scroll to load lazy content
        for (let i = 0; i < 4; i++) {
            await page.evaluate(() => window.scrollBy(0, 500));
            await new Promise(r => setTimeout(r, 600));
        }

        // Scroll back to top
        await page.evaluate(() => window.scrollTo(0, 0));
        await new Promise(r => setTimeout(r, 500));

        // Extract products
        const products = await page.evaluate((maxProds: number) => {
            // Try multiple selectors for different Amazon page layouts
            const productSelectors = [
                '[data-asin]:not([data-asin=""])',
                '[class*="product-card"]',
                '[class*="ProductCard"]',
                '.s-result-item',
                '.a-carousel-card',
                '.shop-item',
                '[class*="item-cell"]',
            ];

            let productElements: Element[] = [];
            for (const selector of productSelectors) {
                productElements = Array.from(document.querySelectorAll(selector));
                if (productElements.length > 0) break;
            }

            console.log('Amazon: Found', productElements.length, 'product elements');

            const results: Array<{
                title: string;
                url: string;
                imageUrl?: string;
                price?: string;
                brand?: string;
            }> = [];

            const seenUrls = new Set<string>();

            for (const el of productElements) {
                if (results.length >= maxProds) break;

                // Get ASIN for deduplication
                const asin = el.getAttribute('data-asin') || '';

                // Find ANY link in the element (not just /dp/ links)
                const linkEl = el.querySelector('a[href*="amazon.com"], a[href*="/dp/"], a[href*="/gp/"], a[href]') as HTMLAnchorElement;
                if (!linkEl?.href) continue;

                // Skip if we've seen this URL
                if (seenUrls.has(linkEl.href)) continue;
                seenUrls.add(linkEl.href);

                // Skip navigation/internal links
                if (linkEl.href.includes('#') && !linkEl.href.includes('/dp/')) continue;
                if (linkEl.href.includes('javascript:')) continue;

                // Find title - try multiple selectors
                const titleSelectors = [
                    '[class*="product-title"]',
                    '[class*="ProductTitle"]',
                    '.a-text-normal',
                    'h2 span',
                    'h3 span',
                    '[class*="title"] span',
                    'span.a-size-base',
                    'span.a-size-medium',
                    'img[alt]',
                ];
                let title = '';
                for (const sel of titleSelectors) {
                    const titleEl = el.querySelector(sel);
                    if (sel === 'img[alt]') {
                        // Use image alt as fallback
                        title = (titleEl as HTMLImageElement)?.alt || '';
                    } else {
                        title = titleEl?.textContent?.trim() || '';
                    }
                    if (title && title.length > 5) break;
                }

                // Clean up title - remove prices and delivery info
                if (title) {
                    title = title.split(/\$|€|£|\bdelivery\b|\bfree\s+shipping\b/i)[0].trim();
                }

                // Find image
                const imgEl = el.querySelector('img[src*="images-amazon"], img[src*="media-amazon"], img.s-image, img') as HTMLImageElement;
                const imageUrl = imgEl?.src || '';

                // Find price
                const priceEl = el.querySelector('.a-price .a-offscreen, [class*="price"] span, .a-price-whole');
                const price = priceEl?.textContent?.trim() || '';

                if (title && title.length > 3 && title.length < 200) {
                    results.push({
                        title,
                        url: linkEl.href,
                        imageUrl: imageUrl || undefined,
                        price: price || undefined,
                    });
                }
            }

            console.log('Amazon: Extracted', results.length, 'products');

            return results;
        }, maxProducts);

        await browser.close();
        console.log('Amazon: Scraped', products.length, 'products from', url);

        return {
            success: products.length > 0,
            platform: 'amazon',
            storefrontUrl: url,
            products,
        };

    } catch (error: any) {
        if (browser) await browser.close();
        console.error('Amazon browser scrape error:', error);
        return {
            success: false,
            platform: 'amazon',
            storefrontUrl: url,
            products: [],
            error: error.message,
        };
    }
}

/**
 * Generic browser scraping for unknown platforms
 */
async function scrapeGenericWithBrowser(
    browserBinding: any,
    url: string,
    maxProducts: number
): Promise<BrowserScrapeResult> {
    let browser: Browser | null = null;

    try {
        browser = await puppeteer.launch(browserBinding);
        const page = await browser.newPage();

        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait a bit for dynamic content
        await new Promise(r => setTimeout(r, 2000));

        // Extract product-like content
        const products = await page.evaluate((maxProds: number) => {
            const results: Array<{
                title: string;
                url: string;
                imageUrl?: string;
                price?: string;
            }> = [];

            // Look for product cards, items, or links with images
            const elements = document.querySelectorAll(
                '.product-card, .product-item, .product, [class*="product"], article, .card'
            );

            for (const el of Array.from(elements).slice(0, maxProds)) {
                const linkEl = el.querySelector('a[href]') as HTMLAnchorElement;
                if (!linkEl) continue;

                const titleEl = el.querySelector('h1, h2, h3, h4, [class*="title"], [class*="name"]');
                const title = titleEl?.textContent?.trim() || '';

                const imgEl = el.querySelector('img') as HTMLImageElement;
                const imageUrl = imgEl?.src || '';

                const priceEl = el.querySelector('[class*="price"]');
                const price = priceEl?.textContent?.trim() || '';

                if (title.length > 5) {
                    results.push({
                        title,
                        url: linkEl.href,
                        imageUrl: imageUrl || undefined,
                        price: price || undefined,
                    });
                }
            }

            return results;
        }, maxProducts);

        await browser.close();

        return {
            success: true,
            platform: 'generic',
            storefrontUrl: url,
            products,
        };

    } catch (error: any) {
        if (browser) await browser.close();
        console.error('Generic browser scrape error:', error);
        return {
            success: false,
            platform: 'generic',
            storefrontUrl: url,
            products: [],
            error: error.message,
        };
    }
}
