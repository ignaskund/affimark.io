/**
 * Awin OAuth Routes
 *
 * OAuth flow for automated Awin earnings sync
 * Allows users to connect their Awin publisher account
 * and automatically sync transactions without CSV uploads
 */

import { Hono } from 'hono';
import type { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

type Bindings = Env;

const awinOAuthRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * Step 1: Initiate OAuth flow
 * GET /api/awin/oauth/authorize
 *
 * Redirects user to Awin OAuth authorization page
 */
awinOAuthRoutes.get('/oauth/authorize', async (c) => {
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

    // Check if Awin OAuth is configured
    if (!c.env.AWIN_CLIENT_ID || !c.env.AWIN_CLIENT_SECRET) {
      return c.json({
        error: 'Awin OAuth not configured. Please use CSV upload instead.'
      }, 400);
    }

    // Build OAuth authorization URL
    const redirectUri = `${c.env.BASE_URL}/api/awin/oauth/callback`;
    const state = Buffer.from(JSON.stringify({ userId: user.id })).toString('base64');

    const authUrl = new URL('https://ui.awin.com/oauth/authorize');
    authUrl.searchParams.set('client_id', c.env.AWIN_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('scope', 'transactions:read account:read programmes:read');

    return c.json({ authUrl: authUrl.toString() });
  } catch (error: any) {
    console.error('Awin OAuth authorize error:', error);
    return c.json({ error: 'Failed to initiate OAuth flow' }, 500);
  }
});

/**
 * Step 2: OAuth callback handler
 * GET /api/awin/oauth/callback
 *
 * Awin redirects here after user authorizes
 */
awinOAuthRoutes.get('/oauth/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      console.error('Awin OAuth error:', error);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=awin_oauth_denied`);
    }

    if (!code || !state) {
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=missing_params`);
    }

    // Decode state to get user ID
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());

    // Exchange code for access token
    const tokenUrl = 'https://api.awin.com/oauth/token';
    const redirectUri = `${c.env.BASE_URL}/api/awin/oauth/callback`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: c.env.AWIN_CLIENT_ID!,
        client_secret: c.env.AWIN_CLIENT_SECRET!,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Awin token exchange failed:', errorData);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get publisher account info
    const accountResponse = await fetch('https://api.awin.com/publishers/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
    });

    let accountIdentifier = 'Unknown';
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      accountIdentifier = accountData.publisher_id || accountData.id || 'Unknown';
    }

    // Store in database
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: dbError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: userId,
        platform: 'awin',
        storefront_name: 'Awin Publisher Account',
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
      console.error('Failed to store Awin credentials:', dbError);
      return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=db_error`);
    }

    // Trigger initial sync (fire-and-forget)
    fetch(`${c.env.BASE_URL}/api/awin/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    }).catch((err) => console.error('Initial sync trigger failed:', err));

    return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?success=awin_connected`);
  } catch (error: any) {
    console.error('Awin OAuth callback error:', error);
    return c.redirect(`${c.env.FRONTEND_URL}/dashboard/storefronts?error=callback_failed`);
  }
});

/**
 * Sync Awin transactions
 * POST /api/awin/sync
 *
 * Fetches recent transactions from Awin API and stores them
 */
awinOAuthRoutes.post('/sync', async (c) => {
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

    // Get user's Awin connected account
    const { data: account } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'awin')
      .eq('is_active', true)
      .single();

    if (!account) {
      return c.json({ error: 'Awin account not connected' }, 404);
    }

    // Check if token expired, refresh if needed
    let accessToken = account.access_token;
    if (new Date(account.token_expires_at) < new Date()) {
      accessToken = await refreshAwinToken(c.env, account, supabase);
    }

    // Update sync status
    await supabase
      .from('connected_accounts')
      .update({ sync_status: 'syncing' })
      .eq('id', account.id);

    // Fetch transactions from last 30 days
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = new Date().toISOString().split('T')[0];

    const transactionsUrl = `https://api.awin.com/publishers/${account.account_identifier}/transactions?startDate=${startDate}&endDate=${endDate}`;

    const transactionsResponse = await fetch(transactionsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!transactionsResponse.ok) {
      throw new Error('Failed to fetch Awin transactions');
    }

    const transactionsData = await transactionsResponse.json();

    // Parse and store transactions
    const transactions = transactionsData.transactions || [];

    for (const txn of transactions) {
      await supabase
        .from('affiliate_transactions')
        .upsert({
          user_id: user.id,
          connected_account_id: account.id,
          platform: 'awin',
          region: account.region,
          transaction_date: txn.transaction_date,
          product_name: txn.product_name || null,
          product_id: txn.product_id || null,
          clicks: txn.clicks || 0,
          orders: txn.status === 'approved' ? 1 : 0,
          items_shipped: txn.status === 'approved' ? 1 : 0,
          revenue: parseFloat(txn.sale_amount || 0),
          commission: parseFloat(txn.commission_amount || 0),
          original_currency: txn.currency || 'EUR',
          exchange_rate: 1.0, // TODO: Get actual exchange rate
          commission_eur: parseFloat(txn.commission_amount || 0),
          raw_data: txn,
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
      transactions_synced: transactions.length,
    });
  } catch (error: any) {
    console.error('Awin sync error:', error);

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
          .eq('platform', 'awin');
      }
    }

    return c.json({ error: 'Sync failed', details: error.message }, 500);
  }
});

/**
 * Disconnect Awin account
 * DELETE /api/awin/disconnect
 */
awinOAuthRoutes.delete('/disconnect', async (c) => {
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
      .eq('platform', 'awin');

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Awin disconnect error:', error);
    return c.json({ error: 'Disconnect failed' }, 500);
  }
});

/**
 * Helper: Refresh Awin access token
 */
async function refreshAwinToken(env: Env, account: any, supabase: any): Promise<string> {
  const tokenUrl = 'https://api.awin.com/oauth/token';

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refresh_token,
      client_id: env.AWIN_CLIENT_ID!,
      client_secret: env.AWIN_CLIENT_SECRET!,
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to refresh Awin token');
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

export default awinOAuthRoutes;
