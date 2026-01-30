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
    ANTHROPIC_API_KEY?: string;
    RAINFOREST_API_KEY?: string;
    SCRAPINGDOG_API_KEY?: string;
    NODE_ENV?: string;
    // Cloudflare Browser Rendering binding
    BROWSER?: any;
};

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
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

export default app;

