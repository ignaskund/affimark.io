/**
 * Product Page Enricher
 *
 * Fetches the product's merchant page and extracts structured data
 * (JSON-LD / schema.org) to get REAL rating, reviewCount, warranty info.
 *
 * Applied only to the final top-N products (not all candidates) to
 * keep latency and rate-limit budget manageable.
 *
 * Flow:
 *   1. Use `direct_url` (merchant page) if available
 *   2. Otherwise follow the affiliate `url` redirect chain
 *   3. Fetch HTML from final destination
 *   4. Extract <script type="application/ld+json"> blocks
 *   5. Parse schema.org Product / AggregateRating / Offer objects
 */

export interface PageEnrichmentResult {
  rating?: number;
  reviewCount?: number;
  warrantyMonths?: number;
  priceConfirmed?: number;
  currencyConfirmed?: string;
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  fetchedUrl?: string;
  fetchDurationMs?: number;
  error?: string;
}

const FETCH_TIMEOUT_MS = 5000;

/**
 * Enrich a single product by fetching its merchant page.
 */
export async function enrichFromProductPage(
  directUrl?: string,
  affiliateUrl?: string,
): Promise<PageEnrichmentResult> {
  const url = directUrl || affiliateUrl;
  if (!url) {
    return { error: 'no_url_available' };
  }

  const start = Date.now();
  try {
    const html = await fetchPage(url);
    const elapsed = Date.now() - start;
    const jsonLdBlocks = extractJsonLd(html);
    const structured = parseProductData(jsonLdBlocks);

    return {
      ...structured,
      fetchedUrl: url,
      fetchDurationMs: elapsed,
    };
  } catch (err: any) {
    return {
      fetchedUrl: url,
      fetchDurationMs: Date.now() - start,
      error: err?.message || 'fetch_failed',
    };
  }
}

/**
 * Enrich multiple products in parallel with concurrency control.
 */
export async function enrichBatch(
  products: Array<{ directUrl?: string; affiliateUrl?: string }>,
  concurrency = 5,
): Promise<PageEnrichmentResult[]> {
  const results: PageEnrichmentResult[] = new Array(products.length);
  let idx = 0;

  async function worker() {
    while (idx < products.length) {
      const i = idx++;
      results[i] = await enrichFromProductPage(
        products[i].directUrl,
        products[i].affiliateUrl,
      );
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, products.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ─── Internal helpers ───────────────────────────────────────────────

async function fetchPage(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AffiMarkBot/1.0; +https://affimark.io)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`http_${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('not_html');
    }

    // Read at most 500KB to avoid OOM on huge pages
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no_body');

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 512 * 1024;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes >= MAX_BYTES) break;
    }

    reader.releaseLock();
    const decoder = new TextDecoder();
    return chunks.map(c => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  } finally {
    clearTimeout(timer);
  }
}

function extractJsonLd(html: string): any[] {
  const blocks: any[] = [];
  // Match all <script type="application/ld+json"> ... </script> blocks
  const regex = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        blocks.push(...parsed);
      } else {
        blocks.push(parsed);
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return blocks;
}

function parseProductData(blocks: any[]): Omit<PageEnrichmentResult, 'fetchedUrl' | 'fetchDurationMs' | 'error'> {
  const result: Omit<PageEnrichmentResult, 'fetchedUrl' | 'fetchDurationMs' | 'error'> = {};

  for (const block of blocks) {
    const items = flattenGraph(block);
    for (const item of items) {
      const type = normalizeType(item['@type']);

      if (type === 'product' || type === 'individualproduct') {
        // Aggregate rating
        const agg = item.aggregateRating;
        if (agg) {
          const rating = parseFloat(agg.ratingValue);
          const count = parseInt(agg.reviewCount || agg.ratingCount, 10);
          if (!isNaN(rating)) result.rating = rating;
          if (!isNaN(count)) result.reviewCount = count;
        }

        // Offers → price + availability
        const offers = item.offers;
        if (offers) {
          const offerList = Array.isArray(offers) ? offers : [offers];
          for (const offer of offerList) {
            const price = parseFloat(offer.price);
            if (!isNaN(price) && price > 0) {
              result.priceConfirmed = price;
              result.currencyConfirmed = offer.priceCurrency;
            }
            const avail = (offer.availability || '').toLowerCase();
            if (avail.includes('instock')) result.availability = 'in_stock';
            else if (avail.includes('outofstock')) result.availability = 'out_of_stock';
            else if (avail.includes('preorder')) result.availability = 'preorder';
          }
        }

        // Warranty
        if (item.warranty) {
          const w = typeof item.warranty === 'string' ? item.warranty : item.warranty.name || '';
          const months = parseWarrantyMonths(w);
          if (months > 0) result.warrantyMonths = months;
        }
      }

      // Also check for standalone AggregateRating
      if (type === 'aggregaterating') {
        const rating = parseFloat(item.ratingValue);
        const count = parseInt(item.reviewCount || item.ratingCount, 10);
        if (!isNaN(rating) && result.rating == null) result.rating = rating;
        if (!isNaN(count) && result.reviewCount == null) result.reviewCount = count;
      }
    }
  }

  return result;
}

function flattenGraph(block: any): any[] {
  if (block['@graph']) return block['@graph'];
  return [block];
}

function normalizeType(type: any): string {
  if (Array.isArray(type)) return type[0]?.toLowerCase() || '';
  return (type || '').toLowerCase();
}

function parseWarrantyMonths(text: string): number {
  const lower = text.toLowerCase();
  // "2 years", "24 months", "1-year warranty"
  const yearMatch = lower.match(/(\d+)\s*-?\s*year/);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;

  const monthMatch = lower.match(/(\d+)\s*-?\s*month/);
  if (monthMatch) return parseInt(monthMatch[1], 10);

  return 0;
}
