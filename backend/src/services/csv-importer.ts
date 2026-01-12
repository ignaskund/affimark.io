/**
 * CSV Importer Service
 * Handles CSV imports from various affiliate platforms
 * Supports: Amazon Associates (DE/UK/US/etc), LTK, ShareASale, etc.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { CurrencyConverterService } from './currency-converter';

interface ImportCSVParams {
  userId: string;
  connectedAccountId: string;
  platform: string;
  csvData: string;
  currencyConverter: CurrencyConverterService;
}

interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  error?: string;
}

interface ParsedTransaction {
  transaction_date: string;
  transaction_id?: string;
  order_id?: string;
  product_name?: string;
  product_id?: string;
  clicks: number;
  orders: number;
  items_shipped: number;
  revenue: number;
  commission: number;
  original_currency: string;
}

export class CSVImporterService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Import CSV data and parse based on platform
   */
  async importCSV(params: ImportCSVParams): Promise<ImportResult> {
    try {
      const { userId, connectedAccountId, platform, csvData, currencyConverter } = params;

      // Parse CSV based on platform
      let transactions: ParsedTransaction[];

      if (platform.startsWith('amazon_')) {
        transactions = this.parseAmazonCSV(csvData, platform);
      } else if (platform === 'ltk') {
        transactions = this.parseLTKCSV(csvData);
      } else {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          error: `Unsupported platform: ${platform}`,
        };
      }

      if (transactions.length === 0) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          error: 'No valid transactions found in CSV',
        };
      }

      // Convert currencies and insert
      let importedCount = 0;
      let skippedCount = 0;

      for (const txn of transactions) {
        try {
          // Convert to EUR
          const { commission_eur, revenue_eur, exchange_rate } =
            await currencyConverter.convertToEUR(
              txn.commission,
              txn.revenue,
              txn.original_currency,
              txn.transaction_date
            );

          // Insert transaction
          const { error } = await this.supabase.from('affiliate_transactions').insert({
            user_id: userId,
            connected_account_id: connectedAccountId,
            platform,
            region: this.extractRegion(platform),
            transaction_date: txn.transaction_date,
            transaction_id: txn.transaction_id,
            order_id: txn.order_id,
            product_name: txn.product_name,
            product_id: txn.product_id,
            clicks: txn.clicks,
            orders: txn.orders,
            items_shipped: txn.items_shipped,
            revenue: txn.revenue,
            commission: txn.commission,
            original_currency: txn.original_currency,
            commission_eur,
            revenue_eur,
            exchange_rate,
            raw_data: txn,
          });

          if (error) {
            // If duplicate, skip
            if (error.code === '23505') {
              skippedCount++;
            } else {
              console.error('[CSVImporter] Insert error:', error);
              skippedCount++;
            }
          } else {
            importedCount++;
          }
        } catch (err) {
          console.error('[CSVImporter] Transaction processing error:', err);
          skippedCount++;
        }
      }

      return {
        success: true,
        importedCount,
        skippedCount,
      };
    } catch (error) {
      console.error('[CSVImporter] Import failed:', error);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Parse Amazon Associates CSV
   * Format varies slightly by region but generally:
   * Date, Product Name, ASIN, Clicks, Ordered Items, Items Shipped, Revenue, Earnings
   */
  private parseAmazonCSV(csvData: string, platform: string): ParsedTransaction[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const transactions: ParsedTransaction[] = [];
    const currency = this.getCurrencyForPlatform(platform);

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = this.parseCSVLine(line);

      // Amazon CSV format (approximate - varies by region):
      // 0: Date, 1: Product, 2: ASIN, 3: Clicks, 4: Ordered Items, 5: Items Shipped, 6: Revenue, 7: Earnings
      try {
        const date = this.parseDate(cols[0]);
        const productName = cols[1] || '';
        const asin = cols[2] || '';
        const clicks = parseInt(cols[3]) || 0;
        const orders = parseInt(cols[4]) || 0;
        const shipped = parseInt(cols[5]) || 0;
        const revenue = parseFloat(cols[6]?.replace(/[^0-9.-]/g, '') || '0');
        const commission = parseFloat(cols[7]?.replace(/[^0-9.-]/g, '') || '0');

        if (date && commission > 0) {
          transactions.push({
            transaction_date: date,
            transaction_id: `${platform}_${date}_${asin}`,
            product_name: productName,
            product_id: asin,
            clicks,
            orders,
            items_shipped: shipped,
            revenue,
            commission,
            original_currency: currency,
          });
        }
      } catch (err) {
        console.warn('[CSVImporter] Skipping malformed line:', line);
      }
    }

    return transactions;
  }

  /**
   * Parse LTK CSV
   * Format: Date, Product, Merchant, Clicks, Commissions, Currency
   */
  private parseLTKCSV(csvData: string): ParsedTransaction[] {
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) return [];

    const transactions: ParsedTransaction[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = this.parseCSVLine(line);

      try {
        const date = this.parseDate(cols[0]);
        const productName = cols[1] || '';
        const clicks = parseInt(cols[3]) || 0;
        const commission = parseFloat(cols[4]?.replace(/[^0-9.-]/g, '') || '0');
        const currency = cols[5] || 'USD';

        if (date && commission > 0) {
          transactions.push({
            transaction_date: date,
            transaction_id: `ltk_${date}_${productName.substring(0, 20)}`,
            product_name: productName,
            clicks,
            orders: 0,
            items_shipped: 0,
            revenue: 0,
            commission,
            original_currency: currency,
          });
        }
      } catch (err) {
        console.warn('[CSVImporter] Skipping malformed LTK line:', line);
      }
    }

    return transactions;
  }

  /**
   * Parse CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse date string to YYYY-MM-DD
   * Handles various formats: MM/DD/YYYY, DD.MM.YYYY, YYYY-MM-DD
   */
  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // Already in ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // MM/DD/YYYY (US format - Amazon US)
    const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (usMatch) {
      const [, month, day, year] = usMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // DD.MM.YYYY (EU format - Amazon DE)
    const euMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (euMatch) {
      const [, day, month, year] = euMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }

  /**
   * Get currency for platform
   */
  private getCurrencyForPlatform(platform: string): string {
    const currencyMap: Record<string, string> = {
      amazon_de: 'EUR',
      amazon_uk: 'GBP',
      amazon_us: 'USD',
      amazon_fr: 'EUR',
      amazon_es: 'EUR',
      amazon_it: 'EUR',
      ltk: 'USD',
      shopmy: 'USD',
    };

    return currencyMap[platform] || 'EUR';
  }

  /**
   * Extract region from platform code
   */
  private extractRegion(platform: string): string | null {
    const regionMatch = platform.match(/_([a-z]{2})$/i);
    return regionMatch ? regionMatch[1].toUpperCase() : null;
  }
}
