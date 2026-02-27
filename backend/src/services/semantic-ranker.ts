/**
 * Semantic Ranker
 *
 * Uses OpenAI text-embedding-3-small to compute cosine similarity between
 * the user's product intent and Datafeedr candidates.
 *
 * This replaces keyword-only matching with genuine semantic similarity:
 * "lavender essential oil" will correctly score-match
 * "aromatherapy diffuser blend" and "natural botanical fragrance oil"
 * even though they share zero words.
 *
 * Cost: ~$0.00012 per search (200 products × 30 tokens × $0.02/1M tokens).
 */

interface EmbeddingCache {
  vector: number[];
  text: string;
  createdAt: number;
}

// In-memory cache per Worker invocation (resets per request, fine for our scale)
const _cache = new Map<string, EmbeddingCache>();

/**
 * Get an embedding vector for a piece of text.
 * Caches within the same request lifecycle.
 */
async function embed(text: string, apiKey: string): Promise<number[]> {
  const key = text.slice(0, 100);
  if (_cache.has(key)) return _cache.get(key)!.vector;

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 512), // truncate to keep tokens low
      encoding_format: 'float',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Embedding API error ${response.status}: ${err}`);
  }

  const data: any = await response.json();
  const vector = data.data[0].embedding;
  _cache.set(key, { vector, text, createdAt: Date.now() });
  return vector;
}

/**
 * Cosine similarity between two vectors (range: -1 to 1, higher = more similar).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Build a rich text representation of a product for embedding.
 * More signal = better similarity matching.
 */
function productToEmbedText(product: {
  name: string;
  brand?: string;
  category?: string;
  description?: string;
}): string {
  const parts = [
    product.name,
    product.brand ? `by ${product.brand}` : '',
    product.category ? `(${product.category})` : '',
    product.description ? product.description.slice(0, 100) : '',
  ].filter(Boolean);
  return parts.join(' ').slice(0, 512);
}

/**
 * Build query text from product intent for embedding.
 */
function intentToEmbedText(intent: {
  searchQuery: string;
  category?: string;
  subcategory?: string;
  keywords?: string[];
  brand?: string;
}): string {
  const parts = [
    intent.subcategory || intent.category || '',
    intent.searchQuery,
    intent.keywords?.join(' ') || '',
  ].filter(Boolean);
  return parts.join(' ').slice(0, 256);
}

export interface SemanticScore {
  productId: string;
  similarity: number; // 0-100 normalised
}

/**
 * Keyword-overlap fallback score when embeddings are unavailable.
 * Counts how many words from the search query appear in the product text.
 * Returns 0-90 (never 100 — embeddings are preferred for top confidence).
 */
export function keywordOverlapScore(
  intent: { searchQuery: string; keywords?: string[]; category?: string },
  product: { name: string; brand?: string; category?: string; description?: string }
): number {
  const queryText = [intent.searchQuery, ...(intent.keywords || [])].join(' ');
  const queryWords = new Set(
    queryText.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
  );
  if (queryWords.size === 0) return 50;

  const productText = [product.name, product.brand, product.category, product.description]
    .filter(Boolean).join(' ').toLowerCase();

  let matches = 0;
  for (const word of queryWords) {
    if (productText.includes(word)) matches++;
  }

  if (matches === 0) return 20;
  if (matches === 1) return 40;
  if (matches === 2) return 60;
  return Math.min(90, 60 + matches * 10);
}

/**
 * Semantically re-rank an array of candidate products against a query intent.
 *
 * @param intent       The user's product search intent
 * @param candidates   Products to re-rank (need id, name, brand, category, description)
 * @param apiKey       OpenAI API key
 * @param topK         Only embed top-K candidates by name length (faster, cheaper)
 * @returns Map of productId → similarity score 0-100
 */
export async function semanticRerank(
  intent: {
    searchQuery: string;
    category?: string;
    subcategory?: string;
    keywords?: string[];
    brand?: string;
  },
  candidates: Array<{
    id: string;
    name: string;
    brand?: string;
    category?: string;
    description?: string;
  }>,
  apiKey: string,
  topK = 100
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  if (!apiKey || candidates.length === 0) return scores;

  // Embed the query intent
  const queryText = intentToEmbedText(intent);

  let queryVector: number[];
  try {
    queryVector = await embed(queryText, apiKey);
  } catch (err) {
    console.warn('[SemanticRanker] Failed to embed query, skipping rerank:', err);
    return scores;
  }

  // Embed candidates in a single batch request (much cheaper than N individual calls)
  const candidateSlice = candidates.slice(0, topK);
  const texts = candidateSlice.map(p => productToEmbedText(p).slice(0, 256));

  let productVectors: number[][];
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: texts,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.warn('[SemanticRanker] Batch embedding failed:', err);
      return scores;
    }

    const data: any = await response.json();
    productVectors = data.data
      .sort((a: any, b: any) => a.index - b.index)
      .map((d: any) => d.embedding);

    console.log(`[SemanticRanker] Embedded ${productVectors.length} candidates (${data.usage?.total_tokens || '?'} tokens)`);
  } catch (err) {
    console.warn('[SemanticRanker] Batch embedding request failed:', err);
    return scores;
  }

  // Compute cosine similarity and normalise to 0-100
  for (let i = 0; i < candidateSlice.length; i++) {
    const raw = cosineSimilarity(queryVector, productVectors[i]);
    // text-embedding-3-small similarities typically range 0.2–0.9 for related content
    // Normalise: map [0.2, 0.9] → [0, 100], clamp
    const normalised = Math.max(0, Math.min(100, ((raw - 0.2) / 0.7) * 100));
    scores.set(candidateSlice[i].id, Math.round(normalised));
  }

  return scores;
}
