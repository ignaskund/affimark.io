import { Hono } from 'hono';
import type { Env } from './index';

const api = new Hono<{ Bindings: Env }>();

// CORS — tightened for production
const ALLOWED_ORIGINS = [
  'https://affimark.io',
  'https://www.affimark.io',
];

api.use('*', async (c, next) => {
  await next();
  const origin = c.req.header('Origin') || '';
  const isDev = origin.includes('localhost') || origin.includes('127.0.0.1');
  if (isDev || ALLOWED_ORIGINS.includes(origin)) {
    c.header('Access-Control-Allow-Origin', origin);
    c.header('Access-Control-Allow-Credentials', 'true');
  }
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-id');
});

api.options('*', () => new Response(null, { status: 204 }));

// Core routes
import finderRoutes from './routes/finder-routes';
api.route('/api/finder', finderRoutes);

import portfolioRoutes from './routes/portfolio-routes';
api.route('/api/portfolio', portfolioRoutes);

import migrationRoutes from './api/migration-routes';
api.route('/api/migration', migrationRoutes);

export default api;
