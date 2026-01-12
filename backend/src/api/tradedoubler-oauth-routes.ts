/**
 * Tradedoubler OAuth Routes
 *
 * OAuth flow for automated Tradedoubler earnings sync
 * Allows users to connect their Tradedoubler affiliate account
 * and automatically sync transactions without CSV uploads
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

type Bindings = Env;

const tradedoublerOAuthRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Step 1: Initiate OAuth flow
 * GET /api/tradedoubler/oauth/authorize
 *
 * Redirects user to Tradedoubler OAuth authorization page
 */
tradedoublerOAuthRoutes.get('/oauth/authorize', async (c) => {
  try {
    // Get user ID from auth header
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Check if Tradedoubler OAuth is configured
    if (!c.env.TRADEDOUBLER_CLIENT_ID || !c.env.TRADEDOUBLER_CLIENT_SECRET) {
      return c.json({
        error: 'Tradedoubler OAuth not configured. Please use CSV upload instead.'
      }, 400);
    }

    // Build OAuth authorization URL
    const redirectUri = `${c.env.BASE_URL}/api/tradedoubler/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');

    const authUrl = new URL('https://connect.tradedoubler.com/oauth/authorize');
    authUrl.searchParams.set('client_id', c.env.TRADEDOUBLER_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'statistics events');

    return c.json({ authUrl: authUrl.toString() });
  } catch (error: any) {
    console.error('Tradedoubler OAuth authorize error:', error);
    return c.json({ error: 'Failed to initiate OAuth flow' }, 500);
  }
});

/**
 * Step 2: OAuth callback handler
 * GET /api/tradedoubler/oauth/callback
 *
 * Tradedoubler redirects here after user authorizes
 */
tradedoublerOAuthRoutes.get('/oauth/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      console.error('Tradedoubler OAuth error:', error);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=tradedoubler_oauth_denied`);
    }

    if (!code || !state) {
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=missing_params`);
    }

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const tokenUrl = 'https://connect.tradedoubler.com/oauth/token';
    const redirectUri = `${c.env.BASE_URL}/api/tradedoubler/oauth/callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${c.env.TRADEDOUBLER_CLIENT_ID}:${c.env.TRADEDOUBLER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Tradedoubler token exchange failed:', errorData);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get organization/publisher info
    const orgResponse = await fetch('https://api.tradedoubler.com/1.0/organizations', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    let accountIdentifier = 'Unknown';
    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      accountIdentifier = orgData.organizations?.[0]?.id || orgData.id || 'Unknown';
    }

    // Store in database
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: dbError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: userId,
        platform: 'tradedoubler',
        storefront_name: 'Tradedoubler Affiliate Account',
        account_identifier: accountIdentifier,
        region: 'EU',
        access_token,
        refresh_token,
        token_expires_at: expiresAt,
        is_active: true,
        sync_status: 'pending',
        last_sync_at: null,
      }, {
        onConflict: 'user_id,platform,account_identifier',
      });

    if (dbError) {
      console.error('Failed to store Tradedoubler credentials:', dbError);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=db_error`);
    }

    // Trigger initial sync (fire-and-forget)
    fetch(`${c.env.BASE_URL}/api/tradedoubler/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    }).catch((err) => console.error('Initial sync trigger failed:', err));

    return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?success=tradedoubler_connected`);
  } catch (error: any) {
    console.error('Tradedoubler OAuth callback error:', error);
    return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=callback_failed`);
  }
});

/**
 * Sync Tradedoubler transactions
 * POST /api/tradedoubler/sync
 *
 * Fetches recent transactions from Tradedoubler API and stores them
 */
tradedoublerOAuthRoutes.post('/sync', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Get user's Tradedoubler connected account
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'tradedoubler')
      .eq('is_active', true)
      .single();

    if (!account) {
      return c.json({ error: 'Tradedoubler account not connected' }, 404);
    }

    // Check if token expired, refresh if needed
    let accessToken = account.access_token;
    if (new Date(account.token_expires_at) < new Date()) {
      accessToken = await refreshTradedoublerToken(c.env, account, supabase);
    }

    // Update sync status
    await supabase
      .from('connected_accounts')
      .update({ sync_status: 'syncing' })
      .eq('id', account.id);

    // Fetch events (transactions) from last 30 days
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const eventsUrl = `https://api.tradedoubler.com/1.0/reports/eventsByDate;startDate=${startDate};endDate=${endDate}`;

    const eventsResponse = await fetch(eventsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch Tradedoubler events');
    }

    const eventsData = await eventsResponse.json();

    // Parse and store transactions
    const events = eventsData.reportRows || [];

    for (const event of events) {
      await supabase
        .from('affiliate_transactions')
        .upsert({
          user_id: user.id,
          connected_account_id: account.id,
          platform: 'tradedoubler',
          region: account.region,
          transaction_date: event.timeOfVisit || event.timeOfEvent,
          product_name: event.productName || null,
          product_id: event.productId || null,
          clicks: event.impressions || 0,
          orders: event.eventStatus === 'A' ? 1 : 0, // A = Approved
          items_shipped: event.eventStatus === 'A' ? 1 : 0,
          revenue: parseFloat(event.orderValue || 0),
          commission: parseFloat(event.affiliateCommission || 0),
          original_currency: event.currency || 'EUR',
          exchange_rate: 1.0, // TODO: Get actual exchange rate
          commission_eur: parseFloat(event.affiliateCommission || 0),
          raw_data: event,
        }, {
          onConflict: 'platform,product_id,transaction_date',
        });
    }

    // Update sync status
    await supabase
      .from('connected_accounts')
      .update({
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    return c.json({
      success: true,
      transactions_synced: events.length,
    });
  } catch (error: any) {
    console.error('Tradedoubler sync error:', error);

    // Update sync status to error
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
      const token = authHeader.substring(7);
      const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
      const { data: { user } } = await supabase.auth.getUser(token);

      if (user) {
        await supabase
          .from('connected_accounts')
          .update({ sync_status: 'error' })
          .eq('user_id', user.id)
          .eq('platform', 'tradedoubler');
      }
    }

    return c.json({ error: 'Sync failed', details: error.message }, 500);
  }
});

/**
 * Disconnect Tradedoubler account
 * DELETE /api/tradedoubler/disconnect
 */
tradedoublerOAuthRoutes.delete('/disconnect', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    await supabase
      .from('connected_accounts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('platform', 'tradedoubler');

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Tradedoubler disconnect error:', error);
    return c.json({ error: 'Disconnect failed' }, 500);
  }
});

/**
 * Helper: Refresh Tradedoubler access token
 */
async function refreshTradedoublerToken(env: Env, account: any, supabase: any): Promise<string> {
  const tokenUrl = 'https://connect.tradedoubler.com/oauth/token';

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${env.TRADEDOUBLER_CLIENT_ID}:${env.TRADEDOUBLER_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh Tradedoubler token');
  }

  const tokenData = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  // Update stored tokens
  await supabase
    .from('connected_accounts')
    .update({
      access_token,
      refresh_token,
      expires_at: expiresAt,
    })
    .eq('id', account.id);

  return access_token;
}

export default tradedoublerOAuthRoutes;
