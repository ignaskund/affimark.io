/**
 * Quick test script for AmazonDirectScraper
 * Run with: npx ts-node --esm test-scraper.ts
 */

import { AmazonDirectScraper } from './src/services/amazon-direct-scraper.js';

async function testScraper() {
    console.log('🧪 Testing Amazon Direct Scraper...\n');

    const scraper = new AmazonDirectScraper({
        requestsPerSecond: 0.5,
        domain: 'amazon.com',
    });

    // Test with a popular Amazon product (AmazonBasics USB-C Cable)
    const testASIN = 'B07FZ8S74R';

    console.log(`📦 Fetching product: ${testASIN}`);
    console.log('   URL: https://www.amazon.com/dp/' + testASIN);
    console.log('');

    const result = await scraper.scrapeProduct(testASIN);

    if (result.success && result.product) {
        console.log('✅ Scrape successful!\n');
        console.log('📋 Product Data:');
        console.log('─'.repeat(50));
        console.log(`   Title: ${result.product.title || '(not found)'}`);
        console.log(`   Price: ${result.product.currency} ${result.product.price || '(not found)'}`);
        console.log(`   Rating: ${result.product.rating || '(not found)'} ⭐`);
        console.log(`   Reviews: ${result.product.reviewCount || '(not found)'}`);
        console.log(`   Brand: ${result.product.brand || '(not found)'}`);
        console.log(`   Availability: ${result.product.availability}`);
        console.log(`   Image: ${result.product.imageUrl ? '✓ Found' : '✗ Not found'}`);
        console.log(`   Features: ${result.product.features.length} bullet points`);
        console.log('─'.repeat(50));

        if (result.product.imageUrl) {
            console.log(`\n🖼️  Image URL:\n   ${result.product.imageUrl.substring(0, 80)}...`);
        }
    } else {
        console.log('❌ Scrape failed!');
        console.log(`   Error: ${result.error}`);
        console.log(`   Blocked: ${result.blocked ? 'Yes (CAPTCHA)' : 'No'}`);
    }

    console.log('\n🏁 Test complete!');
}

testScraper().catch(console.error);
