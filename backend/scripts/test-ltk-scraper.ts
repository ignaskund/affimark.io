/**
 * Quick test script to validate the LTK scraper directly
 * Run with: npx tsx scripts/test-ltk-scraper.ts
 */

import { scrapeStorefront } from '../src/services/storefront-scraper';

const TIMEOUT_MS = 20000; // 20 seconds max

async function testLTKScraper() {
    console.log('Testing LTK Storefront Scraper...\n');

    const url = 'https://www.shopltk.com/explore/sarahknuth';
    console.log(`Testing: ${url}`);
    console.log('='.repeat(60));

    // Set timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Timeout after 20s')), TIMEOUT_MS);
    });

    try {
        const result = await Promise.race([
            scrapeStorefront(url, 5),
            timeoutPromise
        ]);

        console.log(`\nResult:`);
        console.log(`  Success: ${result.success}`);
        console.log(`  Platform: ${result.platform}`);
        console.log(`  Products found: ${result.products.length}`);

        if (result.error) {
            console.log(`  Error: ${result.error}`);
        }

        if (result.products.length > 0) {
            console.log('\nProducts:');
            for (const p of result.products) {
                console.log(`  - ${p.title}`);
                console.log(`    Price: ${p.price || 'N/A'}`);
                console.log(`    URL: ${p.url.slice(0, 60)}...`);
            }
        }
    } catch (e: any) {
        console.error(`Error:`, e.message);
    }
}

testLTKScraper().catch(console.error);
