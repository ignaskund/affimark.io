/**
 * AI Extraction API Routes
 * Uses Cloudflare Workers AI for brand/category extraction
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { extractWithAI } from '../services/ai-extractor';

const ai = new Hono<{ Bindings: Env }>();

/**
 * POST /api/ai/extract
 * Extract brand and category from product URL/title using Workers AI
 */
ai.post('/extract', async (c) => {
  try {
    const { url, title, userIntensity } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Call Workers AI extraction
    const result = await extractWithAI(
      {
        url,
        title: title || null,
        userIntensity: userIntensity || 'light',
      },
      c.env
    );

    if (!result) {
      return c.json({
        error: 'AI extraction not available or failed',
        fallback: true,
      }, 200);
    }

    return c.json(result);
  } catch (error) {
    console.error('[AI Extract] Error:', error);
    return c.json(
      {
        error: 'AI extraction failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * GET /api/ai/health
 * Check if Workers AI is available
 */
ai.get('/health', async (c) => {
  const hasAI = !!c.env.AI;
  const hasCache = !!c.env.AI_CACHE;
  const aiEnabled = c.env.AI_ENABLED !== 'false';

  return c.json({
    available: hasAI && aiEnabled,
    ai_binding: hasAI,
    cache_binding: hasCache,
    ai_enabled: aiEnabled,
    model: '@cf/meta/llama-3-8b-instruct',
  });
});

/**
 * DELETE /api/ai/cache/:cacheKey
 * Clear specific cache entry (for testing)
 */
ai.delete('/cache/:cacheKey', async (c) => {
  try {
    const cacheKey = c.req.param('cacheKey');

    if (!c.env.AI_CACHE) {
      return c.json({ error: 'KV cache not available' }, 503);
    }

    await c.env.AI_CACHE.delete(cacheKey);

    return c.json({ success: true, cacheKey });
  } catch (error) {
    console.error('[AI Cache] Delete error:', error);
    return c.json(
      {
        error: 'Failed to delete cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default ai;
