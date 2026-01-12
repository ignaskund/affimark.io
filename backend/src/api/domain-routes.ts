/**
 * Custom Domain Management API Routes
 *
 * Allow users to use branded domains for SmartWrappers
 * Example: links.yourname.com/abc123 instead of go.affimark.com/abc123
 *
 * DNS Setup Required:
 * - CNAME: links.yourname.com → go.affimark.com
 * - TXT: _affimark-verify.yourname.com → {verification_token}
 */

import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { DNSVerifier } from '../services/dns-verifier';

type Bindings = Env;

const domainRoutes = new Hono<{ Bindings: Bindings }>();

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

/**
 * POST /api/domains
 * Add custom domain for user
 */
domainRoutes.post('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = await c.req.json();
  const { domain } = body;

  if (!domain) {
    return c.json({ error: 'Domain required' }, 400);
  }

  // Validate domain format
  const domainRegex = /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;
  if (!domainRegex.test(domain)) {
    return c.json({ error: 'Invalid domain format' }, 400);
  }

  try {
    const supabase = getSupabase(c);

    // Generate verification token
    const verificationToken = generateToken();

    // Create domain
    const { data, error } = await supabase
      .from('custom_domains')
      .insert({
        user_id: userId,
        domain: domain.toLowerCase(),
        verification_token: verificationToken,
        verification_status: 'pending',
        ssl_status: 'pending',
        is_active: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'Domain already registered' }, 400);
      }
      throw error;
    }

    return c.json({
      domain: data,
      instructions: {
        step1: {
          type: 'CNAME',
          host: domain,
          value: 'go.affimark.com',
          description: 'Point your domain to AffiMark',
        },
        step2: {
          type: 'TXT',
          host: `_affimark-verify.${domain}`,
          value: verificationToken,
          description: 'Verify domain ownership',
        },
      },
    });
  } catch (error: any) {
    console.error('Create domain error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * GET /api/domains
 * Get all user's custom domains
 */
domainRoutes.get('/', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = getSupabase(c);

    const { data: domains, error } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return c.json({ domains: domains || [] });
  } catch (error: any) {
    console.error('List domains error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * POST /api/domains/:id/verify
 * Verify domain ownership via DNS TXT record
 */
domainRoutes.post('/:id/verify', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    // Get domain
    const { data: domain, error: fetchError } = await supabase
      .from('custom_domains')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !domain) {
      return c.json({ error: 'Domain not found' }, 404);
    }

    // Check DNS records using real DNS verification
    const dnsVerifier = new DNSVerifier();
    const verificationResult = await dnsVerifier.verifyDomain(
      domain.domain,
      domain.verification_token,
      'affimark.io'
    );

    if (verificationResult.verified) {
      // Update domain status
      const { data: updated, error: updateError } = await supabase
        .from('custom_domains')
        .update({
          verification_status: 'verified',
          is_active: true,
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      // Provision SSL certificate (would use Let's Encrypt in production)
      // For now, mark as pending
      await supabase
        .from('custom_domains')
        .update({ ssl_status: 'provisioning' })
        .eq('id', id);

      return c.json({
        success: true,
        domain: updated,
        message: 'Domain verified! SSL certificate provisioning...',
      });
    } else {
      return c.json({
        success: false,
        message: 'DNS records not found. Please check your DNS settings and try again in a few minutes.',
        details: {
          cnameValid: verificationResult.cnameValid,
          txtValid: verificationResult.txtValid,
          cnameRecords: verificationResult.cnameRecords,
          txtRecords: verificationResult.txtRecords,
          error: verificationResult.error,
        },
      });
    }
  } catch (error: any) {
    console.error('Verify domain error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DELETE /api/domains/:id
 * Remove custom domain
 */
domainRoutes.delete('/:id', async (c) => {
  const userId = await getUserId(c);
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const { id } = c.req.param();

  try {
    const supabase = getSupabase(c);

    // Verify ownership
    const { data: existing } = await supabase
      .from('custom_domains')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!existing) {
      return c.json({ error: 'Domain not found' }, 404);
    }

    // Delete domain
    await supabase
      .from('custom_domains')
      .delete()
      .eq('id', id);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete domain error:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Helper: Generate verification token
 */
function generateToken(): string {
  return DNSVerifier.generateVerificationToken();
}

export default domainRoutes;
