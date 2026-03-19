/**
 * AffiMark Backend - Main Entry Point
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Import full API routes
import api from './api';


// Environment type - exported for use in other files
export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SUPABASE_ANON_KEY: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  RAINFOREST_API_KEY?: string;
  KEEPA_API_KEY?: string;         // keepa.com — free tier: 1 token/minute, 1200 products/day
  AMAZON_PA_ACCESS_KEY?: string;  // Amazon Product Advertising API (free for Associates)
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

// Health check endpoint — also prints env key availability for debugging
app.get('/api/health', (c) => {
  const hasOpenAI = !!(c.env.OPENAI_API_KEY || (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY));
  const keySource = c.env.OPENAI_API_KEY ? 'c.env' : (typeof process !== 'undefined' && process.env?.OPENAI_API_KEY ? 'process.env' : 'MISSING');
  console.log(`[Health] OPENAI_API_KEY present: ${hasOpenAI} (source: ${keySource})`);
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'AffiMark Backend is running',
    ai: { openai: hasOpenAI, keySource },
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

export default {
  fetch: app.fetch,
};

