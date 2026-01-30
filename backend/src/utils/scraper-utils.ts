/**
 * Scraper Utilities
 * 
 * Anti-detection utilities for web scraping.
 * Includes user-agent rotation, random delays, and header generation.
 */

/**
 * Common browser user agents for rotation
 */
const USER_AGENTS = [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Firefox on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
];

/**
 * Accept-Language headers for rotation
 */
const ACCEPT_LANGUAGES = [
    'en-US,en;q=0.9',
    'en-GB,en;q=0.9,en-US;q=0.8',
    'en-US,en;q=0.9,es;q=0.8',
    'en,en-US;q=0.9',
];

/**
 * Get a random user agent string
 */
export function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get a random accept-language header
 */
export function getRandomAcceptLanguage(): string {
    return ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)];
}

/**
 * Add a random delay to avoid detection patterns
 */
export async function addRandomDelay(minMs: number = 500, maxMs: number = 2000): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Generate randomized headers that look like a real browser
 */
export function generateBrowserHeaders(referer?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': getRandomAcceptLanguage(),
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
    };

    if (referer) {
        headers['Referer'] = referer;
        headers['Sec-Fetch-Site'] = 'same-origin';
    }

    return headers;
}

/**
 * Extract ASIN from various Amazon URL formats
 */
export function extractAsinFromUrl(url: string): string | null {
    // Handle various Amazon URL formats:
    // https://www.amazon.com/dp/B08N5WRWNW
    // https://www.amazon.com/product-name/dp/B08N5WRWNW
    // https://www.amazon.com/gp/product/B08N5WRWNW
    // https://www.amazon.com/gp/aw/d/B08N5WRWNW (mobile)
    // https://amzn.to/3xYz123 (short links need to be resolved first)

    const patterns = [
        /\/dp\/([A-Z0-9]{10})/i,
        /\/gp\/product\/([A-Z0-9]{10})/i,
        /\/gp\/aw\/d\/([A-Z0-9]{10})/i,
        /\/product\/([A-Z0-9]{10})/i,
        /asin=([A-Z0-9]{10})/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1].toUpperCase();
        }
    }

    return null;
}

/**
 * Build Amazon product URL from ASIN
 */
export function buildAmazonUrl(asin: string, domain: string = 'amazon.com'): string {
    return `https://www.${domain}/dp/${asin}`;
}

/**
 * Check if the response indicates a CAPTCHA or bot detection
 */
export function detectBotBlock(html: string): boolean {
    const blockIndicators = [
        'Enter the characters you see below',
        'To discuss automated access to Amazon data',
        'api-services-support@amazon.com',
        'Type the characters you see in this image',
        'Sorry, we just need to make sure you\'re not a robot',
        'captcha',
    ];

    const lowerHtml = html.toLowerCase();
    return blockIndicators.some(indicator => lowerHtml.includes(indicator.toLowerCase()));
}

/**
 * Parse price from Amazon price string
 * Handles formats like "$29.99", "£19.99", "€24,99"
 */
export function parsePrice(priceString: string): { value: number; currency: string } | null {
    if (!priceString) return null;

    // Match currency symbol and price value
    const match = priceString.match(/([£$€¥])?\s*([\d,]+\.?\d*)/);
    if (!match) return null;

    const currencySymbol = match[1] || '$';
    const priceValue = match[2].replace(',', '');

    const currencyMap: Record<string, string> = {
        '$': 'USD',
        '£': 'GBP',
        '€': 'EUR',
        '¥': 'JPY',
    };

    return {
        value: parseFloat(priceValue),
        currency: currencyMap[currencySymbol] || 'USD',
    };
}

/**
 * Clean and normalize text extracted from HTML
 */
export function cleanText(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/\s+/g, ' ')
        .replace(/[\n\r\t]/g, ' ')
        .trim();
}

/**
 * Rate limiter for requests
 */
export class RateLimiter {
    private lastRequestTime: number = 0;
    private minDelayMs: number;

    constructor(requestsPerSecond: number = 1) {
        this.minDelayMs = 1000 / requestsPerSecond;
    }

    async waitForSlot(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minDelayMs) {
            const waitTime = this.minDelayMs - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        this.lastRequestTime = Date.now();
    }
}
