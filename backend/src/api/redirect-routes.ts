/**
 * Redirect Link API Routes
 *
 * Endpoints:
 * POST   /api/redirects              - Create redirect link
 * GET    /api/redirects              - Get user's redirect links
 * GET    /api/redirects/:id          - Get single redirect link
 * PATCH  /api/redirects/:id          - Update redirect link
 * DELETE /api/redirects/:id          - Deactivate redirect link
 * POST   /api/redirects/:id/swap     - Manually swap destination
 * GET    /api/redirects/:id/analytics - Get click analytics
 * POST   /api/redirects/bulk         - Bulk create from link list
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { RedirectLinkService } from '../services/redirect-link-service';

type Bindings = Env;

const redirectRoutes = new Hono<{ Bindings: Bindings }>();

// Helper to get Supabase client
function getSupabase(c: any) {
  return createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  );
}

// Helper to get user ID from auth header
async function getUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabase = getSupabase(c);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

// Create redirect link
redirectRoutes.post('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { destinationUrl, linkLabel, productName, merchantName, affiliateNetwork, fallbackUrl, isAutopilotEnabled } = body;

  if (!destinationUrl) {
    return c.json({ error: 'destinationUrl is required' }, 400);
  }

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    const redirectLink = await service.createRedirectLink({
      userId,
      destinationUrl,
      linkLabel,
      productName,
      merchantName,
      affiliateNetwork,
      fallbackUrl,
      isAutopilotEnabled,
    });

    return c.json({
      redirectLink,
      shortUrl: `https://affimark.io/go/${redirectLink.short_code}`,
    });
  } catch (error: any) {
    console.error('Create redirect link error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get user's redirect links
redirectRoutes.get('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    const redirectLinks = await service.getUserRedirectLinks(userId);

    // Add short URLs
    const linksWithUrls = redirectLinks.map((link) => ({
      ...link,
      shortUrl: `https://affimark.io/go/${link.short_code}`,
    }));

    return c.json({ redirectLinks: linksWithUrls });
  } catch (error: any) {
    console.error('Get redirect links error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get single redirect link
redirectRoutes.get('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    const { data, error } = await supabase
      .from('redirect_links')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      return c.json({ error: 'Redirect link not found' }, 404);
    }

    return c.json({
      redirectLink: {
        ...data,
        shortUrl: `https://affimark.io/go/${data.short_code}`,
      },
    });
  } catch (error: any) {
    console.error('Get redirect link error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update redirect link
redirectRoutes.patch('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  const body = await c.req.json();

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: existing } = await supabase
      .from('redirect_links')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'Redirect link not found' }, 404);
    }

    // Update
    const { data, error } = await supabase
      .from('redirect_links')
      .update({
        link_label: body.linkLabel,
        fallback_url: body.fallbackUrl,
        is_autopilot_enabled: body.isAutopilotEnabled,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json({
      redirectLink: {
        ...data,
        shortUrl: `https://affimark.io/go/${data.short_code}`,
      },
    });
  } catch (error: any) {
    console.error('Update redirect link error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Deactivate redirect link
redirectRoutes.delete('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    // Verify ownership
    const { data: existing } = await supabase
      .from('redirect_links')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'Redirect link not found' }, 404);
    }

    await service.deactivate(id);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Deactivate redirect link error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Manually swap destination
redirectRoutes.post('/:id/swap', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  const body = await c.req.json();
  const { newDestination } = body;

  if (!newDestination) {
    return c.json({ error: 'newDestination is required' }, 400);
  }

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    // Verify ownership
    const { data: existing } = await supabase
      .from('redirect_links')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'Redirect link not found' }, 404);
    }

    await service.swapDestination({
      redirectLinkId: id,
      newDestination,
      swapReason: 'manual',
      triggeredBy: 'user',
    });

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Swap destination error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get click analytics
redirectRoutes.get('/:id/analytics', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();
  const days = parseInt(c.req.query('days') || '30');

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    // Verify ownership
    const { data: existing } = await supabase
      .from('redirect_links')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'Redirect link not found' }, 404);
    }

    const analytics = await service.getClickAnalytics(id, days);
    const swapHistory = await service.getSwapHistory(id);

    return c.json({ analytics, swapHistory });
  } catch (error: any) {
    console.error('Get analytics error:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Bulk create from link list (onboarding)
redirectRoutes.post('/bulk', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { links } = body;

  if (!Array.isArray(links) || links.length === 0) {
    return c.json({ error: 'links array is required' }, 400);
  }

  try {
    const supabase = getSupabase(c);
    const service = new RedirectLinkService(supabase);

    const redirectLinks = await service.bulkCreateFromLinks(userId, links);

    const linksWithUrls = redirectLinks.map((link) => ({
      ...link,
      shortUrl: `https://affimark.io/go/${link.short_code}`,
    }));

    return c.json({
      redirectLinks: linksWithUrls,
      count: redirectLinks.length,
    });
  } catch (error: any) {
    console.error('Bulk create error:', error);
    return c.json({ error: error.message }, 500);
  }
});

export default redirectRoutes;
