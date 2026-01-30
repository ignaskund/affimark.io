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
    detectedNetwork?: string;
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
            // Fetch the page
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch page: ${response.status}`);
            }

            const html = await response.text();

            // Detect platform
            const platform = this.detectPlatform(html, url);

            // Scrape links based on platform
            let links: ScrapedLink[] = [];

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

            // Calculate affiliate stats
            const affiliateCount = links.filter(l => l.isAffiliate).length;

            // Generate suggestions
            const suggestions = this.generateSuggestions(links, platform);

            return {
                platform,
                totalLinks: links.length,
                affiliateLinks: affiliateCount,
                links,
                suggestions,
            };

        } catch (error: any) {
            console.error('Migration scraper error:', error);
            throw new Error(`Migration scraper error: ${error.message}`);
        }
    }

    /**
     * Detect link-in-bio platform from HTML and URL
     */
    private detectPlatform(html: string, url: string): string {
        const lowerUrl = url.toLowerCase();
        const lowerHtml = html.toLowerCase();

        if (lowerUrl.includes('linktr.ee') || lowerHtml.includes('linktree')) {
            return 'linktree';
        }
        if (lowerUrl.includes('beacons.ai') || lowerHtml.includes('beacons')) {
            return 'beacons';
        }
        if (lowerUrl.includes('stan.store') || lowerHtml.includes('stan store')) {
            return 'stan';
        }
        if (lowerUrl.includes('carrd.co')) {
            return 'carrd';
        }
        if (lowerUrl.includes('bio.link')) {
            return 'biolink';
        }
        if (lowerUrl.includes('tap.bio')) {
            return 'tapbio';
        }

        return 'custom';
    }

    /**
     * Scrape Linktree page
     * Linktree uses Next.js and stores link data in __NEXT_DATA__ JSON
     */
    private scrapeLinktree(html: string): ScrapedLink[] {
        const links: ScrapedLink[] = [];
        let position = 0;

        // Method 1: Extract from __NEXT_DATA__ JSON (most reliable)
        const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
        if (nextDataMatch) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                // Linktree stores links in different paths depending on page version
                const account = nextData?.props?.pageProps?.account;

                // Get BOTH regular links AND social links
                const regularLinks = account?.links || [];
                const socialLinks = account?.socialLinks || [];
                const allLinks = [...regularLinks, ...socialLinks];

                for (const link of allLinks) {
                    if (!link.url) continue;
                    // Skip internal Linktree links
                    if (link.url.includes('linktr.ee') && !link.url.includes('?')) continue;

                    links.push({
                        title: link.title || link.name || this.getSocialNameFromUrl(link.url) || 'Untitled Link',
                        url: this.resolveUrl(link.url),
                        position: position++,
                        isAffiliate: this.isAffiliateLink(link.url),
                        detectedNetwork: this.detectNetwork(link.url),
                        affiliateTag: this.extractAffiliateTag(link.url),
                    });
                }

                if (links.length > 0) {
                    return links;
                }
            } catch (e) {
                console.log('Failed to parse __NEXT_DATA__, falling back to HTML parsing');
            }
        }

        // Method 2: Look for links in data attributes (newer Linktree)
        const dataLinkPattern = /data-testid="LinkButton"[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi;
        let match;
        while ((match = dataLinkPattern.exec(html)) !== null) {
            const url = match[1];
            const title = match[2]?.replace(/<[^>]+>/g, '').trim() || 'Untitled Link';

            if (url.includes('linktr.ee') && !url.includes('?')) continue;

            links.push({
                title,
                url: this.resolveUrl(url),
                position: position++,
                isAffiliate: this.isAffiliateLink(url),
                detectedNetwork: this.detectNetwork(url),
                affiliateTag: this.extractAffiliateTag(url),
            });
        }

        if (links.length > 0) {
            return links;
        }

        // Method 3: Look for button-style links (common in Linktree)
        const buttonPattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>[^<]*<p[^>]*>([^<]+)<\/p>/gi;
        while ((match = buttonPattern.exec(html)) !== null) {
            const url = match[1];
            const title = match[2]?.trim() || 'Untitled Link';

            // Skip internal Linktree links and common footer links
            if (url.includes('linktr.ee')) continue;
            if (url.includes('instagram.com') && title.toLowerCase().includes('commission')) continue;

            links.push({
                title,
                url: this.resolveUrl(url),
                position: position++,
                isAffiliate: this.isAffiliateLink(url),
                detectedNetwork: this.detectNetwork(url),
                affiliateTag: this.extractAffiliateTag(url),
            });
        }

        // Method 4: Final fallback - look for any external links in main content
        if (links.length === 0) {
            const allLinksPattern = /<a[^>]*href="(https?:\/\/(?!linktr\.ee)[^"]+)"[^>]*>([^<]*)/gi;
            while ((match = allLinksPattern.exec(html)) !== null) {
                const url = match[1];
                const title = match[2]?.trim() || 'External Link';

                // Skip common non-content URLs
                if (this.isSkippableLink(url)) continue;

                links.push({
                    title,
                    url: this.resolveUrl(url),
                    position: position++,
                    isAffiliate: this.isAffiliateLink(url),
                    detectedNetwork: this.detectNetwork(url),
                    affiliateTag: this.extractAffiliateTag(url),
                });
            }
        }

        return links;
    }

    /**
     * Scrape Beacons page
     * Beacons also uses Next.js/React and stores data in page
     */
    private scrapeBeacons(html: string): ScrapedLink[] {
        const links: ScrapedLink[] = [];
        let position = 0;

        // Method 1: Look for __NEXT_DATA__ or embedded JSON
        const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i);
        if (nextDataMatch) {
            try {
                const nextData = JSON.parse(nextDataMatch[1]);
                const pageData = nextData?.props?.pageProps?.page || nextData?.props?.pageProps;
                const linkBlocks = pageData?.blocks || pageData?.links || [];

                for (const block of linkBlocks) {
                    const url = block.url || block.link || block.href;
                    if (!url) continue;
                    if (url.includes('beacons.ai') && !url.includes('?')) continue;

                    links.push({
                        title: block.title || block.text || block.label || 'Untitled Link',
                        url: this.resolveUrl(url),
                        position: position++,
                        isAffiliate: this.isAffiliateLink(url),
                        detectedNetwork: this.detectNetwork(url),
                        affiliateTag: this.extractAffiliateTag(url),
                    });
                }
                if (links.length > 0) return links;
            } catch (e) {
                console.log('Beacons: Failed to parse JSON, falling back to HTML');
            }
        }

        // Method 2: Look for link buttons with various class patterns
        const buttonPatterns = [
            /class="[^"]*link-button[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
            /href="([^"]+)"[^>]*class="[^"]*link-button[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
            /data-link-id="[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
        ];

        for (const pattern of buttonPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const url = match[1];
                const title = match[2]?.replace(/<[^>]+>/g, '').trim() || 'Untitled Link';

                if (url.includes('beacons.ai') && !url.includes('?')) continue;
                if (this.isSkippableLink(url)) continue;

                links.push({
                    title,
                    url: this.resolveUrl(url),
                    position: position++,
                    isAffiliate: this.isAffiliateLink(url),
                    detectedNetwork: this.detectNetwork(url),
                    affiliateTag: this.extractAffiliateTag(url),
                });
            }
            if (links.length > 0) return links;
        }

        // Method 3: Fallback to generic scraper
        return this.scrapeGeneric(html);
    }

    /**
     * Scrape Stan Store page
     * Stan stores product data in page state
     */
    private scrapeStan(html: string): ScrapedLink[] {
        const links: ScrapedLink[] = [];
        let position = 0;

        // Method 1: Look for embedded store data (Stan uses React)
        const storeDataPatterns = [
            /__NUXT__\s*=\s*({.+?});?\s*<\/script>/is,
            /window\.__INITIAL_STATE__\s*=\s*({.+?});?\s*<\/script>/is,
            /<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i,
        ];

        for (const pattern of storeDataPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    const data = JSON.parse(match[1]);
                    const products = data?.products || data?.store?.products ||
                        data?.props?.pageProps?.products || [];

                    for (const product of products) {
                        const url = product.url || product.link || product.href;
                        if (!url) continue;

                        links.push({
                            title: product.title || product.name || 'Untitled Product',
                            url: this.resolveUrl(url),
                            position: position++,
                            isAffiliate: this.isAffiliateLink(url),
                            detectedNetwork: this.detectNetwork(url),
                            affiliateTag: this.extractAffiliateTag(url),
                        });
                    }
                    if (links.length > 0) return links;
                } catch (e) {
                    console.log('Stan: Failed to parse JSON, trying HTML');
                }
            }
        }

        // Method 2: Look for product cards with various patterns
        const productPatterns = [
            /<a[^>]*href="([^"]+)"[^>]*>.*?<h3[^>]*>([^<]+)<\/h3>/gis,
            /<a[^>]*href="([^"]+)"[^>]*class="[^"]*product[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
            /class="[^"]*product-card[^"]*"[^>]*>.*?href="([^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gis,
        ];

        for (const pattern of productPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const url = match[1];
                const title = match[2]?.replace(/<[^>]+>/g, '').trim() || 'Untitled Product';

                if (this.isSkippableLink(url)) continue;

                links.push({
                    title,
                    url: this.resolveUrl(url),
                    position: position++,
                    isAffiliate: this.isAffiliateLink(url),
                    detectedNetwork: this.detectNetwork(url),
                    affiliateTag: this.extractAffiliateTag(url),
                });
            }
            if (links.length > 0) return links;
        }

        // Method 3: Fallback to generic
        return this.scrapeGeneric(html);
    }

    /**
     * Scrape Carrd page
     * Carrd uses a custom builder format
     */
    private scrapeCarrd(html: string): ScrapedLink[] {
        const links: ScrapedLink[] = [];
        let position = 0;

        // Method 1: Look for Carrd's button links (they use specific classes)
        const carrdPatterns = [
            /<a[^>]*href="([^"]+)"[^>]*class="[^"]*button[^"]*"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
            /<a[^>]*class="[^"]*button[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)/gi,
        ];

        for (const pattern of carrdPatterns) {
            let match;
            while ((match = pattern.exec(html)) !== null) {
                const url = match[1];
                const title = match[2]?.replace(/<[^>]+>/g, '').trim() || 'Untitled Link';

                if (url.includes('carrd.co') && !url.includes('?')) continue;
                if (this.isSkippableLink(url)) continue;

                links.push({
                    title,
                    url: this.resolveUrl(url),
                    position: position++,
                    isAffiliate: this.isAffiliateLink(url),
                    detectedNetwork: this.detectNetwork(url),
                    affiliateTag: this.extractAffiliateTag(url),
                });
            }
            if (links.length > 0) return links;
        }

        // Fallback to generic
        return this.scrapeGeneric(html);
    }

    /**
     * Generic link scraper (fallback for any platform)
     * Improved to be more comprehensive
     */
    private scrapeGeneric(html: string): ScrapedLink[] {
        const links: ScrapedLink[] = [];
        const seenUrls = new Set<string>();
        let position = 0;

        // Method 1: Try to find any embedded JSON data first
        const jsonPatterns = [
            /<script[^>]*id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/i,
            /window\.__INITIAL_DATA__\s*=\s*({.+?});?\s*<\/script>/is,
            /"links"\s*:\s*(\[[^\]]+\])/i,
        ];

        for (const pattern of jsonPatterns) {
            const match = html.match(pattern);
            if (match) {
                try {
                    let data = JSON.parse(match[1]);
                    if (data.props?.pageProps) data = data.props.pageProps;

                    const linkArrays = [data.links, data.buttons, data.items, data.blocks];
                    for (const arr of linkArrays) {
                        if (!Array.isArray(arr)) continue;
                        for (const item of arr) {
                            const url = item.url || item.href || item.link;
                            if (!url || typeof url !== 'string') continue;
                            if (seenUrls.has(url)) continue;
                            seenUrls.add(url);

                            links.push({
                                title: item.title || item.text || item.label || item.name || 'Untitled',
                                url: this.resolveUrl(url),
                                position: position++,
                                isAffiliate: this.isAffiliateLink(url),
                                detectedNetwork: this.detectNetwork(url),
                                affiliateTag: this.extractAffiliateTag(url),
                            });
                        }
                    }
                    if (links.length > 0) return links;
                } catch (e) { /* Continue to HTML parsing */ }
            }
        }

        // Method 2: Look for all <a> tags with external URLs
        const linkPattern = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*>([^<]*(?:<[^>]+>[^<]*)*)<\/a>/gis;
        let match;

        while ((match = linkPattern.exec(html)) !== null) {
            let url = match[1];
            const title = match[2]?.replace(/<[^>]+>/g, '').trim() || 'Untitled Link';

            // Skip non-interesting links
            if (this.isSkippableLink(url)) continue;
            if (seenUrls.has(url)) continue;
            seenUrls.add(url);

            links.push({
                title: title.substring(0, 100),
                url,
                position: position++,
                isAffiliate: this.isAffiliateLink(url),
                detectedNetwork: this.detectNetwork(url),
                affiliateTag: this.extractAffiliateTag(url),
            });
        }

        return links;
    }

    /**
     * Check if URL is an affiliate link
     * Extended with more comprehensive patterns
     */
    private isAffiliateLink(url: string): boolean {
        const affiliateIndicators = [
            // Amazon
            'amazon.com', 'amzn.to', 'tag=', 'urlgeni.us/amazon',
            // LTK / RewardStyle
            'ltk.app', 'liketoknow.it', 'liketk.it', 'shopltk.com',
            // ShopStyle / Collective Voice
            'shopstyle.it', 'rstyle.me', 'howl.me', 'collective.com',
            // ShopMy
            'shopmy.us', 'shop-links.co',
            // Skimlinks / SkimResources
            'go.skimresources.com', 'go.redirectingat.com',
            // Awin
            'awin1.com', 'zenaps.com',
            // ShareASale
            'shareasale.com', 'shareasale-analytics.com',
            // CJ Affiliate / Commission Junction
            'commission-junction.com', 'dpbolvw.net', 'jdoqocy.com',
            'tkqlhce.com', 'anrdoezrs.net', 'kqzyfj.com', 'emjcd.com',
            // Rakuten / LinkShare
            'click.linksynergy.com', 'ens.ad', 'rakutenadvertising.com',
            // Impact / Partnerize
            'pntra.com', 'pjatr.com', 'pxf.io', 'evyy.net', 'qflm.net',
            'prf.hn', 'impact.com', 'partnerize.com',
            // FlexOffers
            'flexoffers.com', 'flexshopper.com',
            // Pepperjam / Ascend
            'pjtra.com', 'gopjn.com',
            // Refersion / Rewardful
            'refersion.com', 'rewardful.com',
            // Other affiliate networks
            'webgains.com', 'tradedoubler.com', 'tradetracker.net',
            'admitad.com', 'affiliatly.com', 'cj.com',
            // Major retailers with affiliate programs
            'sephora.com', 'ulta.com', 'nordstrom.com',
            'target.com/aff', 'walmart.com/aff',
            // Generic affiliate indicators
            'affiliates.', '/affiliate/', 'ref=',
            'utm_source=affiliate', 'affid=', 'aff_id=',
            // Link shorteners commonly used for affiliates
            'bit.ly', 'tinyurl.com', 'ow.ly', 'buff.ly',
            // Creator storefronts
            'creator-spring.com', 'spring.com', 'teespring.com',
            // Subscription boxes
            'fabfitfun.com', 'boxycharm.com', 'ipsy.com',
            // Thanks.is and other creator platforms
            'thanks.is', 'glow.fm', 'fanhouse.app',
        ];

        const lowerUrl = url.toLowerCase();
        return affiliateIndicators.some(indicator => lowerUrl.includes(indicator));
    }

    /**
     * Detect affiliate network from URL
     */
    private detectNetwork(url: string): string | undefined {
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.includes('amazon.com') || lowerUrl.includes('amzn.to')) {
            return 'amazon';
        }
        if (lowerUrl.includes('ltk.app') || lowerUrl.includes('liketoknow.it')) {
            return 'ltk';
        }
        if (lowerUrl.includes('shopstyle.it') || lowerUrl.includes('rstyle.me')) {
            return 'shopstyle';
        }
        if (lowerUrl.includes('shopmy.us')) {
            return 'shopmy';
        }
        if (lowerUrl.includes('awin1.com')) {
            return 'awin';
        }
        if (lowerUrl.includes('shareasale.com')) {
            return 'shareasale';
        }
        if (lowerUrl.includes('go.skimresources.com')) {
            return 'skimlinks';
        }

        return undefined;
    }

    /**
     * Extract affiliate tag from URL
     */
    private extractAffiliateTag(url: string): string | undefined {
        try {
            const urlObj = new URL(url);

            // Amazon tag
            const tag = urlObj.searchParams.get('tag');
            if (tag) return tag;

            // Generic ref
            const ref = urlObj.searchParams.get('ref');
            if (ref) return ref;

            // Affiliate ID patterns
            const affId = urlObj.searchParams.get('affid') || urlObj.searchParams.get('aff_id');
            if (affId) return affId;

        } catch {
            // Invalid URL
        }

        return undefined;
    }

    /**
     * Get social network name from URL for display
     */
    private getSocialNameFromUrl(url: string): string | undefined {
        const lowerUrl = url.toLowerCase();
        const socialMap: Record<string, string> = {
            'instagram.com': 'Instagram',
            'tiktok.com': 'TikTok',
            'youtube.com': 'YouTube',
            'youtu.be': 'YouTube',
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'facebook.com': 'Facebook',
            'pinterest.com': 'Pinterest',
            'snapchat.com': 'Snapchat',
            'linkedin.com': 'LinkedIn',
            'twitch.tv': 'Twitch',
            'spotify.com': 'Spotify',
            'discord.gg': 'Discord',
            'discord.com': 'Discord',
            'threads.net': 'Threads',
        };

        for (const [pattern, name] of Object.entries(socialMap)) {
            if (lowerUrl.includes(pattern)) {
                return name;
            }
        }
        return undefined;
    }

    /**
     * Resolve relative URLs to absolute
     */
    private resolveUrl(url: string): string {
        // Already absolute
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }

        // Protocol-relative
        if (url.startsWith('//')) {
            return 'https:' + url;
        }

        // Can't resolve without base URL
        return url;
    }

    /**
     * Check if link should be skipped (non-content)
     * NOTE: Social media links are NOT skipped - they're categorized separately
     */
    private isSkippableLink(url: string): boolean {
        const skipPatterns = [
            // App stores
            'apps.apple.com', 'play.google.com',
            // Legal pages
            'privacy', 'terms', 'cookie', 'legal',
            '/login', '/signup', '/register',
            // Internal platform links (not user content)
            '/about', '/help', '/support', '/contact',
        ];

        const lowerUrl = url.toLowerCase();
        return skipPatterns.some(pattern => lowerUrl.includes(pattern));
    }

    /**
     * Generate migration suggestions
     */
    private generateSuggestions(links: ScrapedLink[], platform: string): string[] {
        const suggestions: string[] = [];
        const affiliateCount = links.filter(l => l.isAffiliate).length;

        if (platform === 'linktree') {
            suggestions.push('Import your Linktree links to SmartWrappers for better control and analytics');
        } else if (platform === 'beacons') {
            suggestions.push('Migrate from Beacons to gain advanced link management features');
        } else if (platform === 'stan') {
            suggestions.push('Connect your Stan Store products for automated health monitoring');
        } else {
            suggestions.push('Import your links to enable autopilot mode and failover protection');
        }

        if (affiliateCount > 0) {
            suggestions.push(`Found ${affiliateCount} affiliate links ready for import`);
        }

        if (affiliateCount > 5) {
            suggestions.push('Enable autopilot for automatic stock-out detection and alerts');
        }

        return suggestions;
    }
}
