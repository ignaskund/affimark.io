/**
 * AffiMark Backend - Main Entry Point
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import full API routes
import api from './api';

// Import watchlist monitor for scheduled tasks
import { runWatchlistMonitor } from './services/verifier/watchlist-monitor';

// Environment type - exported for use in other files
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_ANON_KEY: string;
  ANTHROPIC_API_KEY?: string;
  RAINFOREST_API_KEY?: string;
  SCRAPINGDOG_API_KEY?: string;
  DATAFEEDR_ACCESS_ID?: string;
  DATAFEEDR_SECRET_KEY?: string;
  FRONTEND_URL?: string;
  NODE_ENV?: string;
  AI_ENABLED?: string;
  // Cloudflare bindings
  BROWSER?: any;
  AI?: any; // Workers AI binding
  AI_CACHE?: KVNamespace; // KV namespace for AI caching
};

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: (origin) => {
    // Allow all localhost ports
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return origin;
    }
    // Allow production domains
    const allowedDomains = [
      'affimark.io',
      'www.affimark.io',
      'affimark-frontend.vercel.app',
    ];
    if (origin && allowedDomains.some(d => origin.includes(d))) {
      return origin;
    }
    // Default allow for development
    return origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  credentials: true,
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'AffiMark Backend is running'
  });
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'AffiMark Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// Mount all API routes
app.route('/', api);

// Export with scheduled handler for cron triggers
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run watchlist monitoring on schedule (every 6 hours)
    ctx.waitUntil(
      runWatchlistMonitor(env)
        .then((result) => {
          console.log(`Watchlist monitor completed: checked ${result.checked} items, created ${result.alerts} alerts`);
        })
        .catch((error) => {
          console.error('Watchlist monitor error:', error);
        })
    );
  },
};

