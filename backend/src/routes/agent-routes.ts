/**
 * Agent API Routes (Cloudflare Worker)
 * Routes for context-aware agent chat
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { generateAgentResponse } from '../services/agents/context-aware-agent';

const app = new Hono();

// Enable CORS
app.use('/*', cors({
  origin: (origin) => {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://affimark.io',
      'https://www.affimark.io',
      'https://affimark-frontend.vercel.app',
    ];
    return (origin && allowed.includes(origin)) ? origin : allowed[0];
  },
  credentials: true,
}));

/**
 * POST /api/agent/chat
 * Context-aware chat with agent
 */
app.post('/api/agent/chat', async (c) => {
  try {
    const body = await c.req.json();
    const {
      message,
      conversationHistory = [],
      context,
    } = body;

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }

    if (!context) {
      return c.json({ error: 'context is required' }, 400);
    }

    console.log('[Agent Chat] Generating response...');
    console.log('[Agent Chat] Active context:', context.activeContext);
    console.log('[Agent Chat] Current product:', context.currentProduct?.name);

    const response = await generateAgentResponse(
      message,
      conversationHistory,
      context
    );

    return c.json({
      response,
      meta: {
        model: 'claude-3-5-sonnet-20241022',
        contextAware: true,
        activeSocials: context.activeContext?.socials?.length || 0,
        activeStorefronts: context.activeContext?.storefronts?.length || 0,
      },
    });
  } catch (error: any) {
    console.error('[Agent Chat] Error:', error);
    return c.json({
      error: 'Chat failed',
      message: error.message,
    }, 500);
  }
});

export default app;
