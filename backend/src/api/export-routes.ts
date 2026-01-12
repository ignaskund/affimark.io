import { Hono } from 'hono';
import type { Env } from '../index';
import { createClient } from '@supabase/supabase-js';

const app = new Hono<{ Bindings: Env }>();

/**
 * GET /api/export/tax-personas
 * Get all available tax personas
 */
app.get('/tax-personas', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Fetch all tax personas
    const { data: personas, error } = await supabase
      .from('tax_personas')
      .select('*')
      .order('country_code', { ascending: true });

    if (error) {
      console.error('Error fetching tax personas:', error);
      return c.json({ error: 'Failed to fetch tax personas' }, 500);
    }

    return c.json({ personas });
  } catch (err) {
    console.error('Error in /tax-personas:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/export/csv
 * Generate CSV export with tax persona formatting
 */
app.post('/csv', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { start_date, end_date, persona_id } = body;

    if (!start_date || !end_date) {
      return c.json({ error: 'start_date and end_date are required' }, 400);
    }

    // Fetch tax persona if specified
    let persona = null;
    if (persona_id) {
      const { data: personaData } = await supabase
        .from('tax_personas')
        .select('*')
        .eq('id', persona_id)
        .single();
      persona = personaData;
    }

    // Fetch transactions for date range
    const { data: transactions, error: txError } = await supabase
      .from('affiliate_transactions')
      .select('*, connected_accounts(platform, storefront_name)')
      .eq('user_id', user.id)
      .gte('transaction_date', start_date)
      .lte('transaction_date', end_date)
      .order('transaction_date', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return c.json({ error: 'Failed to fetch transactions' }, 500);
    }

    if (!transactions || transactions.length === 0) {
      return c.json({ error: 'No transactions found for date range' }, 404);
    }

    // Generate CSV based on persona
    const csv = generateCSV(transactions, persona);

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="affimark-export-${start_date}-to-${end_date}.csv"`,
      },
    });
  } catch (err) {
    console.error('Error in /csv:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/export/pdf
 * Generate PDF export with tax persona formatting
 * (Currently returns JSON - PDF generation requires additional library)
 */
app.post('/pdf', async (c) => {
  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { start_date, end_date, persona_id } = body;

    if (!start_date || !end_date) {
      return c.json({ error: 'start_date and end_date are required' }, 400);
    }

    // Fetch tax persona
    let persona = null;
    if (persona_id) {
      const { data: personaData } = await supabase
        .from('tax_personas')
        .select('*')
        .eq('id', persona_id)
        .single();
      persona = personaData;
    }

    // Fetch transactions
    const { data: transactions, error: txError } = await supabase
      .from('affiliate_transactions')
      .select('*, connected_accounts(platform, storefront_name)')
      .eq('user_id', user.id)
      .gte('transaction_date', start_date)
      .lte('transaction_date', end_date)
      .order('transaction_date', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      return c.json({ error: 'Failed to fetch transactions' }, 500);
    }

    if (!transactions || transactions.length === 0) {
      return c.json({ error: 'No transactions found for date range' }, 404);
    }

    // Calculate summary
    const summary = {
      total_transactions: transactions.length,
      total_commission: transactions.reduce((sum, tx) => sum + (tx.commission_eur || 0), 0),
      total_revenue: transactions.reduce((sum, tx) => sum + (tx.revenue_eur || 0), 0),
      total_clicks: transactions.reduce((sum, tx) => sum + (tx.clicks || 0), 0),
      total_orders: transactions.reduce((sum, tx) => sum + (tx.orders || 0), 0),
      platforms: [...new Set(transactions.map((tx) => tx.platform))],
      date_range: { start_date, end_date },
      persona: persona
        ? {
            name: persona.persona_name,
            country: persona.country_code,
            description: persona.description,
          }
        : null,
    };

    // TODO: Generate actual PDF using library like puppeteer or jsPDF
    // For now, return structured data that frontend can display
    return c.json({
      message: 'PDF generation not yet implemented - use CSV export',
      summary,
      transactions: transactions.slice(0, 10), // Preview
      disclaimer:
        'This export is formatted for informational purposes. Please review with your accountant before submitting to tax authorities.',
    });
  } catch (err) {
    console.error('Error in /pdf:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ========================================
// CSV Generation Helper
// ========================================

function generateCSV(transactions: any[], persona: any | null): string {
  // Determine column headers based on persona
  const headers = getHeadersForPersona(persona);

  // Generate CSV rows
  const rows = transactions.map((tx) => {
    return formatRowForPersona(tx, persona);
  });

  // Combine headers + rows
  const csvLines = [headers.join(','), ...rows.map((row) => row.join(','))];

  return csvLines.join('\n');
}

function getHeadersForPersona(persona: any | null): string[] {
  if (!persona) {
    // Generic format
    return [
      'Date',
      'Platform',
      'Storefront',
      'Product',
      'Clicks',
      'Orders',
      'Revenue (EUR)',
      'Commission (EUR)',
      'Original Currency',
      'Original Commission',
      'Exchange Rate',
    ];
  }

  const countryCode = persona.country_code;

  switch (countryCode) {
    case 'DE':
      // German EÜR format
      return [
        'Datum',
        'Geschäftspartner',
        'Leistung',
        'Betrag (EUR)',
        'USt (%)',
        'Netto (EUR)',
        'Kategorie',
        'Beleg-Nr',
      ];

    case 'UK':
      // UK Self Assessment
      return [
        'Date',
        'Client',
        'Description',
        'Gross Amount (GBP)',
        'VAT (%)',
        'Net Amount (GBP)',
        'Category',
        'Reference',
      ];

    case 'NL':
      // Dutch BTW
      return [
        'Datum',
        'Klant',
        'Omschrijving',
        'Bedrag (EUR)',
        'BTW (%)',
        'Netto (EUR)',
        'Categorie',
        'Referentie',
      ];

    case 'FR':
      // French BIC/BNC
      return [
        'Date',
        'Client',
        'Prestation',
        'Montant (EUR)',
        'TVA (%)',
        'Net (EUR)',
        'Catégorie',
        'Référence',
      ];

    case 'LT':
      // Lithuanian MB
      return [
        'Data',
        'Klientas',
        'Paslauga',
        'Suma (EUR)',
        'PVM (%)',
        'Neto (EUR)',
        'Kategorija',
        'Nuoroda',
      ];

    default:
      // Generic EU format
      return [
        'Date',
        'Partner',
        'Service',
        'Amount (EUR)',
        'VAT (%)',
        'Net (EUR)',
        'Category',
        'Reference',
      ];
  }
}

function formatRowForPersona(tx: any, persona: any | null): string[] {
  if (!persona) {
    // Generic format
    return [
      tx.transaction_date,
      tx.platform,
      tx.connected_accounts?.storefront_name || tx.platform,
      `"${tx.product_name || 'N/A'}"`,
      tx.clicks?.toString() || '0',
      tx.orders?.toString() || '0',
      tx.revenue_eur?.toFixed(2) || '0.00',
      tx.commission_eur?.toFixed(2) || '0.00',
      tx.original_currency || 'EUR',
      tx.commission?.toFixed(2) || '0.00',
      tx.exchange_rate?.toFixed(6) || '1.000000',
    ];
  }

  const countryCode = persona.country_code;
  const storefront = tx.connected_accounts?.storefront_name || tx.platform;
  const productDesc = tx.product_name || 'Affiliate Commission';
  const commission = tx.commission_eur || 0;

  // For EU countries, affiliate income is typically 0% VAT (B2B services)
  // But this varies by country - users should confirm with accountant
  const vatRate = '0';
  const netAmount = commission.toFixed(2);

  switch (countryCode) {
    case 'DE':
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Provisionen',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];

    case 'UK':
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Commission Income',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];

    case 'NL':
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Commissies',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];

    case 'FR':
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Commissions',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];

    case 'LT':
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Komisiniai',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];

    default:
      return [
        tx.transaction_date,
        storefront,
        `"${productDesc}"`,
        commission.toFixed(2),
        vatRate,
        netAmount,
        'Affiliate Commission',
        `AFFI-${tx.id.slice(0, 8)}`,
      ];
  }
}

export default app;
